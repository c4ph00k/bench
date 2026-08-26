/**
 * The session, from the server's side: the one cookie Bench sets, parsed by hand. Shared by the
 * auth routes, the admin router and the two gates in app.ts.
 */
import type { Request } from "express";
import * as db from "./db.js";

export const COOKIE = "bench.session";

/** The user the request's session cookie names, or null. */
export function sessionUser(auth: db.AuthDb, req: Request): db.UserRow | null {
  const cookie = (req.headers.cookie ?? "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`));
  if (!cookie) return null;
  return db.getSessionUser(auth, cookie.slice(COOKIE.length + 1));
}

export function clearSessionCookie(res: {
  clearCookie: (name: string, options: object) => unknown;
}): void {
  res.clearCookie(COOKIE, { path: "/" });
}
