/**
 * Session auth: login, logout, whoami and the forced password change. Mounted at /api/auth and
 * reachable without a session - everything else under /api is gated in app.ts. The admin panel
 * routes hang off /api/auth/users in admin.ts.
 */
import { Router, type Response } from "express";
import * as db from "./db.js";
import { adminRouter } from "./admin.js";
import { clearSessionCookie, COOKIE, sessionUser } from "./session.js";

const COOKIE_MS = 30 * 24 * 3600 * 1000;

/** The shape login and /me share: who you are, whether you may manage users, and whether the
    password you just used has to be replaced first. */
function sessionBody(user: db.UserRow) {
  return {
    username: user.username,
    role: user.role,
    mustChangePassword: user.must_change_password === 1,
  };
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
    res.json(sessionBody(user));
  });

  router.post("/logout", (req, res) => {
    const cookie = (req.headers.cookie ?? "")
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE}=`));
    if (cookie) db.deleteSession(auth, cookie.slice(COOKIE.length + 1));
    clearSessionCookie(res as Response);
    res.status(204).end();
  });

  router.get("/me", (req, res) => {
    const user = sessionUser(auth, req);
    if (!user) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    res.json(sessionBody(user));
  });

  // A signed-in user whose password was reset by an admin lands here and stays until the
  // replacement is set. No current password to confirm: the temporary one already opened the
  // session, and it is the thing being thrown away.
  router.post("/change-password", (req, res) => {
    const user = sessionUser(auth, req);
    if (!user) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    const { password } = req.body as { password?: string };
    if (!password) {
      res.status(400).json({ error: "A password is required" });
      return;
    }
    db.changePassword(auth, user.id, password);
    res.status(204).end();
  });

  router.use("/users", adminRouter(auth));

  return router;
}
