import { beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { EventEmitter } from "node:events";
import type { Response } from "express";
import { createPool } from "../../src/db/pool.js";
import { openTenantConnection } from "../../src/db/rls.js";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { seed as seedCrm } from "../../src/crm/seed.js";
import {
  JWT_SECRET,
  SEED_EMAIL,
  SEED_PASSWORD,
  resetAuth,
  seedAuth,
  testPool,
} from "../helpers/postgres.js";

let pool: Pool;

beforeAll(async () => {
  pool = await testPool();
});

describe("row-level security", () => {
  it("makes a successful write visible to the next request even when commit is slow", async () => {
    await resetAuth(pool);
    await seedAuth(pool);
    await pool.query(`
      CREATE FUNCTION delay_organization_commit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_sleep(0.2); RETURN NEW; END $$;
      CREATE CONSTRAINT TRIGGER delayed_commit AFTER INSERT OR DELETE ON organizations
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION delay_organization_commit();
    `);
    try {
      const app = createApp({ pool, jwtSecret: JWT_SECRET });
      const login = await request(app)
        .post("/api/auth/login")
        .send({ email: SEED_EMAIL, password: SEED_PASSWORD });
      const cookie = login.headers["set-cookie"][0].split(";")[0];
      const created = await request(app)
        .post("/api/crm/organizations")
        .set("Cookie", cookie)
        .send({ name: "Committed organization" });
      expect(created.status).toBe(201);
      const listed = await request(app)
        .get("/api/crm/organizations")
        .set("Cookie", cookie);
      expect(listed.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "Committed organization" }),
        ]),
      );
      const id = (created.body as { id: number }).id;
      const deleted = await request(app)
        .delete(`/api/crm/organizations/${id}`)
        .set("Cookie", cookie);
      expect(deleted.status).toBe(204);
      const afterDelete = await request(app)
        .get("/api/crm/organizations")
        .set("Cookie", cookie);
      expect(afterDelete.body).toEqual([]);
    } finally {
      await pool.query(
        "DROP TRIGGER delayed_commit ON organizations; DROP FUNCTION delay_organization_commit()",
      );
    }
  });

  it("releases the connection when the response closes during transaction setup", async () => {
    const isolated = createPool({
      connectionString: pool.options.connectionString,
      max: 1,
    });
    const held = await isolated.connect();
    const response = Object.assign(new EventEmitter(), {
      locals: {},
      statusCode: 200,
      destroyed: false,
    });
    const opening = openTenantConnection(
      isolated,
      response as unknown as Response,
      1,
    );
    response.destroyed = true;
    response.emit("close");
    held.release();
    try {
      await opening;
      await expect.poll(() => isolated.idleCount, { timeout: 1000 }).toBe(1);
    } finally {
      // Also release the old implementation's leaked connection when this regression fails.
      response.emit("close");
      await isolated.end();
    }
  });

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
