import { Router } from "express";
import type { Pool } from "pg";
import { asText } from "../text.js";
import { tenantIdOf } from "../../tenant.js";

export function searchRouter(pool: Pool): Router {
  const router = Router();

  router.get("/search", async (req, res) => {
    const tenantId = tenantIdOf(res);
    const q = asText(req.query.q).trim();
    if (!q) {
      res.json([]);
      return;
    }
    const escaped = q.replace(/[%_\\]/g, "\\$&");
    const contains = `%${escaped}%`;
    const prefix = `${escaped}%`;
    const result = await pool.query(
      `SELECT p.id, p.title, p.icon, p.type, parent.title AS parent_title, parent.type AS parent_type
       FROM pages p
       LEFT JOIN pages parent ON parent.id = p.parent_id
       WHERE p.tenant_id = $1 AND p.title ILIKE $2 ESCAPE '\\'
       ORDER BY CASE WHEN p.title ILIKE $3 ESCAPE '\\' THEN 0 ELSE 1 END, length(p.title)
       LIMIT 20`,
      [tenantId, contains, prefix],
    );
    res.json(result.rows);
  });

  return router;
}
