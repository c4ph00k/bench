/** Rolodex API: people, what you log about them, and the views over it. Mounted at /api/rolodex. */
import { Router } from "express";
import { dashboardRouter } from "./dashboard.js";
import { importRouter } from "./import.js";
import { logRouter } from "./log.js";
import { peopleRouter } from "./people.js";

export function rolodexRouter(): Router {
  const router = Router();
  router.use(peopleRouter());
  router.use(logRouter());
  router.use(dashboardRouter());
  router.use("/import", importRouter());
  return router;
}
