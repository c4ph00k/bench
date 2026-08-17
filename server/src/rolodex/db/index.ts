/**
 * The rolodex data layer. One repo object composed from a module per table, so a caller sees
 * `repo.createGift(...)` without any of them knowing about the others.
 */
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema.js";
import { connectionsRepo, type ConnectionsRepo } from "./connections.js";
import { logRepo, type LogRepo } from "./log.js";
import { peopleRepo, type PeopleRepo } from "./people.js";
import { remindersRepo, type RemindersRepo } from "./reminders.js";
import { timelineRepo, type TimelineRepo } from "./timeline.js";
import type { DB } from "./rows.js";

export interface Repo
  extends PeopleRepo, LogRepo, RemindersRepo, ConnectionsRepo, TimelineRepo {
  db: DB;
  close(): void;
}

function createRepo(db: DB): Repo {
  db.exec(SCHEMA);
  return {
    db,
    close: () => {
      db.close();
    },
    ...peopleRepo(db),
    ...logRepo(db),
    ...remindersRepo(db),
    ...connectionsRepo(db),
    ...timelineRepo(db),
  };
}

export function openDb(dbPath: string): Repo {
  if (dbPath !== ":memory:")
    mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return createRepo(db);
}
