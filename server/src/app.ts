import express from "express";
import type Database from "better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crmRouter } from "./crm/routes.js";
import { spaceRouter } from "./space/routes/index.js";

const webDist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../web/dist",
);

/** The apps with their own HTML entry point in web/dist, for deep-link fallback. */
const APPS = ["crm", "space", "groove"];

export interface Dbs {
  crm: Database.Database;
  space: Database.Database;
}

/** Build the Express app around the open databases. */
export function createApp(dbs: Dbs): express.Express {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/crm", crmRouter(dbs.crm));
  app.use("/api/space", spaceRouter(dbs.space));

  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api")) return next();
      const owner = APPS.find(
        (name) => req.path === `/${name}` || req.path.startsWith(`/${name}/`),
      );
      res.sendFile(path.join(webDist, owner ?? "", "index.html"));
    });
  }
  return app;
}
