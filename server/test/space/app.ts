/** The whole Express app around one Space database; the other apps get throwaway in-memory ones. */
import type Database from "better-sqlite3";
import type express from "express";
import { createApp } from "../../src/app.js";
import { openDb as openCrmDb } from "../../src/crm/db.js";
import { openDb as openRolodexDb } from "../../src/rolodex/db/index.js";

export function appWithSpace(space: Database.Database): express.Express {
  return createApp({
    crm: openCrmDb(":memory:"),
    space,
    rolodex: openRolodexDb(":memory:"),
  });
}
