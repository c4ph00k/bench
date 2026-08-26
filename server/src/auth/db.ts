/**
 * Auth store: the users and the sessions that keep them signed in. One file, auth.sqlite, because
 * the gate is Bench-level, not app-level - none of the three app databases owns it. A user is an
 * admin (the admin panel) or a plain user, and `must_change_password` records that the password
 * they just signed in with was set by someone else and has to be replaced before the apps open.
 */
import Database from "better-sqlite3";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type AuthDb = Database.Database;
export type Role = "admin" | "user";

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role: Role;
  must_change_password: number;
}

/** The shape the panel and /me see - never the hash. */
export interface PublicUser {
  id: number;
  username: string;
  role: Role;
  mustChangePassword: boolean;
}

function toPublicUser(u: {
  id: number;
  username: string;
  role: Role;
  must_change_password: number;
}): PublicUser {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    mustChangePassword: u.must_change_password === 1,
  };
}

export function openDb(path: string): AuthDb {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
      must_change_password INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
  `);
  migrate(db);
  return db;
}

/** Databases created before roles existed get the columns added; marco, the only row there ever
    was, becomes admin. */
function migrate(db: AuthDb) {
  const columns = (
    db.prepare("PRAGMA table_info(users)").all() as { name: string }[]
  ).map((c) => c.name);
  if (!columns.includes("role"))
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'");
  if (!columns.includes("must_change_password"))
    db.exec(
      "ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0",
    );
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

export function userCount(db: AuthDb): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number })
    .n;
}

export function countAdmins(db: AuthDb): number {
  return (
    db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'")
      .get() as { n: number }
  ).n;
}

/** Seeds the one login the server has, on first run only. Returns whether it inserted. */
export function seedIfEmpty(
  db: AuthDb,
  username: string,
  password: string,
): boolean {
  if (userCount(db) > 0) return false;
  db.prepare(
    "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')",
  ).run(username, hashPassword(password));
  return true;
}

export function getUser(db: AuthDb, username: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username) as
    UserRow | undefined;
}

export function getUserById(db: AuthDb, id: number): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
    UserRow | undefined;
}

export function listUsers(db: AuthDb): PublicUser[] {
  const rows = db
    .prepare(
      "SELECT id, username, role, must_change_password FROM users ORDER BY id",
    )
    .all() as {
    id: number;
    username: string;
    role: Role;
    must_change_password: number;
  }[];
  return rows.map(toPublicUser);
}

/** Inserts a user bound to change their password on first sign-in. Undefined if the name is
    taken. */
export function createUser(
  db: AuthDb,
  username: string,
  password: string,
  role: Role,
): PublicUser | undefined {
  if (getUser(db, username)) return undefined;
  const info = db
    .prepare(
      "INSERT INTO users (username, password_hash, role, must_change_password) VALUES (?, ?, ?, 1)",
    )
    .run(username, hashPassword(password), role);
  return toPublicUser(getUserById(db, Number(info.lastInsertRowid))!);
}

/** Applies a username and/or role change. Undefined if the user or the new name is taken. */
export function updateUser(
  db: AuthDb,
  id: number,
  patch: { username?: string; role?: Role },
): PublicUser | undefined {
  const existing = getUserById(db, id);
  if (!existing) return undefined;
  if (
    patch.username !== undefined &&
    patch.username !== existing.username &&
    getUser(db, patch.username)
  )
    return undefined;
  db.prepare("UPDATE users SET username = ?, role = ? WHERE id = ?").run(
    patch.username ?? existing.username,
    patch.role ?? existing.role,
    id,
  );
  return toPublicUser(getUserById(db, id)!);
}

/** Deletes the user and their sessions. Returns whether a row went. */
export function deleteUser(db: AuthDb, id: number): boolean {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  return db.prepare("DELETE FROM users WHERE id = ?").run(id).changes > 0;
}

/** Sets a new temporary password that must be replaced at the next sign-in. */
export function resetPassword(
  db: AuthDb,
  id: number,
  password: string,
): boolean {
  return (
    db
      .prepare(
        "UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?",
      )
      .run(hashPassword(password), id).changes > 0
  );
}

/** Replaces the password and lifts the must-change flag. */
export function changePassword(
  db: AuthDb,
  id: number,
  password: string,
): boolean {
  return (
    db
      .prepare(
        "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?",
      )
      .run(hashPassword(password), id).changes > 0
  );
}

const SESSION_MS = 30 * 24 * 3600 * 1000;

export interface Session {
  token: string;
  expires_at: number;
}

export function createSession(db: AuthDb, userId: number): Session {
  // Login is also the one moment expired rows are worth sweeping; a cron per local app would be
  // machinery for a table that grows by one row a month.
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  const session: Session = {
    token: randomBytes(32).toString("hex"),
    expires_at: Date.now() + SESSION_MS,
  };
  db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
  ).run(session.token, userId, session.expires_at);
  return session;
}

export function getSessionUser(db: AuthDb, token: string): UserRow | null {
  return (
    (db
      .prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at >= ?`,
      )
      .get(token, Date.now()) as UserRow | undefined) ?? null
  );
}

export function deleteSession(db: AuthDb, token: string): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}
