import express from "express";
import type { Pool } from "pg";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crmRouter } from "./crm/routes.js";
import { rolodexRouter } from "./rolodex/routes/index.js";
import type { Repo } from "./rolodex/db/index.js";
import { spaceRouter } from "./space/routes/index.js";
import { authRouter } from "./auth/routes.js";
import { sessionUser } from "./auth/session.js";
import { userCount } from "./auth/db.js";
import { resolveTenant } from "./tenant.js";

const webDist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../web/dist",
);

/** The apps with their own HTML entry point in web/dist, for deep-link fallback. */
const APPS = ["crm", "space", "rolodex", "admin", "change-password"];

interface Dbs {
  rolodex: Repo;
}

export interface AppOptions {
  pool: Pool;
  jwtSecret: string;
  jwtTtl?: number;
  dbs: Dbs;
}

/**
 * Build the Express app around the shared Postgres pool. CRM and Space have moved there, alongside
 * auth; Rolodex hands its old SQLite handle until its own port lands.
 */
export function createApp(options: AppOptions): express.Express {
  const { pool, jwtSecret, jwtTtl, dbs } = options;
  const app = express();
  // Rolodex accepts whole address books and photos in one request, which is why this is not 2mb.
  app.use(express.json({ limit: "25mb" }));

  // Express sends an ETag with every JSON reply, and a browser that revalidates one gets 304 with
  // an empty body - which the client then tries to parse. On a machine talking to itself there is
  // nothing to save by caching a list that changes every time you touch it.
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  app.use("/api/auth", authRouter({ pool, jwtSecret, jwtTtl }));

  // Everything else under /api answers 401 until a session cookie names a user, and 403 to a user
  // whose password was reset and not yet replaced - change-password is the only /api route that may
  // still be used, and it lives under /api/auth, mounted above this gate. The tenant a request acts
  // on is resolved here and carried on res.locals for the router that handles it.
  app.use("/api", async (req, res, next) => {
    const user = await sessionUser(pool, jwtSecret, req);
    if ((await userCount(pool)) === 0 || user) {
      if (user?.must_change_password) {
        res.status(403).json({ error: "Password change required" });
        return;
      }
      if (user) {
        const tenantId = await resolveTenant(pool, user, req);
        if (tenantId === null) {
          res.status(403).json({ error: "No access to that tenant" });
          return;
        }
        res.locals.tenantId = tenantId;
      }
      next();
      return;
    }
    res.status(401).json({ error: "Not signed in" });
  });

  app.use("/api/crm", crmRouter(pool));
  app.use("/api/space", spaceRouter(pool));
  app.use("/api/rolodex", rolodexRouter(dbs.rolodex));

  if (existsSync(webDist)) {
    // Pages are gated too: any GET without a session is sent to the login document, the one page
    // served to everyone. API paths never reach here - their gate answered above. Three kinds of
    // path stay open on purpose: /login (the document itself, including static's /login/ directory
    // form, which would loop back to itself without the prefix match), /assets (build output, code
    // not data - the login document cannot boot without its bundle), and anything with a file
    // extension - the favicon in dist's root, which the login document asks for by name.
    app.use(async (req, res, next) => {
      const user = await sessionUser(pool, jwtSecret, req);
      if (
        req.method === "GET" &&
        !req.path.startsWith("/api") &&
        !req.path.startsWith("/assets") &&
        !req.path.startsWith("/login") &&
        !/\.[a-z0-9]+$/i.test(req.path)
      ) {
        if ((await userCount(pool)) > 0 && !user) {
          res.redirect("/login/");
          return;
        }
        if (
          user?.must_change_password &&
          !req.path.startsWith("/change-password")
        ) {
          res.redirect("/change-password");
          return;
        }
      }
      next();
    });
    app.use(express.static(webDist));
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api")) {
        next();
        return;
      }
      const owner = APPS.find(
        (name) => req.path === `/${name}` || req.path.startsWith(`/${name}/`),
      );
      res.sendFile(path.join(webDist, owner ?? "", "index.html"));
    });
  }
  return app;
}
