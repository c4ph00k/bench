import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import type { Pool } from "pg";
import { migrate } from "../../src/db/migrate.js";
import { createPool } from "../../src/db/pool.js";
import * as auth from "../../src/auth/db.js";

export const JWT_SECRET = "test-secret";
export const SEED_EMAIL = "marco@example.com";
export const SEED_PASSWORD = "bench";

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../migrations",
);

let container: Promise<StartedPostgreSqlContainer> | undefined;
let pool: Pool | undefined;

/** One Postgres per test process, migrated on first use. The process ends, Ryuk reaps it. */
export async function testPool(): Promise<Pool> {
  if (!pool) {
    container ??= new PostgreSqlContainer("postgres:17-alpine").start();
    pool = createPool({
      connectionString: (await container).getConnectionUri(),
    });
    await migrate(pool, migrationsDir);
  }
  return pool;
}

/** Empty the global tables so a test starts from a clean slate. */
export async function resetAuth(pool: Pool): Promise<void> {
  await pool.query(
    "TRUNCATE users, memberships, tenants RESTART IDENTITY CASCADE",
  );
}

/** Seed the one tenant and its owner, as index.ts does on first run. */
export async function seedAuth(pool: Pool): Promise<void> {
  await auth.seed(pool, {
    name: "Novhora",
    slug: "novhora",
    email: SEED_EMAIL,
    password: SEED_PASSWORD,
  });
}
