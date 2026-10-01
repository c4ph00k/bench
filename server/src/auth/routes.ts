/**
 * Session auth: login, logout, whoami and the forced password change. Mounted at /api/auth and
 * reachable without a session - everything else under /api is gated in app.ts. The admin panel
 * routes hang off /api/auth/users in admin.ts.
 */
import { Router, type Response } from "express";
import type { Pool } from "pg";
import * as db from "./db.js";
import { adminRouter } from "./admin.js";
import {
  COOKIE,
  clearSessionCookie,
  sessionUser,
  signSession,
} from "./session.js";

export interface AuthOptions {
  pool: Pool;
  jwtSecret: string;
  jwtTtl?: number;
}

const DEFAULT_TTL_SECONDS = 1800;
const TTL_MS = (ttl: number) => ttl * 1000;

/** The shape login and /me share: who you are, the role in their first membership (which decides
    whether the admin chrome shows), and whether the password in use has to be replaced. */
async function sessionBody(pool: Pool, user: db.UserRow) {
  return {
    email: user.email,
    role: await db.primaryRole(pool, user.id),
    mustChangePassword: user.must_change_password,
    masterAdmin: user.master_admin,
  };
}

export function authRouter(options: AuthOptions): Router {
  const { pool, jwtSecret, jwtTtl = DEFAULT_TTL_SECONDS } = options;
  const router = Router();

  router.post("/login", async (req, res) => {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };
    const user =
      email === undefined ? undefined : await db.getUserByEmail(pool, email);
    // One message for a wrong email and a wrong password alike, so the reply cannot be used to
    // probe which emails exist.
    if (
      !user ||
      password === undefined ||
      !db.verifyPassword(password, user.password_hash)
    ) {
      res.status(401).json({ error: "Wrong email or password" });
      return;
    }
    const token = await signSession(jwtSecret, user, jwtTtl);
    res.cookie(COOKIE, token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: TTL_MS(jwtTtl),
    });
    res.json(await sessionBody(pool, user));
  });

  router.post("/logout", async (req, res) => {
    const user = await sessionUser(pool, jwtSecret, req);
    if (user) await db.revokeTokens(pool, user.id);
    clearSessionCookie(res as Response);
    res.status(204).end();
  });

  router.get("/me", async (req, res) => {
    const user = await sessionUser(pool, jwtSecret, req);
    if (!user) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    res.json(await sessionBody(pool, user));
  });

  // A signed-in user whose password was reset lands here and stays until the replacement is set.
  // No current password to confirm: the temporary one already opened the session, and it is the
  // thing being thrown away.
  router.post("/change-password", async (req, res) => {
    const user = await sessionUser(pool, jwtSecret, req);
    if (!user) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    const { password } = req.body as { password?: string };
    if (!password) {
      res.status(400).json({ error: "A password is required" });
      return;
    }
    const updated = await db.changePassword(pool, user.id, password);
    if (!updated) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    // The version bump just invalidated this session; hand back a fresh token so the change does
    // not also sign the user out, while every other token for the account dies.
    const token = await signSession(jwtSecret, updated, jwtTtl);
    res.cookie(COOKIE, token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: TTL_MS(jwtTtl),
    });
    res.status(204).end();
  });

  router.use("/users", adminRouter({ pool, jwtSecret }));

  return router;
}
