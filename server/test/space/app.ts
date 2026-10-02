/** A fresh Space tenant for one test, seeded with the showcase workspace, exposed as an Express
 *  app plus the pool for any teardown. Rolodex still opens a throwaway in-memory handle so the
 *  app can mount it; the space suites never touch /api/rolodex. */
import { beforeAll } from "vitest";
import request from "supertest";
import type express from "express";
import type { Pool } from "pg";
import { createApp } from "../../src/app.js";
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

export async function appWithSpace(): Promise<express.Express> {
  await resetAuth(pool);
  await seedAuth(pool);
  return createApp({
    pool,
    jwtSecret: JWT_SECRET,
  });
}

/** Sign in and return the session cookie, so gated /api/space routes resolve a tenant. */
export async function sessionCookie(app: express.Express): Promise<string> {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email: SEED_EMAIL, password: SEED_PASSWORD });
  return res.headers["set-cookie"][0].split(";")[0];
}
