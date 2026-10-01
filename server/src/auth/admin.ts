/**
 * The admin panel's half: list, create, edit and delete the members of one tenant, and reset a
 * password so the next sign-in is forced through /change-password. Mounted under /api/auth, which
 * app.ts mounts before the API gate - so this router carries its own check, and demands an
 * admin/owner whose password is not itself awaiting a change.
 *
 * The tenant is the one the admin is an owner or admin of. With one tenant, that is unambiguous;
 * the tenant switcher that lets a master admin pick among many arrives with the multi-tenant apps.
 */
import { Router } from "express";
import type { Pool } from "pg";
import * as db from "./db.js";
import type { Role } from "./db.js";
import { sessionUser } from "./session.js";

const ROLES: readonly Role[] = ["owner", "admin", "user"] as const;

function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  );
}

export function adminRouter(options: {
  pool: Pool;
  jwtSecret: string;
}): Router {
  const { pool, jwtSecret } = options;
  const router = Router();

  router.use(async (req, res, next) => {
    const admin = await sessionUser(pool, jwtSecret, req);
    if (!admin) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    if (admin.must_change_password) {
      res.status(403).json({ error: "Password change required" });
      return;
    }
    const tenantId = await db.adminTenantId(pool, admin.id);
    if (tenantId === null) {
      res.status(403).json({ error: "Admin only" });
      return;
    }
    res.locals.admin = admin;
    res.locals.tenantId = tenantId;
    next();
  });

  router.get("/", async (_req, res) => {
    res.json(await db.listUsers(pool, res.locals.tenantId as number));
  });

  router.post("/", async (req, res) => {
    const { email, password, role } = req.body as {
      email?: string;
      password?: string;
      role?: unknown;
    };
    if (!email || !password || !isRole(role)) {
      res.status(400).json({ error: "Email, password and role are required" });
      return;
    }
    const user = await db.createUser(
      pool,
      res.locals.tenantId as number,
      email,
      password,
      role,
    );
    if (!user) {
      res.status(409).json({ error: "That email is taken" });
      return;
    }
    res.status(201).json(user);
  });

  router.patch("/:id", async (req, res) => {
    const id = Number(req.params.id);
    const tenantId = res.locals.tenantId as number;
    const target = await db.getUserById(pool, id);
    const targetRole = await db.membershipRole(pool, tenantId, id);
    if (!target || targetRole === undefined) {
      res.status(404).json({ error: "No such user" });
      return;
    }
    const { email, role } = req.body as {
      email?: string;
      role?: unknown;
    };
    let nextRole: Role | undefined;
    if (role !== undefined) {
      if (!isRole(role)) {
        res.status(400).json({ error: "Role must be owner, admin or user" });
        return;
      }
      nextRole = role;
    }
    if (
      targetRole === "owner" &&
      nextRole !== undefined &&
      nextRole !== "owner" &&
      (await db.countRole(pool, tenantId, "owner")) === 1
    ) {
      res.status(403).json({ error: "The last owner cannot be demoted" });
      return;
    }
    const updated = await db.updateUser(pool, tenantId, id, {
      email,
      role: nextRole,
    });
    if (!updated) {
      res.status(409).json({ error: "That email is taken" });
      return;
    }
    res.json(updated);
  });

  router.delete("/:id", async (req, res) => {
    const id = Number(req.params.id);
    const tenantId = res.locals.tenantId as number;
    const target = await db.getUserById(pool, id);
    const targetRole = await db.membershipRole(pool, tenantId, id);
    if (!target || targetRole === undefined) {
      res.status(404).json({ error: "No such user" });
      return;
    }
    const admin = res.locals.admin as db.UserRow;
    if (target.id === admin.id) {
      res.status(403).json({ error: "You cannot delete your own account" });
      return;
    }
    if (
      targetRole === "owner" &&
      (await db.countRole(pool, tenantId, "owner")) === 1
    ) {
      res.status(403).json({ error: "The last owner cannot be deleted" });
      return;
    }
    await db.deleteUser(pool, tenantId, id);
    res.status(204).end();
  });

  router.post("/:id/reset-password", async (req, res) => {
    const id = Number(req.params.id);
    const { password } = req.body as { password?: string };
    if (!password) {
      res.status(400).json({ error: "A password is required" });
      return;
    }
    if (!(await db.resetPassword(pool, id, password))) {
      res.status(404).json({ error: "No such user" });
      return;
    }
    res.status(204).end();
  });

  return router;
}
