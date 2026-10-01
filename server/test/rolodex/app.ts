/** The whole Express app around one Rolodex repo; the other apps get throwaway in-memory ones.
 *  The shared Postgres is left unseeded, which is the gate-off case. */
import type express from "express";
import { createApp } from "../../src/app.js";
import { openDb as openSpaceDb } from "../../src/space/db.js";
import type { Repo } from "../../src/rolodex/db/index.js";
import { JWT_SECRET, testPool } from "../helpers/postgres.js";

export async function appWithRolodex(rolodex: Repo): Promise<express.Express> {
  return createApp({
    pool: await testPool(),
    jwtSecret: JWT_SECRET,
    dbs: {
      space: openSpaceDb(":memory:"),
      rolodex,
    },
  });
}
