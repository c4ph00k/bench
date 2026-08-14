/** Space API: pages, blocks, databases and search. Mounted at /api/space. */
import { Router } from "express";
import type Database from "better-sqlite3";
import { pagesRouter } from "./pages.js";
import { blocksRouter } from "./blocks.js";
import { databasesRouter } from "./databases.js";
import { searchRouter } from "./search.js";

export function spaceRouter(db: Database.Database): Router {
  const router = Router();
  router.use(pagesRouter(db));
  router.use(blocksRouter(db));
  router.use(databasesRouter(db));
  router.use(searchRouter(db));
  return router;
}
