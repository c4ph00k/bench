/**
 * The admin panel's surface: user management behind an admin-only check, the last-admin guard,
 * and the forced password change that a reset or a fresh account walks a user through.
 */
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { openDb as openCrmDb } from "../../src/crm/db.js";
import { openDb as openSpaceDb } from "../../src/space/db.js";
import { openDb as openRolodexDb } from "../../src/rolodex/db/index.js";
import * as auth from "../../src/auth/db.js";

const PASSWORD = {
  admin: "bench",
  starting: "lemons",
  own: "plums",
  reset: "peaches",
} as const;

function seededApp() {
  const db = auth.openDb(":memory:");
  auth.seedIfEmpty(db, "marco", PASSWORD.admin);
  return createApp({
    crm: openCrmDb(":memory:"),
    space: openSpaceDb(":memory:"),
    rolodex: openRolodexDb(":memory:"),
    auth: db,
  });
}

/** supertest hands back an `any` body; the cast names what each route really returns. */
function bodyAs<T>(res: { body: unknown }): T {
  return res.body as T;
}

async function loginAs(
  app: ReturnType<typeof seededApp>,
  username: string,
  password: string,
): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password });
  return res.headers["set-cookie"][0].split(";")[0];
}

async function createUser(
  app: ReturnType<typeof seededApp>,
  adminCookie: string,
  body: { username: string; password: string; role?: string },
) {
  const res = await request(app)
    .post("/api/auth/users")
    .set("Cookie", adminCookie)
    .send(body);
  return { status: res.status, body: bodyAs<auth.PublicUser>(res) };
}

const LUCA_ADMIN_PATCH = { username: "luca", password: PASSWORD.starting };

describe("/api/auth/users", () => {
  it("answers 401 to an outsider and 403 to a plain user", async () => {
    const app = seededApp();
    expect((await request(app).get("/api/auth/users")).status).toBe(401);

    const adminCookie = await loginAs(app, "marco", PASSWORD.admin);
    await createUser(app, adminCookie, { ...LUCA_ADMIN_PATCH, role: "user" });
    const lucaCookie = await loginAs(app, "luca", PASSWORD.starting);
    expect(
      (await request(app).get("/api/auth/users").set("Cookie", lucaCookie))
        .status,
    ).toBe(403);
  });

  it("adds a user, names the duplicate, and lets an admin change a role", async () => {
    const app = seededApp();
    const cookie = await loginAs(app, "marco", PASSWORD.admin);

    const created = await createUser(app, cookie, {
      ...LUCA_ADMIN_PATCH,
      role: "user",
    });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({
      id: created.body.id,
      username: "luca",
      role: "user",
      mustChangePassword: true,
    });

    expect(
      (await request(app).get("/api/auth/users").set("Cookie", cookie)).body,
    ).toHaveLength(2);

    expect(
      (
        await createUser(app, cookie, {
          username: "luca",
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
    expect(bodyAs<auth.PublicUser>(promoted).role).toBe("admin");
  });

  it("guards the last admin from demotion and their own account from deletion", async () => {
    const app = seededApp();
    const cookie = await loginAs(app, "marco", PASSWORD.admin);

    const demote = await request(app)
      .patch("/api/auth/users/1")
      .set("Cookie", cookie)
      .send({ role: "user" });
    expect(demote.status).toBe(403);
    expect(bodyAs<{ error: string }>(demote).error).toBe(
      "The last admin cannot be demoted",
    );

    const remove = await request(app)
      .delete("/api/auth/users/1")
      .set("Cookie", cookie);
    expect(remove.status).toBe(403);
    expect(bodyAs<{ error: string }>(remove).error).toBe(
      "You cannot delete your own account",
    );
  });

  it("protects the seeded marco from deletion and renaming, even as another admin", async () => {
    const app = seededApp();
    const marcoCookie = await loginAs(app, "marco", PASSWORD.admin);
    await createUser(app, marcoCookie, {
      username: "luca",
      password: PASSWORD.starting,
      role: "admin",
    });
    // luca signs in with the temporary password, replaces it, and is then a full admin.
    const luca = await request(app)
      .post("/api/auth/login")
      .send({ username: "luca", password: PASSWORD.starting });
    const lucaCookie = luca.headers["set-cookie"][0].split(";")[0];
    await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", lucaCookie)
      .send({ password: PASSWORD.own });

    const remove = await request(app)
      .delete("/api/auth/users/1")
      .set("Cookie", lucaCookie);
    expect(remove.status).toBe(403);
    expect(bodyAs<{ error: string }>(remove).error).toBe(
      "marco is the seeded admin and cannot be deleted",
    );

    const rename = await request(app)
      .patch("/api/auth/users/1")
      .set("Cookie", lucaCookie)
      .send({ username: "sandro" });
    expect(rename.status).toBe(403);
    expect(bodyAs<{ error: string }>(rename).error).toBe(
      "marco is the seeded admin and cannot be renamed",
    );
  });

  it("deletes a user and their sessions with it", async () => {
    const app = seededApp();
    const cookie = await loginAs(app, "marco", PASSWORD.admin);
    const created = await createUser(app, cookie, {
      ...LUCA_ADMIN_PATCH,
      role: "user",
    });
    const lucaCookie = await loginAs(app, "luca", PASSWORD.starting);
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
    const app = seededApp();
    const cookie = await loginAs(app, "marco", PASSWORD.admin);
    await createUser(app, cookie, { ...LUCA_ADMIN_PATCH, role: "user" });

    const firstLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: "luca", password: PASSWORD.starting });
    expect(bodyAs<auth.PublicUser>(firstLogin).mustChangePassword).toBe(true);
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

    expect(
      (
        await request(app)
          .get("/api/crm/organizations")
          .set("Cookie", lucaCookie)
      ).status,
    ).toBe(200);

    const nextLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: "luca", password: PASSWORD.own });
    expect(bodyAs<auth.PublicUser>(nextLogin).mustChangePassword).toBe(false);
  });

  it("forces a change after an admin resets a password", async () => {
    const app = seededApp();
    const adminCookie = await loginAs(app, "marco", PASSWORD.admin);
    const created = await createUser(app, adminCookie, {
      ...LUCA_ADMIN_PATCH,
      role: "user",
    });
    // Walk the fresh account through its own forced change first.
    const luca = await request(app)
      .post("/api/auth/login")
      .send({ username: "luca", password: PASSWORD.starting });
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
      .send({ username: "luca", password: PASSWORD.reset });
    expect(relogin.status).toBe(200);
    expect(bodyAs<auth.PublicUser>(relogin).mustChangePassword).toBe(true);
  });
});
