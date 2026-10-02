import { Router } from "express";
import { randomUUID } from "node:crypto";
import type { BlockRow } from "../db.js";
import { requestDb } from "../../db/rls.js";
import { asText } from "../text.js";
import { tenantIdOf } from "../../tenant.js";

export interface PageRow {
  id: string;
  parent_id: string | null;
  type: "page" | "database" | "row";
  title: string;
  icon: string | null;
  position: number;
}

export interface TreeNode extends PageRow {
  children: TreeNode[];
}

/** Build the sidebar tree from all non-row pages. */
export function buildTree(pages: PageRow[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  for (const p of pages) nodes.set(p.id, { ...p, children: [] });
  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function pagesRouter(): Router {
  const router = Router();

  const nextPosition = async (
    db: ReturnType<typeof requestDb>,
    parentId: string | null,
    tenantId: number,
  ) => {
    const result = await db.query<{ pos: number }>(
      "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM pages WHERE parent_id IS NOT DISTINCT FROM $1 AND tenant_id = $2",
      [parentId, tenantId],
    );
    return result.rows[0].pos;
  };

  router.get("/tree", async (_req, res) => {
    const tenantId = tenantIdOf(res);
    const result = await requestDb(res).query<PageRow>(
      "SELECT id, parent_id, type, title, icon, position FROM pages WHERE type != 'row' AND tenant_id = $1 ORDER BY position",
      [tenantId],
    );
    res.json(buildTree(result.rows));
  });

  router.post("/pages", async (req, res) => {
    const tenantId = tenantIdOf(res);
    const db = requestDb(res);
    const {
      parentId = null,
      title = "",
      icon = null,
      type = "page",
    } = (req.body ?? {}) as {
      parentId?: string | null;
      title?: unknown;
      icon?: string | null;
      type?: string;
    };
    if (!["page", "database"].includes(type)) {
      res.status(400).json({ error: "type must be 'page' or 'database'" });
      return;
    }
    if (parentId) {
      const parent = await db.query(
        "SELECT id FROM pages WHERE id = $1 AND tenant_id = $2",
        [parentId, tenantId],
      );
      if (parent.rows.length === 0) {
        res.status(400).json({ error: "parent not found" });
        return;
      }
    }
    const id = randomUUID();
    await db.query(
      "INSERT INTO pages (id, tenant_id, parent_id, type, title, icon, position) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [
        id,
        tenantId,
        parentId,
        type,
        asText(title),
        icon,
        await nextPosition(db, parentId, tenantId),
      ],
    );
    const page = await db.query(
      "SELECT * FROM pages WHERE id = $1 AND tenant_id = $2",
      [id, tenantId],
    );
    res.status(201).json(page.rows[0]);
  });

  router.get("/pages/:id", async (req, res) => {
    const tenantId = tenantIdOf(res);
    const db = requestDb(res);
    const page = await db.query<PageRow>(
      "SELECT * FROM pages WHERE id = $1 AND tenant_id = $2",
      [req.params.id, tenantId],
    );
    if (page.rows.length === 0) {
      res.status(404).json({ error: "page not found" });
      return;
    }
    const blocks = await db.query<BlockRow>(
      "SELECT id, page_id, type, content, position FROM blocks WHERE page_id = $1 AND tenant_id = $2 ORDER BY position",
      [req.params.id, tenantId],
    );
    res.json({
      ...page.rows[0],
      blocks: blocks.rows.map((b) => ({
        ...b,
        content: JSON.parse(b.content) as unknown,
      })),
    });
  });

  router.patch("/pages/:id", async (req, res) => {
    const tenantId = tenantIdOf(res);
    const db = requestDb(res);
    const existing = await db.query(
      "SELECT id FROM pages WHERE id = $1 AND tenant_id = $2",
      [req.params.id, tenantId],
    );
    if (existing.rows.length === 0) {
      res.status(404).json({ error: "page not found" });
      return;
    }
    const { title, icon } = (req.body ?? {}) as {
      title?: unknown;
      icon?: string | null;
    };
    if (title !== undefined) {
      await db.query(
        "UPDATE pages SET title = $1, updated_at = now()::text WHERE id = $2 AND tenant_id = $3",
        [asText(title), req.params.id, tenantId],
      );
    }
    if (icon !== undefined) {
      await db.query(
        "UPDATE pages SET icon = $1, updated_at = now()::text WHERE id = $2 AND tenant_id = $3",
        [icon, req.params.id, tenantId],
      );
    }
    const page = await db.query(
      "SELECT * FROM pages WHERE id = $1 AND tenant_id = $2",
      [req.params.id, tenantId],
    );
    res.json(page.rows[0]);
  });

  router.delete("/pages/:id", async (req, res) => {
    const tenantId = tenantIdOf(res);
    const result = await requestDb(res).query(
      "DELETE FROM pages WHERE id = $1 AND tenant_id = $2",
      [req.params.id, tenantId],
    );
    if ((result.rowCount ?? 0) === 0) {
      res.status(404).json({ error: "page not found" });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}
