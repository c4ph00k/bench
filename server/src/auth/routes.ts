/**
 * Session auth: login, logout, whoami. Mounted at /api/auth and reachable without a session -
 * everything else under /api is gated in app.ts.
 */
import { Router, type Request, type Response } from "express";
import * as db from "./db.js";

const COOKIE = "bench.session";
const COOKIE_MS = 30 * 24 * 3600 * 1000;

/** The user the request's session cookie names, or null. The one cookie Bench sets, parsed by hand. */
export function sessionUser(auth: db.AuthDb, req: Request): db.UserRow | null {
  const cookie = (req.headers.cookie ?? "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`));
  if (!cookie) return null;
  return db.getSessionUser(auth, cookie.slice(COOKIE.length + 1));
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE, { path: "/" });
}

export function authRouter(auth: db.AuthDb): Router {
  const router = Router();

  router.post("/login", (req, res) => {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };
    const user =
      username === undefined ? undefined : db.getUser(auth, username);
    // One message for a wrong username and a wrong password alike, so the reply cannot be used
    // to probe which usernames exist.
    if (
      !user ||
      password === undefined ||
      !db.verifyPassword(password, user.password_hash)
    ) {
      res.status(401).json({ error: "Wrong username or password" });
      return;
    }
    const session = db.createSession(auth, user.id);
    res.cookie(COOKIE, session.token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: COOKIE_MS,
    });
    res.json({ username: user.username });
  });

  router.post("/logout", (req, res) => {
    const cookie = (req.headers.cookie ?? "")
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE}=`));
    if (cookie) db.deleteSession(auth, cookie.slice(COOKIE.length + 1));
    clearSessionCookie(res);
    res.status(204).end();
  });

  router.get("/me", (req, res) => {
    const user = sessionUser(auth, req);
    if (!user) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    res.json({ username: user.username });
  });

  return router;
}
