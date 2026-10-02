/**
 * The rolodex data layer. One repo object composed from a module per table, so a caller sees
 * `repo.createGift(...)` without any of them knowing about the others. The repo is bound to a
 * queryable (the shared pool, or a transaction's client) and to the tenant every row belongs to.
 */
import type { Pool, PoolClient } from "pg";
import { connectionsRepo, type ConnectionsRepo } from "./connections.js";
import { logRepo, type LogRepo } from "./log.js";
import { peopleRepo, type PeopleRepo } from "./people.js";
import { remindersRepo, type RemindersRepo } from "./reminders.js";
import { timelineRepo, type TimelineRepo } from "./timeline.js";

export type Queryable = Pool | PoolClient;

export interface Repo
  extends PeopleRepo, LogRepo, RemindersRepo, ConnectionsRepo, TimelineRepo {}

export function createRepo(db: Queryable, tenantId: number): Repo {
  return {
    ...peopleRepo(db, tenantId),
    ...logRepo(db, tenantId),
    ...remindersRepo(db, tenantId),
    ...connectionsRepo(db, tenantId),
    ...timelineRepo(db, tenantId),
  };
}
