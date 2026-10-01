/**
 * The session, from the server's side: one JWT named by provider cookie, signed with a secret that
 * lives in .env. The token names the user, not a tenant; authorization is resolved against the
 * memberships on every request, so a token alone grants no access to anything.
 */
import { SignJWT, jwtVerify } from "jose";
import type { Request } from "express";
import type { Pool } from "pg";
import { getUserById, type UserRow } from "./db.js";

export const COOKIE = "bench.session";

function signingKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSession(
  secret: string,
  user: { id: number; token_version: number },
  ttlSeconds: number,
): Promise<string> {
  return new SignJWT({ tv: user.token_version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(signingKey(secret));
}

/**
 * The user the request's session cookie names, or null. The token's `token_version` must match the
 * stored one, so a password change or reset revokes every previously issued token at once.
 */
export async function sessionUser(
  pool: Pool,
  secret: string,
  req: Request,
): Promise<UserRow | null> {
  const cookie = (req.headers.cookie ?? "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`));
  if (!cookie) return null;
  const token = cookie.slice(COOKIE.length + 1);
  let subject: string | undefined;
  let tokenVersion: unknown;
  try {
    const { payload } = await jwtVerify(token, signingKey(secret));
    subject = payload.sub;
    tokenVersion = payload.tv;
  } catch {
    return null;
  }
  if (subject === undefined || typeof tokenVersion !== "number") return null;
  const user = await getUserById(pool, Number(subject));
  if (user?.token_version !== tokenVersion) return null;
  return user;
}

export function clearSessionCookie(res: {
  clearCookie: (name: string, options: object) => unknown;
}): void {
  res.clearCookie(COOKIE, { path: "/" });
}
