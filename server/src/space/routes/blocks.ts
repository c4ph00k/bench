import { Router } from "express";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export const BLOCK_TYPES = [
  "paragraph",
  "heading1",
  "heading2",
  "heading3",
  "bulleted",
  "numbered",
  "todo",
  "quote",
  "divider",
  "code",
  "callout",
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function blocksRouter(db: Database.Database): Router {
  const router = Router();

  router.post("/pages/:pageId/blocks", (req, res) => {
    const page = db.prepare("SELECT id FROM pages WHERE id = ?").get(req.params.pageId);
    if (!page) {
      res.status(404).json({ error: "page not found" });
      return;
    }
    const { id = randomUUID(), type = "paragraph", content = {}, index } = req.body ?? {};
    if (!BLOCK_TYPES.includes(type)) {
      res.status(400).json({ error: `unknown block type '${type}'` });
      return;
    }
    if (!isPlainObject(content)) {
      res.status(400).json({ error: "content must be an object" });
      return;
    }
    const { count } = db
      .prepare("SELECT COUNT(*) AS count FROM blocks WHERE page_id = ?")
      .get(req.params.pageId) as { count: number };
    const at = Math.max(0, Math.min(typeof index === "number" ? index : count, count));
    db.transaction(() => {
      db.prepare("UPDATE blocks SET position = position + 1 WHERE page_id = ? AND position >= ?").run(
        req.params.pageId,
        at,
      );
      db.prepare("INSERT INTO blocks (id, page_id, type, content, position) VALUES (?, ?, ?, ?, ?)").run(
        id,
        req.params.pageId,
        type,
        JSON.stringify(content),
        at,
      );
    })();
    const row = db.prepare("SELECT * FROM blocks WHERE id = ?").get(id) as any;
    res.status(201).json({ ...row, content: JSON.parse(row.content) });
  });

  router.patch("/blocks/:id", (req, res) => {
    const block = db.prepare("SELECT * FROM blocks WHERE id = ?").get(req.params.id) as any;
    if (!block) {
      res.status(404).json({ error: "block not found" });
      return;
    }
    const { type, content } = req.body ?? {};
    if (type !== undefined) {
      if (!BLOCK_TYPES.includes(type)) {
        res.status(400).json({ error: `unknown block type '${type}'` });
        return;
      }
      db.prepare("UPDATE blocks SET type = ? WHERE id = ?").run(type, req.params.id);
    }
    if (content !== undefined) {
      if (!isPlainObject(content)) {
        res.status(400).json({ error: "content must be an object" });
        return;
      }
      db.prepare("UPDATE blocks SET content = ? WHERE id = ?").run(JSON.stringify(content), req.params.id);
    }
    const row = db.prepare("SELECT * FROM blocks WHERE id = ?").get(req.params.id) as any;
    res.json({ ...row, content: JSON.parse(row.content) });
  });

  router.delete("/blocks/:id", (req, res) => {
    const block = db.prepare("SELECT page_id, position FROM blocks WHERE id = ?").get(req.params.id) as any;
    if (!block) {
      res.status(404).json({ error: "block not found" });
      return;
    }
    db.transaction(() => {
      db.prepare("DELETE FROM blocks WHERE id = ?").run(req.params.id);
      db.prepare("UPDATE blocks SET position = position - 1 WHERE page_id = ? AND position > ?").run(
        block.page_id,
        block.position,
      );
    })();
    res.json({ ok: true });
  });

  router.put("/pages/:pageId/blocks/order", (req, res) => {
    const { ids } = req.body ?? {};
    const existing = db
      .prepare("SELECT id FROM blocks WHERE page_id = ? ORDER BY position")
      .all(req.params.pageId)
      .map((r: any) => r.id);
    if (!Array.isArray(ids) || ids.length !== existing.length || new Set(ids).size !== ids.length) {
      res.status(400).json({ error: "ids must be a permutation of the page's block ids" });
      return;
    }
    const existingSet = new Set(existing);
    if (!ids.every((id: string) => existingSet.has(id))) {
      res.status(400).json({ error: "ids must be a permutation of the page's block ids" });
      return;
    }
    const update = db.prepare("UPDATE blocks SET position = ? WHERE id = ?");
    db.transaction(() => {
      ids.forEach((id: string, i: number) => update.run(i, id));
    })();
    res.json({ ok: true });
  });

  return router;
}
