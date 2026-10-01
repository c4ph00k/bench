/**
 * The admin panel's surface: member management behind an admin/owner-only check, the last-owner
 * guard, and the forced password change that a reset or a fresh account walks a user through.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Pool } from "pg";
import { createApp } from "../../src/app.js";
import { openDb as openSpaceDb } from "../../src/space/db.js";
import { openDb as openRolodexDb } from "../../src/rolodex/db/index.js";
import type { PublicUser } from "../../src/auth/db.js";
import {
  JWT_SECRET,
  SEED_EMAIL,
  SEED_PASSWORD,
  resetAuth,
  seedAuth,
  testPool,
} from "../helpers/postgres.js";

const PASSWORD = {
  admin: SEED_PASSWORD,
  starting: "lemons",
  own: "plums",
  reset: "peaches",
} as const;

let pool: Pool;

beforeAll(async () => {
  pool = await testPool();
});

beforeEach(async () => {
  await resetAuth(pool);
});

function makeApp() {
  return createApp({
    pool,
    jwtSecret: JWT_SECRET,
    dbs: {
      space: openSpaceDb(":memory:"),
      rolodex: openRolodexDb(":memory:"),
    },
  });
}

async function seededApp() {
  await seedAuth(pool);
  return makeApp();
}

function bodyAs<T>(res: { body: unknown }): T {
  return res.body as T;
}

async function loginAs(
  app: ReturnType<typeof makeApp>,
  email: string,
  password: string,
): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password });
  return res.headers["set-cookie"][0].split(";")[0];
}

async function createUser(
  app: ReturnType<typeof makeApp>,
  adminCookie: string,
  body: { email: string; password: string; role?: string },
) {
  const res = await request(app)
    .post("/api/auth/users")
    .set("Cookie", adminCookie)
    .send(body);
  return { status: res.status, body: bodyAs<PublicUser>(res) };
}

const LUCA = { email: "luca@example.com", password: PASSWORD.starting };

describe("/api/auth/users", () => {
  it("answers 401 to an outsider and 403 to a plain user", async () => {
    const app = await seededApp();
    expect((await request(app).get("/api/auth/users")).status).toBe(401);

    const adminCookie = await loginAs(app, SEED_EMAIL, PASSWORD.admin);
    await createUser(app, adminCookie, { ...LUCA, role: "user" });
    const lucaCookie = await loginAs(app, LUCA.email, PASSWORD.starting);
    expect(
      (await request(app).get("/api/auth/users").set("Cookie", lucaCookie))
        .status,
    ).toBe(403);
  });

  it("adds a member, names the duplicate, and lets an admin change a role", async () => {
    const app = await seededApp();
    const cookie = await loginAs(app, SEED_EMAIL, PASSWORD.admin);

    const created = await createUser(app, cookie, { ...LUCA, role: "user" });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({
      id: created.body.id,
      email: LUCA.email,
      role: "user",
      mustChangePassword: true,
    });

    expect(
      (await request(app).get("/api/auth/users").set("Cookie", cookie)).body,
    ).toHaveLength(2);

    expect(
      (
        await createUser(app, cookie, {
          email: LUCA.email,
          password: PASSWORD.reset,
          role: "user",
        })
      ).status,
    ).toBe(409);

    const promoted = await request(app)
      .patch(`/api/auth/users/${created.body.id}`)
      .set("Cookie", cookie)
      .send({ role: "admin" });
    expect(promoted.status).toBe(200);
    expect(bodyAs<PublicUser>(promoted).role).toBe("admin");
  });

  it("guards the last owner from demotion and an account from self-deletion", async () => {
    const app = await seededApp();
    const cookie = await loginAs(app, SEED_EMAIL, PASSWORD.admin);
    const owner = bodyAs<PublicUser[]>(
      await request(app).get("/api/auth/users").set("Cookie", cookie),
    )[0];

    const demote = await request(app)
      .patch(`/api/auth/users/${owner.id}`)
      .set("Cookie", cookie)
      .send({ role: "user" });
    expect(demote.status).toBe(403);
    expect(bodyAs<{ error: string }>(demote).error).toBe(
      "The last owner cannot be demoted",
    );

    const remove = await request(app)
      .delete(`/api/auth/users/${owner.id}`)
      .set("Cookie", cookie);
    expect(remove.status).toBe(403);
    expect(bodyAs<{ error: string }>(remove).error).toBe(
      "You cannot delete your own account",
    );
  });

  it("lets an admin delete a member, which revokes their token", async () => {
    const app = await seededApp();
    const cookie = await loginAs(app, SEED_EMAIL, PASSWORD.admin);
    const created = await createUser(app, cookie, { ...LUCA, role: "user" });
    const lucaCookie = await loginAs(app, LUCA.email, PASSWORD.starting);
    expect(
      (await request(app).get("/api/auth/me").set("Cookie", lucaCookie)).status,
    ).toBe(200);

    expect(
      (
        await request(app)
          .delete(`/api/auth/users/${created.body.id}`)
          .set("Cookie", cookie)
      ).status,
    ).toBe(204);

    expect(
      (await request(app).get("/api/auth/me").set("Cookie", lucaCookie)).status,
    ).toBe(401);
  });
});

describe("the forced password change", () => {
  it("holds a fresh account at the change page, then lets it through once changed", async () => {
    const app = await seededApp();
    const cookie = await loginAs(app, SEED_EMAIL, PASSWORD.admin);
    await createUser(app, cookie, { ...LUCA, role: "user" });

    const firstLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: LUCA.email, password: PASSWORD.starting });
    expect(bodyAs<PublicUser>(firstLogin).mustChangePassword).toBe(true);
    const lucaCookie = firstLogin.headers["set-cookie"][0].split(";")[0];

    expect(
      (
        await request(app)
          .get("/api/crm/organizations")
          .set("Cookie", lucaCookie)
      ).status,
    ).toBe(403);

    const change = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", lucaCookie)
      .send({ password: PASSWORD.own });
    expect(change.status).toBe(204);
    const renewedCookie = change.headers["set-cookie"][0].split(";")[0];

    expect(
      (
        await request(app)
          .get("/api/crm/organizations")
          .set("Cookie", renewedCookie)
      ).status,
    ).toBe(200);

    const nextLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: LUCA.email, password: PASSWORD.own });
    expect(bodyAs<PublicUser>(nextLogin).mustChangePassword).toBe(false);
  });

  it("forces a change after an admin resets a password", async () => {
    const app = await seededApp();
    const adminCookie = await loginAs(app, SEED_EMAIL, PASSWORD.admin);
    const created = await createUser(app, adminCookie, {
      ...LUCA,
      role: "user",
    });
    // Walk the fresh account through its own forced change first.
    const luca = await request(app)
      .post("/api/auth/login")
      .send({ email: LUCA.email, password: PASSWORD.starting });
    const lucaCookie = luca.headers["set-cookie"][0].split(";")[0];
    await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", lucaCookie)
      .send({ password: PASSWORD.own });

    expect(
      (
        await request(app)
          .post(`/api/auth/users/${created.body.id}/reset-password`)
          .set("Cookie", adminCookie)
          .send({ password: PASSWORD.reset })
      ).status,
    ).toBe(204);

    const relogin = await request(app)
      .post("/api/auth/login")
      .send({ email: LUCA.email, password: PASSWORD.reset });
    expect(relogin.status).toBe(200);
    expect(bodyAs<PublicUser>(relogin).mustChangePassword).toBe(true);
  });
});
