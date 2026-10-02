import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { seedIfEmpty } from "../../src/space/seed.js";
import { resetAuth, seedAuth, testPool } from "../helpers/postgres.js";

let pool: Pool;

async function tenantId(): Promise<number> {
  pool = await testPool();
  await resetAuth(pool);
  await seedAuth(pool);
  const tenant = await pool.query<{ id: number }>(
    "SELECT id FROM tenants ORDER BY id LIMIT 1",
  );
  return tenant.rows[0].id;
}

describe("space seed", () => {
  it("populates an empty tenant once, several levels deep, with icons", async () => {
    const id = await tenantId();
    await seedIfEmpty(pool, id);
    const first = await pool.query<{ c: number }>(
      "SELECT COUNT(*)::int AS c FROM pages WHERE tenant_id = $1",
      [id],
    );
    const count = first.rows[0].c;
    expect(count).toBeGreaterThan(10);

    await seedIfEmpty(pool, id);
    const second = await pool.query<{ c: number }>(
      "SELECT COUNT(*)::int AS c FROM pages WHERE tenant_id = $1",
      [id],
    );
    expect(second.rows[0].c).toBe(count);

    const depth3 = await pool.query(
      `SELECT p3.title FROM pages p3
       JOIN pages p2 ON p3.parent_id = p2.id
       JOIN pages p1 ON p2.parent_id = p1.id
       WHERE p1.parent_id IS NULL AND p3.tenant_id = $1`,
      [id],
    );
    expect(depth3.rows.length).toBeGreaterThan(0);

    const noIcon = await pool.query<{ c: number }>(
      "SELECT COUNT(*)::int AS c FROM pages WHERE icon IS NULL AND type != 'row' AND tenant_id = $1",
      [id],
    );
    expect(noIcon.rows[0].c).toBe(0);
  });
});
