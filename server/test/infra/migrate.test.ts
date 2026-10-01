import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { Pool } from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "../../src/db/migrate.js";

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../migrations",
);

describe("migrations", () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
  }, 180_000);

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  it("creates the global domain schema and is idempotent", async () => {
    const applied = await migrate(pool, migrationsDir);
    expect(applied).toContain("0001_global_domain.sql");

    const tables = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    const names = (tables.rows as { table_name: string }[]).map(
      (row) => row.table_name,
    );
    expect(names).toContain("tenants");
    expect(names).toContain("users");
    expect(names).toContain("memberships");

    expect(await migrate(pool, migrationsDir)).toEqual([]);
  });
});
