/** Space API: pages, blocks, databases and search. Mounted at /api/space. */
import { Router } from "express";
import { pagesRouter } from "./pages.js";
import { blocksRouter } from "./blocks.js";
import { databasesRouter } from "./databases.js";
import { searchRouter } from "./search.js";

export function spaceRouter(): Router {
  const router = Router();
  router.use(pagesRouter());
  router.use(blocksRouter());
  router.use(databasesRouter());
  router.use(searchRouter());
  return router;
}
