/** Rolodex API: people, what you log about them, and the views over it. Mounted at /api/rolodex. */
import { Router } from "express";
import type { Repo } from "../db/index.js";
import { dashboardRouter } from "./dashboard.js";
import { importRouter } from "./import.js";
import { logRouter } from "./log.js";
import { peopleRouter } from "./people.js";

export function rolodexRouter(repo: Repo): Router {
  const router = Router();
  router.use(peopleRouter(repo));
  router.use(logRouter(repo));
  router.use(dashboardRouter(repo));
  router.use("/import", importRouter(repo));
  return router;
}
