/**
 * Auth store: one seeded user and the sessions that keep them signed in. One file, auth.sqlite,
 * because the gate is Bench-level, not app-level - none of the three app databases owns it.
 */
import Database from "better-sqlite3";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type AuthDb = Database.Database;

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
}

export function openDb(path: string): AuthDb {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
  `);
  return db;
}

/** salt:hash, both hex. scrypt needs no dependency and hashes in ~100ms at the default cost. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(
    password,
    Buffer.from(saltHex, "hex"),
    expected.length,
  );
  return timingSafeEqual(actual, expected);
}

export function userCount(db: AuthDb): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number })
    .n;
}

/** Seeds the one login the server has, on first run only. Returns whether it inserted. */
export function seedIfEmpty(
  db: AuthDb,
  username: string,
  password: string,
): boolean {
  if (userCount(db) > 0) return false;
  db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(
    username,
    hashPassword(password),
  );
  return true;
}

export function getUser(db: AuthDb, username: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username) as
    UserRow | undefined;
}

const SESSION_MS = 30 * 24 * 3600 * 1000;

export interface Session {
  token: string;
  expires_at: number;
}

export function createSession(db: AuthDb, userId: number): Session {
  // Login is also the one moment expired rows are worth sweeping; a cron per local app would be
  // machinery for a table that grows by one row a month.
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  const session: Session = {
    token: randomBytes(32).toString("hex"),
    expires_at: Date.now() + SESSION_MS,
  };
  db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
  ).run(session.token, userId, session.expires_at);
  return session;
}

export function getSessionUser(db: AuthDb, token: string): UserRow | null {
  return (
    (db
      .prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at >= ?`,
      )
      .get(token, Date.now()) as UserRow | undefined) ?? null
  );
}

export function deleteSession(db: AuthDb, token: string): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}
