import { Router } from "express";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { BlockRow } from "../db.js";

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

export function pagesRouter(db: Database.Database): Router {
  const router = Router();

  const nextPosition = (parentId: string | null): number => {
    const row = db
      .prepare(
        "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM pages WHERE parent_id IS ?",
      )
      .get(parentId) as { pos: number };
    return row.pos;
  };

  router.get("/tree", (_req, res) => {
    const pages = db
      .prepare(
        "SELECT id, parent_id, type, title, icon, position FROM pages WHERE type != 'row' ORDER BY position",
      )
      .all() as PageRow[];
    res.json(buildTree(pages));
  });

  router.post("/pages", (req, res) => {
    const {
      parentId = null,
      title = "",
      icon = null,
      type = "page",
    } = (req.body ?? {}) as {
      parentId?: string | null;
      title?: string;
      icon?: string | null;
      type?: string;
    };
    if (!["page", "database"].includes(type)) {
      res.status(400).json({ error: "type must be 'page' or 'database'" });
      return;
    }
    if (
      parentId &&
      !db.prepare("SELECT id FROM pages WHERE id = ?").get(parentId)
    ) {
      res.status(400).json({ error: "parent not found" });
      return;
    }
    const id = randomUUID();
    db.prepare(
      "INSERT INTO pages (id, parent_id, type, title, icon, position) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(id, parentId, type, String(title), icon, nextPosition(parentId));
    res
      .status(201)
      .json(db.prepare("SELECT * FROM pages WHERE id = ?").get(id));
  });

  router.get("/pages/:id", (req, res) => {
    const page = db
      .prepare("SELECT * FROM pages WHERE id = ?")
      .get(req.params.id) as PageRow | undefined;
    if (!page) {
      res.status(404).json({ error: "page not found" });
      return;
    }
    const blocks = db
      .prepare(
        "SELECT id, page_id, type, content, position FROM blocks WHERE page_id = ? ORDER BY position",
      )
      .all(req.params.id)
      .map((b) => {
        const block = b as BlockRow;
        return { ...block, content: JSON.parse(block.content) as unknown };
      });
    res.json({ ...page, blocks });
  });

  router.patch("/pages/:id", (req, res) => {
    const page = db
      .prepare("SELECT * FROM pages WHERE id = ?")
      .get(req.params.id);
    if (!page) {
      res.status(404).json({ error: "page not found" });
      return;
    }
    const { title, icon } = (req.body ?? {}) as {
      title?: string;
      icon?: string | null;
    };
    if (title !== undefined) {
      db.prepare(
        "UPDATE pages SET title = ?, updated_at = datetime('now') WHERE id = ?",
      ).run(String(title), req.params.id);
    }
    if (icon !== undefined) {
      db.prepare(
        "UPDATE pages SET icon = ?, updated_at = datetime('now') WHERE id = ?",
      ).run(icon, req.params.id);
    }
    res.json(db.prepare("SELECT * FROM pages WHERE id = ?").get(req.params.id));
  });

  router.delete("/pages/:id", (req, res) => {
    const result = db
      .prepare("DELETE FROM pages WHERE id = ?")
      .run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: "page not found" });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}
