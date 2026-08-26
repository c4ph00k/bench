/**
 * The admin panel's half: list, create, edit and delete users, and reset a password so the next
 * sign-in is forced through /change-password. Mounted under /api/auth, which app.ts mounts before
 * the API gate - so this router carries its own check, and demands an admin whose password is not
 * itself awaiting a change.
 */
import { Router } from "express";
import * as db from "./db.js";
import { sessionUser } from "./session.js";

const ROLES: readonly db.Role[] = ["admin", "user"] as const;

/** The seeded bootstrap admin. They answer to no one: not to the panel, not to another admin. */
const SEEDED_ADMIN = "marco";

function isRole(value: unknown): value is db.Role {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  );
}

export function adminRouter(auth: db.AuthDb): Router {
  const router = Router();

  router.use((req, res, next) => {
    const admin = sessionUser(auth, req);
    if (!admin) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }
    if (admin.must_change_password === 1) {
      res.status(403).json({ error: "Password change required" });
      return;
    }
    if (admin.role !== "admin") {
      res.status(403).json({ error: "Admin only" });
      return;
    }
    res.locals.admin = admin;
    next();
  });

  router.get("/", (_req, res) => {
    res.json(db.listUsers(auth));
  });

  router.post("/", (req, res) => {
    const { username, password, role } = req.body as {
      username?: string;
      password?: string;
      role?: unknown;
    };
    if (!username || !password || !isRole(role)) {
      res
        .status(400)
        .json({ error: "Username, password and role are required" });
      return;
    }
    const user = db.createUser(auth, username, password, role);
    if (!user) {
      res.status(409).json({ error: "That username is taken" });
      return;
    }
    res.status(201).json(user);
  });

  router.patch("/:id", (req, res) => {
    const id = Number(req.params.id);
    const target = db.getUserById(auth, id);
    if (!target) {
      res.status(404).json({ error: "No such user" });
      return;
    }
    const { username, role } = req.body as {
      username?: string;
      role?: unknown;
    };
    let nextRole: db.Role | undefined;
    if (role !== undefined) {
      if (!isRole(role)) {
        res.status(400).json({ error: "Role must be admin or user" });
        return;
      }
      nextRole = role;
    }
    const admin = res.locals.admin as db.UserRow;
    // Renaming the seeded admin would be a rename-and-delete away from removing the account the
    // whole bootstrap rests on, so the name cannot change either.
    if (
      target.username === SEEDED_ADMIN &&
      username !== undefined &&
      username !== SEEDED_ADMIN
    ) {
      res
        .status(403)
        .json({ error: "marco is the seeded admin and cannot be renamed" });
      return;
    }
    if (
      nextRole === "user" &&
      target.role === "admin" &&
      db.countAdmins(auth) === 1
    ) {
      res.status(403).json({ error: "The last admin cannot be demoted" });
      return;
    }
    const updated = db.updateUser(auth, id, { username, role: nextRole });
    if (!updated) {
      res.status(409).json({ error: "That username is taken" });
      return;
    }
    if (target.id === admin.id) {
      // Keep the panel's own row fresh if the admin edits themself.
      res.locals.admin = db.getUserById(auth, target.id);
    }
    res.json(updated);
  });

  router.delete("/:id", (req, res) => {
    const id = Number(req.params.id);
    const target = db.getUserById(auth, id);
    if (!target) {
      res.status(404).json({ error: "No such user" });
      return;
    }
    const admin = res.locals.admin as db.UserRow;
    if (target.id === admin.id) {
      res.status(403).json({ error: "You cannot delete your own account" });
      return;
    }
    if (target.username === SEEDED_ADMIN) {
      res.status(403).json({
        error: "marco is the seeded admin and cannot be deleted",
      });
      return;
    }
    if (target.role === "admin" && db.countAdmins(auth) === 1) {
      res.status(403).json({ error: "The last admin cannot be deleted" });
      return;
    }
    db.deleteUser(auth, id);
    res.status(204).end();
  });

  router.post("/:id/reset-password", (req, res) => {
    const id = Number(req.params.id);
    const { password } = req.body as { password?: string };
    if (!password) {
      res.status(400).json({ error: "A password is required" });
      return;
    }
    if (!db.resetPassword(auth, id, password)) {
      res.status(404).json({ error: "No such user" });
      return;
    }
    res.status(204).end();
  });

  return router;
}
