/** The whole Express app around one Rolodex repo; the other apps get throwaway in-memory ones. */
import type express from "express";
import { createApp } from "../../src/app.js";
import { openDb as openCrmDb } from "../../src/crm/db.js";
import { openDb as openSpaceDb } from "../../src/space/db.js";
import type { Repo } from "../../src/rolodex/db/index.js";

export function appWithRolodex(rolodex: Repo): express.Express {
  return createApp({
    crm: openCrmDb(":memory:"),
    space: openSpaceDb(":memory:"),
    rolodex,
  });
}
