/**
 * The gate: /api/auth itself, the 401 every other /api route answers without a session, the
 * /login redirect every page answers without one, and the password hashing underneath. The whole
 * app is built around a seeded auth database, unlike the per-app suites whose unseeded one is the
 * gate-off case.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import { createApp } from "../../src/app.js";
import * as auth from "../../src/auth/db.js";
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

beforeEach(async () => {
  await resetAuth(pool);
});

function makeApp() {
  return createApp({
    pool,
    jwtSecret: JWT_SECRET,
  });
}

async function seededApp() {
  await seedAuth(pool);
  return makeApp();
}

/** Login once and return the cookie that came back, for requests that should pass the gate. */
async function sessionCookie(app: ReturnType<typeof makeApp>): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: SEED_EMAIL, password: SEED_PASSWORD });
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

describe("token revokation", () => {
  it("revokes every prior token once the password changes", async () => {
    const app = await seededApp();
    const oldCookie = await sessionCookie(app);

    const change = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", oldCookie)
      .send({ password: "honeydew" });
    expect(change.status).toBe(204);
    const newCookie = change.headers["set-cookie"][0].split(";")[0];

    expect(
      (await request(app).get("/api/auth/me").set("Cookie", oldCookie)).status,
    ).toBe(401);
    expect(
      (await request(app).get("/api/auth/me").set("Cookie", newCookie)).status,
    ).toBe(200);
  });
});

describe("/api/auth", () => {
  it("answers 401 with one message for a wrong password and a wrong email alike", async () => {
    const app = await seededApp();
    const badPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: SEED_EMAIL, password: "nope" });
    expect(badPassword.status).toBe(401);
    const badEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: SEED_PASSWORD });
    expect(badEmail.status).toBe(401);
    expect(badEmail.body).toEqual(badPassword.body);
  });

  it("signs in with an HttpOnly cookie and names the user back", async () => {
    const app = await seededApp();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: SEED_EMAIL, password: SEED_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      email: SEED_EMAIL,
      role: "owner",
      mustChangePassword: false,
      masterAdmin: true,
    });
    expect(res.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(res.headers["set-cookie"][0]).toContain("bench.session=");
  });

  it("says who is signed in, and 401 when nobody is", async () => {
    const app = await seededApp();
    const cookie = await sessionCookie(app);
    const signedIn = await request(app)
      .get("/api/auth/me")
      .set("Cookie", cookie);
    expect(signedIn.status).toBe(200);
    expect(signedIn.body).toEqual({
      email: SEED_EMAIL,
      role: "owner",
      mustChangePassword: false,
      masterAdmin: true,
    });
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
  });

  it("ends the session on logout", async () => {
    const app = await seededApp();
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
    const app = await seededApp();
    const res = await request(app).get("/api/crm/organizations");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Not signed in" });
  });

  it("lets an app route through with a session", async () => {
    const app = await seededApp();
    const cookie = await sessionCookie(app);
    const res = await request(app)
      .get("/api/crm/organizations")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
  });
});

describe.skipIf(!existsSync(webDist))("the page gate", () => {
  it("redirects a page without a session to the login document", async () => {
    const app = await seededApp();
    const res = await request(app).get("/crm/contacts");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login/");
  });

  it("serves the login document without a session, under either form of the path", async () => {
    const app = await seededApp();
    // /login is a directory in dist, so static answers it with a 301 to /login/ - not a loop,
    // because the gate lets the whole /login prefix through.
    expect((await request(app).get("/login")).status).toBe(301);
    expect((await request(app).get("/login/")).status).toBe(200);
  });
});
