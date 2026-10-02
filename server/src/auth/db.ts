/**
 * The global domain: users, tenants, and the memberships that bind a user to a tenant with a role.
 * Auth runs on Postgres now, so every operation is async and the role an admin panel sees belongs
 * to the membership, not to the user.
 */
import type { Pool } from "pg";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type Role = "owner" | "admin" | "user";

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  master_admin: boolean;
  must_change_password: boolean;
  token_version: number;
}

export interface PublicUser {
  id: number;
  email: string;
  role: Role;
  mustChangePassword: boolean;
}

interface PublicUserRow {
  id: number;
  email: string;
  role: Role;
  must_change_password: boolean;
}

function toPublicUser(row: PublicUserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    mustChangePassword: row.must_change_password,
  };
}

/** salt:hash, both hex. scrypt needs no dependency and hashes in ~100ms at the default cost. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(
    password,
    Buffer.from(saltHex, "hex"),
    expected.length,
  );
  return timingSafeEqual(actual, expected);
}

export async function userCount(pool: Pool): Promise<number> {
  const result = await pool.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM users",
  );
  return result.rows[0].n;
}

export async function getUserByEmail(
  pool: Pool,
  email: string,
): Promise<UserRow | undefined> {
  const result = await pool.query<UserRow>(
    "SELECT * FROM users WHERE email = $1",
    [email],
  );
  return result.rows[0];
}

export async function getUserById(
  pool: Pool,
  id: number,
): Promise<UserRow | undefined> {
  const result = await pool.query<UserRow>(
    "SELECT * FROM users WHERE id = $1",
    [id],
  );
  return result.rows[0];
}

export interface Seed {
  name: string;
  slug: string;
  email: string;
  password: string;
}

/** Seeds the first tenant and its owner, on first run only. Returns whether it inserted. */
export async function seed(pool: Pool, input: Seed): Promise<boolean> {
  if ((await userCount(pool)) > 0) return false;
  const tenant = await pool.query<{ id: number }>(
    "INSERT INTO tenants (name, slug, plan) VALUES ($1, $2, 'gold') RETURNING id",
    [input.name, input.slug],
  );
  const tenantId = tenant.rows[0].id;
  const user = await pool.query<{ id: number }>(
    "INSERT INTO users (email, password_hash, master_admin) VALUES ($1, $2, true) RETURNING id",
    [input.email, hashPassword(input.password)],
  );
  const userId = user.rows[0].id;
  await pool.query(
    "INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1, $2, 'owner')",
    [tenantId, userId],
  );
  return true;
}

export async function listUsers(
  pool: Pool,
  tenantId: number,
): Promise<PublicUser[]> {
  const result = await pool.query<PublicUserRow>(
    `SELECT u.id, u.email, u.must_change_password, m.role
     FROM users u JOIN memberships m ON m.user_id = u.id
     WHERE m.tenant_id = $1 ORDER BY u.id`,
    [tenantId],
  );
  return result.rows.map(toPublicUser);
}

/** Creates a user bound to change their password on first sign-in, as a member of the tenant.
    Undefined if the email is already taken. */
export async function createUser(
  pool: Pool,
  tenantId: number,
  email: string,
  password: string,
  role: Role,
): Promise<PublicUser | undefined> {
  const inserted = await pool.query<{ id: number }>(
    "INSERT INTO users (email, password_hash, must_change_password) VALUES ($1, $2, true) ON CONFLICT (email) DO NOTHING RETURNING id",
    [email, hashPassword(password)],
  );
  if (inserted.rows.length === 0) return undefined;
  const userId = inserted.rows[0].id;
  await pool.query(
    "INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1, $2, $3)",
    [tenantId, userId, role],
  );
  return { id: userId, email, role, mustChangePassword: true };
}

export async function updateUser(
  pool: Pool,
  tenantId: number,
  id: number,
  patch: { email?: string; role?: Role },
): Promise<PublicUser | undefined> {
  const existing = await getUserById(pool, id);
  if (!existing) return undefined;
  if (patch.email !== undefined && patch.email !== existing.email) {
    const updated = await pool.query<{ id: number }>(
      "UPDATE users SET email = $1, updated_at = now() WHERE id = $2 AND NOT EXISTS (SELECT 1 FROM users WHERE email = $1 AND id != $2) RETURNING id",
      [patch.email, id],
    );
    if (updated.rows.length === 0) return undefined;
  }
  if (patch.role !== undefined) {
    await pool.query(
      "UPDATE memberships SET role = $1 WHERE tenant_id = $2 AND user_id = $3",
      [patch.role, tenantId, id],
    );
  }
  const member = await pool.query<PublicUserRow>(
    `SELECT u.id, u.email, u.must_change_password, m.role
     FROM users u JOIN memberships m ON m.user_id = u.id
     WHERE u.id = $1 AND m.tenant_id = $2`,
    [id, tenantId],
  );
  return member.rows[0] ? toPublicUser(member.rows[0]) : undefined;
}

