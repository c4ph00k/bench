import type { Pool } from "pg";
import { resetAuth, seedAuth, testPool } from "../helpers/postgres.js";

/** A clean CRM tenant for one test: a freshly seeded tenancy, empty of CRM data. */
export async function setupCrm(): Promise<{ pool: Pool; tenantId: number }> {
  const pool = await testPool();
  await resetAuth(pool);
  await seedAuth(pool);
  const tenant = await pool.query<{ id: number }>(
    "SELECT id FROM tenants ORDER BY id LIMIT 1",
  );
  return { pool, tenantId: tenant.rows[0].id };
}
