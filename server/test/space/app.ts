/** The whole Express app around one Space database; the other apps get throwaway in-memory ones.
 *  The auth database is opened but left unseeded, which is the gate-off case. */
import type Database from "better-sqlite3";
import type express from "express";
import { createApp } from "../../src/app.js";
import { openDb as openCrmDb } from "../../src/crm/db.js";
import { openDb as openRolodexDb } from "../../src/rolodex/db/index.js";
import { openDb as openAuthDb } from "../../src/auth/db.js";

export function appWithSpace(space: Database.Database): express.Express {
  return createApp({
    crm: openCrmDb(":memory:"),
    space,
    rolodex: openRolodexDb(":memory:"),
    auth: openAuthDb(":memory:"),
  });
}