/** The user's first membership, whichever role it carries. */
export async function primaryTenantId(
  pool: Pool,
  userId: number,
): Promise<number | null> {
  const result = await pool.query<{ tenant_id: number }>(
    "SELECT tenant_id FROM memberships WHERE user_id = $1 ORDER BY tenant_id LIMIT 1",
    [userId],
  );
  return result.rows.length > 0 ? result.rows[0].tenant_id : null;
}

export async function tenantExists(pool: Pool, id: number): Promise<boolean> {
  const result = await pool.query<{ id: number }>(
    "SELECT 1 AS id FROM tenants WHERE id = $1",
    [id],
  );
  return result.rows.length > 0;
}

/** The user's role in their first membership, so the chrome can decide whether to show admin. */
export async function primaryRole(
  pool: Pool,
  userId: number,
): Promise<Role | undefined> {
  const result = await pool.query<{ role: Role }>(
    "SELECT role FROM memberships WHERE user_id = $1 ORDER BY tenant_id LIMIT 1",
    [userId],
  );
  return result.rows[0]?.role;
}

/** The tenants a user may switch among: all of them for a master admin, else their own. */
export interface TenantInfo {
  id: number;
  name: string;
  slug: string;
}

export async function listSelectableTenants(
  pool: Pool,
  user: UserRow,
): Promise<TenantInfo[]> {
  if (user.master_admin) {
    const result = await pool.query<TenantInfo>(
      "SELECT id, name, slug FROM tenants ORDER BY id",
    );
    return result.rows;
  }
  const result = await pool.query<TenantInfo>(
    `SELECT t.id, t.name, t.slug FROM tenants t
     JOIN memberships m ON m.tenant_id = t.id
     WHERE m.user_id = $1 ORDER BY t.id`,
    [user.id],
  );
  return result.rows;
}

export async function membershipRole(
  pool: Pool,
  tenantId: number,
  userId: number,
): Promise<Role | undefined> {
  const result = await pool.query<{ role: Role }>(
    "SELECT role FROM memberships WHERE tenant_id = $1 AND user_id = $2",
    [tenantId, userId],
  );
  return result.rows[0]?.role;
}

export async function countRole(
  pool: Pool,
  tenantId: number,
  role: Role,
): Promise<number> {
  const result = await pool.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM memberships WHERE tenant_id = $1 AND role = $2",
    [tenantId, role],
  );
  return result.rows[0].n;
}

/** Removes the membership; the user itself goes when it is a member of nothing else. */
export async function deleteUser(
  pool: Pool,
  tenantId: number,
  id: number,
): Promise<boolean> {
  const removed = await pool.query(
    "DELETE FROM memberships WHERE tenant_id = $1 AND user_id = $2",
    [tenantId, id],
  );
  if ((removed.rowCount ?? 0) === 0) return false;
  await pool.query(
    "DELETE FROM users WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM memberships WHERE user_id = $1)",
    [id],
  );
  return true;
}

/** Sets a new temporary password that must be replaced at the next sign-in, revoking old tokens. */
export async function resetPassword(
  pool: Pool,
  id: number,
  password: string,
): Promise<boolean> {
  const result = await pool.query(
    "UPDATE users SET password_hash = $1, must_change_password = true, token_version = token_version + 1, updated_at = now() WHERE id = $2",
    [hashPassword(password), id],
  );
  return (result.rowCount ?? 0) > 0;
}

/** Revokes every outstanding token for the user by bumping the version they all carry. Stateless
    logout: the next sign-in mints a token with the new version. */
export async function revokeTokens(pool: Pool, userId: number): Promise<void> {
  await pool.query(
    "UPDATE users SET token_version = token_version + 1, updated_at = now() WHERE id = $1",
    [userId],
  );
}

/** Replaces the password and lifts the must-change flag, revoking old tokens. Returns the updated
    user, whose `token_version` now differs from every previously issued token. */
export async function changePassword(
  pool: Pool,
  id: number,
  password: string,
): Promise<UserRow | undefined> {
  const result = await pool.query<UserRow>(
    "UPDATE users SET password_hash = $1, must_change_password = false, token_version = token_version + 1, updated_at = now() WHERE id = $2 RETURNING *",
    [hashPassword(password), id],
  );
  return result.rows[0];
}
