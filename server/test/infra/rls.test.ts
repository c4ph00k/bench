import { beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { seed as seedCrm } from "../../src/crm/seed.js";
import { resetAuth, seedAuth, testPool } from "../helpers/postgres.js";

let pool: Pool;

beforeAll(async () => {
  pool = await testPool();
});

describe("row-level security", () => {
  it("hides every tenant's rows from a connection that has not named one", async () => {
    await resetAuth(pool);
    await seedAuth(pool);
    const first = (
      await pool.query<{ id: number }>(
        "SELECT id FROM tenants WHERE slug = 'novhora'",
      )
    ).rows[0].id;
    await seedCrm(pool, first);
    await pool.query(
      "INSERT INTO tenants (name, slug, plan) VALUES ($1, $2, 'free')",
      ["Second Co", "second"],
    );
    const second = (
      await pool.query<{ id: number }>(
        "SELECT id FROM tenants WHERE slug = 'second'",
      )
    ).rows[0].id;
    await seedCrm(pool, second);

    // The seed runs as the owner, which bypasses RLS; an app connection runs as app_rls and does
    // not. Without app.tenant_id the policy matches nothing, so a forgotten tenant filter in the
    // code would still see zero rows rather than everyone's.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE app_rls");
      const none = await client.query("SELECT * FROM organizations");
      expect(none.rows).toHaveLength(0);

      await client.query(`SET LOCAL app.tenant_id = '${second}'`);
      const seen = await client.query("SELECT * FROM organizations");
      expect(seen.rows.length).toBeGreaterThan(0);
      for (const row of seen.rows as { tenant_id: number }[])
        expect(row.tenant_id).toBe(second);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});
