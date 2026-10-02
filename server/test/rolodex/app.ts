/** The whole Express app around one Rolodex repo; Space and CRM run on the shared Postgres.
 *  The shared Postgres is left unseeded, which is the gate-off case. */
import type express from "express";
import { createApp } from "../../src/app.js";
import type { Repo } from "../../src/rolodex/db/index.js";
import { JWT_SECRET, testPool } from "../helpers/postgres.js";

export async function appWithRolodex(rolodex: Repo): Promise<express.Express> {
  return createApp({
    pool: await testPool(),
    jwtSecret: JWT_SECRET,
    dbs: { rolodex },
  });
}
