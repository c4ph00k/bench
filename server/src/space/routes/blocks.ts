import { Router } from "express";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { BlockRow } from "../db.js";

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

function isBlockType(value: string): boolean {
  return (BLOCK_TYPES as readonly string[]).includes(value);
}

/** A block as the API returns it: the stored `content` text parsed back into an object. */
function withParsedContent(row: BlockRow) {
  return { ...row, content: JSON.parse(row.content) as unknown };
}

export function blocksRouter(db: Database.Database): Router {
  const router = Router();

  router.post("/pages/:pageId/blocks", (req, res) => {
    const page = db
      .prepare("SELECT id FROM pages WHERE id = ?")
      .get(req.params.pageId);
    if (!page) {
      res.status(404).json({ error: "page not found" });
      return;
    }
    const {
      id = randomUUID(),
      type = "paragraph",
      content = {},
      index,
    } = (req.body ?? {}) as {
      id?: string;
      type?: string;
      content?: unknown;
      index?: number;
    };
    if (!isBlockType(type)) {
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
    const at = Math.max(
      0,
      Math.min(typeof index === "number" ? index : count, count),
    );
    db.transaction(() => {
      db.prepare(
        "UPDATE blocks SET position = position + 1 WHERE page_id = ? AND position >= ?",
      ).run(req.params.pageId, at);
      db.prepare(
        "INSERT INTO blocks (id, page_id, type, content, position) VALUES (?, ?, ?, ?, ?)",
      ).run(id, req.params.pageId, type, JSON.stringify(content), at);
    })();
    const row = db
      .prepare("SELECT * FROM blocks WHERE id = ?")
      .get(id) as BlockRow;
    res.status(201).json(withParsedContent(row));
  });

  router.patch("/blocks/:id", (req, res) => {
    const block = db
      .prepare("SELECT * FROM blocks WHERE id = ?")
      .get(req.params.id) as BlockRow | undefined;
    if (!block) {
      res.status(404).json({ error: "block not found" });
      return;
    }
    const { type, content } = (req.body ?? {}) as {
      type?: string;
      content?: unknown;
    };
    if (type !== undefined) {
      if (!isBlockType(type)) {
        res.status(400).json({ error: `unknown block type '${type}'` });
        return;
      }
      db.prepare("UPDATE blocks SET type = ? WHERE id = ?").run(
        type,
        req.params.id,
      );
    }
    if (content !== undefined) {
      if (!isPlainObject(content)) {
        res.status(400).json({ error: "content must be an object" });
        return;
      }
      db.prepare("UPDATE blocks SET content = ? WHERE id = ?").run(
        JSON.stringify(content),
        req.params.id,
      );
    }
    const row = db
      .prepare("SELECT * FROM blocks WHERE id = ?")
      .get(req.params.id) as BlockRow;
    res.json(withParsedContent(row));
  });

  router.delete("/blocks/:id", (req, res) => {
    const block = db
      .prepare("SELECT page_id, position FROM blocks WHERE id = ?")
      .get(req.params.id) as Pick<BlockRow, "page_id" | "position"> | undefined;
    if (!block) {
      res.status(404).json({ error: "block not found" });
      return;
    }
    db.transaction(() => {
      db.prepare("DELETE FROM blocks WHERE id = ?").run(req.params.id);
      db.prepare(
        "UPDATE blocks SET position = position - 1 WHERE page_id = ? AND position > ?",
      ).run(block.page_id, block.position);
    })();
    res.json({ ok: true });
  });

  router.put("/pages/:pageId/blocks/order", (req, res) => {
    // Shape asserted here, then checked below: it must be a permutation of the page's block ids.
    const { ids } = (req.body ?? {}) as { ids?: string[] };
    const existing = (
      db
        .prepare("SELECT id FROM blocks WHERE page_id = ? ORDER BY position")
        .all(req.params.pageId) as Pick<BlockRow, "id">[]
    ).map((r) => r.id);
    if (
      !Array.isArray(ids) ||
      ids.length !== existing.length ||
      new Set(ids).size !== ids.length
    ) {
      res
        .status(400)
        .json({ error: "ids must be a permutation of the page's block ids" });
      return;
    }
    const existingSet = new Set(existing);
    if (!ids.every((id) => existingSet.has(id))) {
      res
        .status(400)
        .json({ error: "ids must be a permutation of the page's block ids" });
      return;
    }
    const update = db.prepare("UPDATE blocks SET position = ? WHERE id = ?");
    db.transaction(() => {
      ids.forEach((id, i) => update.run(i, id));
    })();
    res.json({ ok: true });
  });

  return router;
}
