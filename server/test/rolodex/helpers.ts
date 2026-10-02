import type { Pool } from "pg";
import { createRepo, type Repo } from "../../src/rolodex/db/index.js";
import type { Person } from "../../src/rolodex/types.js";
import { resetAuth, seedAuth, testPool } from "../helpers/postgres.js";

export interface RolodexContext {
  pool: Pool;
  tenantId: number;
  repo: Repo;
}

/** A fresh tenant with a repo bound to it, for tests that drive the data layer directly. */
export async function setupRolodex(): Promise<RolodexContext> {
  const pool = await testPool();
  await resetAuth(pool);
  await seedAuth(pool);
  const tenant = await pool.query<{ id: number }>(
    "SELECT id FROM tenants ORDER BY id LIMIT 1",
  );
  const tenantId = tenant.rows[0].id;
  return { pool, tenantId, repo: createRepo(pool, tenantId) };
}

export function makePerson(
  repo: Repo,
  name = "Test Person",
  extra: Record<string, unknown> = {},
): Promise<Person> {
  return repo.createPerson({
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    tags: [],
    ...extra,
  });
}
