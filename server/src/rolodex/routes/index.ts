/** Rolodex API: people, what you log about them, and the views over it. Mounted at /api/rolodex. */
import { Router } from "express";
import type { Pool } from "pg";
import { dashboardRouter } from "./dashboard.js";
import { importRouter } from "./import.js";
import { logRouter } from "./log.js";
import { peopleRouter } from "./people.js";

export function rolodexRouter(pool: Pool): Router {
  const router = Router();
  router.use(peopleRouter(pool));
  router.use(logRouter(pool));
  router.use(dashboardRouter(pool));
  router.use("/import", importRouter(pool));
  return router;
}
