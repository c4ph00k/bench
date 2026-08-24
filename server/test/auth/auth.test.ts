/**
 * The gate: /api/auth itself, the 401 every other /api route answers without a session, the
 * /login redirect every page answers without one, and the password hashing underneath. The whole
 * app is built around a seeded auth database, unlike the per-app suites whose unseeded one is the
 * gate-off case.
 */
import { describe, expect, it } from "vitest";
import request from "supertest";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../../src/app.js";
import { openDb as openCrmDb } from "../../src/crm/db.js";
import { openDb as openSpaceDb } from "../../src/space/db.js";
import { openDb as openRolodexDb } from "../../src/rolodex/db/index.js";
import * as auth from "../../src/auth/db.js";

const USER = { username: "marco", password: "bench" };

function seededApp() {
  const db = auth.openDb(":memory:");
  auth.seedIfEmpty(db, USER.username, USER.password);
  return createApp({
    crm: openCrmDb(":memory:"),
    space: openSpaceDb(":memory:"),
    rolodex: openRolodexDb(":memory:"),
    auth: db,
  });
}

/** Login once and return the cookie that came back, for requests that should pass the gate. */
async function sessionCookie(
  app: ReturnType<typeof seededApp>,
): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username: USER.username, password: USER.password });
  return res.headers["set-cookie"][0].split(";")[0];
}

// The page gate only mounts when web/dist exists, which is app.ts's own condition - a fresh
// clone before its first build has no dist, and these two would 404. `npm run e2e` builds it.
const webDist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../web/dist",
);

describe("password hashing", () => {
  it("round-trips a password and rejects a wrong one", () => {
    const stored = auth.hashPassword("bench");
    expect(auth.verifyPassword("bench", stored)).toBe(true);
    expect(auth.verifyPassword("beach", stored)).toBe(false);
  });

  it("salts every hash, so two storages of one password differ", () => {
    expect(auth.hashPassword("bench")).not.toBe(auth.hashPassword("bench"));
  });
});

describe("sessions in the database", () => {
  it("finds the user a live token belongs to", () => {
    const db = auth.openDb(":memory:");
    auth.seedIfEmpty(db, USER.username, USER.password);
    const user = auth.getUser(db, USER.username)!;
    const session = auth.createSession(db, user.id);
    expect(auth.getSessionUser(db, session.token)?.username).toBe(
      USER.username,
    );
    auth.deleteSession(db, session.token);
    expect(auth.getSessionUser(db, session.token)).toBeNull();
  });

  it("refuses an expired token", () => {
    const db = auth.openDb(":memory:");
    auth.seedIfEmpty(db, USER.username, USER.password);
    const user = auth.getUser(db, USER.username)!;
    // A row already in the past, rather than a clock fudge or a configurable lifetime.
    db.prepare(
      "INSERT INTO sessions (token, user_id, expires_at) VALUES ('tok', ?, 0)",
    ).run(user.id);
    expect(auth.getSessionUser(db, "tok")).toBeNull();
  });

  it("seeds once and never twice", () => {
    const db = auth.openDb(":memory:");
    expect(auth.seedIfEmpty(db, USER.username, USER.password)).toBe(true);
    expect(auth.seedIfEmpty(db, "other", "other")).toBe(false);
    expect(auth.userCount(db)).toBe(1);
  });
});

describe("/api/auth", () => {
  it("answers 401 with one message for a wrong password and a wrong username alike", async () => {
    const app = seededApp();
    const badPassword = await request(app)
      .post("/api/auth/login")
      .send({ username: USER.username, password: "nope" });
    expect(badPassword.status).toBe(401);
    const badUsername = await request(app)
      .post("/api/auth/login")
      .send({ username: "nobody", password: USER.password });
    expect(badUsername.status).toBe(401);
    expect(badUsername.body).toEqual(badPassword.body);
  });

  it("signs in with an HttpOnly cookie and names the user back", async () => {
    const app = seededApp();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: USER.username, password: USER.password });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ username: USER.username });
    expect(res.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(res.headers["set-cookie"][0]).toContain("bench.session=");
  });

  it("says who is signed in, and 401 when nobody is", async () => {
    const app = seededApp();
    const cookie = await sessionCookie(app);
    const signedIn = await request(app)
      .get("/api/auth/me")
      .set("Cookie", cookie);
    expect(signedIn.status).toBe(200);
    expect(signedIn.body).toEqual({ username: USER.username });
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
  });

  it("ends the session on logout", async () => {
    const app = seededApp();
    const cookie = await sessionCookie(app);
    expect(
      (await request(app).get("/api/auth/me").set("Cookie", cookie)).status,
    ).toBe(200);
    expect(
      (await request(app).post("/api/auth/logout").set("Cookie", cookie))
        .status,
    ).toBe(204);
    expect(
      (await request(app).get("/api/auth/me").set("Cookie", cookie)).status,
    ).toBe(401);
  });
});

describe("the API gate", () => {
  it("answers 401 from an app route without a session", async () => {
    const app = seededApp();
    const res = await request(app).get("/api/crm/organizations");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Not signed in" });
  });

  it("lets an app route through with a session", async () => {
    const app = seededApp();
    const cookie = await sessionCookie(app);
    const res = await request(app)
      .get("/api/crm/organizations")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("gates nothing when no user exists, which is how the app suites run", async () => {
    const app = createApp({
      crm: openCrmDb(":memory:"),
      space: openSpaceDb(":memory:"),
      rolodex: openRolodexDb(":memory:"),
      auth: auth.openDb(":memory:"),
    });
    expect((await request(app).get("/api/crm/organizations")).status).toBe(200);
  });
});

describe.skipIf(!existsSync(webDist))("the page gate", () => {
  it("redirects a page without a session to the login document", async () => {
    const app = seededApp();
    const res = await request(app).get("/crm/contacts");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login/");
  });

  it("serves the login document without a session, under either form of the path", async () => {
    const app = seededApp();
    // /login is a directory in dist, so static answers it with a 301 to /login/ - not a loop,
    // because the gate lets the whole /login prefix through.
    expect((await request(app).get("/login")).status).toBe(301);
    expect((await request(app).get("/login/")).status).toBe(200);
  });
});
