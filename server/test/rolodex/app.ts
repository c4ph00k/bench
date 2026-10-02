/** A fresh Rolodex tenant for one test, exposed as a gated Express app plus the repo and pool for
 *  setup through the data layer. Tests sign in to reach /api/rolodex. */
import type express from "express";
import type { Pool } from "pg";
import { createApp } from "../../src/app.js";
import { createRepo, type Repo } from "../../src/rolodex/db/index.js";
import {
  JWT_SECRET,
  resetAuth,
  seedAuth,
  testPool,
} from "../helpers/postgres.js";

export interface RolodexApp {
  app: express.Express;
  pool: Pool;
  tenantId: number;
  repo: Repo;
}

export async function appWithRolodex(): Promise<RolodexApp> {
  const pool = await testPool();
  await resetAuth(pool);
  await seedAuth(pool);
  const tenant = await pool.query<{ id: number }>(
    "SELECT id FROM tenants ORDER BY id LIMIT 1",
  );
  const tenantId = tenant.rows[0].id;
  return {
    app: createApp({ pool, jwtSecret: JWT_SECRET }),
    pool,
    tenantId,
    repo: createRepo(pool, tenantId),
  };
}
