/** Space API: pages, blocks, databases and search. Mounted at /api/space. */
import { Router } from "express";
import type { Pool } from "pg";
import { pagesRouter } from "./pages.js";
import { blocksRouter } from "./blocks.js";
import { databasesRouter } from "./databases.js";
import { searchRouter } from "./search.js";

export function spaceRouter(pool: Pool): Router {
  const router = Router();
  router.use(pagesRouter(pool));
  router.use(blocksRouter(pool));
  router.use(databasesRouter(pool));
  router.use(searchRouter(pool));
  return router;
}
