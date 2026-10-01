/** The whole Express app around one Space database; the other apps get throwaway in-memory ones.
 *  The shared Postgres is left unseeded, which is the gate-off case. */
import type Database from "better-sqlite3";
import type express from "express";
import { createApp } from "../../src/app.js";
import { openDb as openRolodexDb } from "../../src/rolodex/db/index.js";
import { JWT_SECRET, testPool } from "../helpers/postgres.js";

export async function appWithSpace(
  space: Database.Database,
): Promise<express.Express> {
  return createApp({
    pool: await testPool(),
    jwtSecret: JWT_SECRET,
    dbs: {
      space,
      rolodex: openRolodexDb(":memory:"),
    },
  });
}
