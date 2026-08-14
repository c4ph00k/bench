import { Router } from "express";
import type Database from "better-sqlite3";

export function searchRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/search", (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (!q) {
      res.json([]);
      return;
    }
    const results = db
      .prepare(
        `SELECT p.id, p.title, p.icon, p.type, parent.title AS parent_title, parent.type AS parent_type
         FROM pages p
         LEFT JOIN pages parent ON parent.id = p.parent_id
         WHERE p.title LIKE ? ESCAPE '\\' COLLATE NOCASE
         ORDER BY CASE WHEN p.title LIKE ? ESCAPE '\\' COLLATE NOCASE THEN 0 ELSE 1 END, length(p.title)
         LIMIT 20`,
      )
      .all(`%${q.replace(/[%_\\]/g, "\\$&")}%`, `${q.replace(/[%_\\]/g, "\\$&")}%`);
    res.json(results);
  });

  return router;
}
