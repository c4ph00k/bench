import { Router } from "express";
import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import type { BlockRow } from "../db.js";
import { tenantIdOf } from "../../tenant.js";

const BLOCK_TYPES = [
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

export function blocksRouter(pool: Pool): Router {
  const router = Router();

  router.post("/pages/:pageId/blocks", async (req, res) => {
    const tenantId = tenantIdOf(res);
    const page = await pool.query(
      "SELECT id FROM pages WHERE id = $1 AND tenant_id = $2",
      [req.params.pageId, tenantId],
    );
    if (page.rows.length === 0) {
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
    const countResult = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM blocks WHERE page_id = $1 AND tenant_id = $2",
      [req.params.pageId, tenantId],
    );
    const count = countResult.rows[0].count;
    const at = Math.max(
      0,
      Math.min(typeof index === "number" ? index : count, count),
    );
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE blocks SET position = position + 1 WHERE page_id = $1 AND tenant_id = $2 AND position >= $3",
        [req.params.pageId, tenantId, at],
      );
      await client.query(
        "INSERT INTO blocks (id, tenant_id, page_id, type, content, position) VALUES ($1, $2, $3, $4, $5, $6)",
        [id, tenantId, req.params.pageId, type, JSON.stringify(content), at],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    const row = await pool.query<BlockRow>(
      "SELECT * FROM blocks WHERE id = $1 AND tenant_id = $2",
      [id, tenantId],
    );
    res.status(201).json(withParsedContent(row.rows[0]));
  });

  router.patch("/blocks/:id", async (req, res) => {
    const tenantId = tenantIdOf(res);
    const block = await pool.query<BlockRow>(
      "SELECT * FROM blocks WHERE id = $1 AND tenant_id = $2",
      [req.params.id, tenantId],
    );
    if (block.rows.length === 0) {
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
      await pool.query(
        "UPDATE blocks SET type = $1 WHERE id = $2 AND tenant_id = $3",
        [type, req.params.id, tenantId],
      );
    }
    if (content !== undefined) {
      if (!isPlainObject(content)) {
        res.status(400).json({ error: "content must be an object" });
        return;
      }
      await pool.query(
        "UPDATE blocks SET content = $1 WHERE id = $2 AND tenant_id = $3",
        [JSON.stringify(content), req.params.id, tenantId],
      );
    }
    const row = await pool.query<BlockRow>(
      "SELECT * FROM blocks WHERE id = $1 AND tenant_id = $2",
      [req.params.id, tenantId],
    );
    res.json(withParsedContent(row.rows[0]));
  });

  router.delete("/blocks/:id", async (req, res) => {
    const tenantId = tenantIdOf(res);
    const block = await pool.query<Pick<BlockRow, "page_id" | "position">>(
      "SELECT page_id, position FROM blocks WHERE id = $1 AND tenant_id = $2",
      [req.params.id, tenantId],
    );
    if (block.rows.length === 0) {
      res.status(404).json({ error: "block not found" });
      return;
    }
    const { page_id, position } = block.rows[0];
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM blocks WHERE id = $1 AND tenant_id = $2",
        [req.params.id, tenantId],
      );
      await client.query(
        "UPDATE blocks SET position = position - 1 WHERE page_id = $1 AND tenant_id = $2 AND position > $3",
        [page_id, tenantId, position],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    res.json({ ok: true });
  });

  router.put("/pages/:pageId/blocks/order", async (req, res) => {
    const tenantId = tenantIdOf(res);
    // Shape asserted here, then checked below: it must be a permutation of the page's block ids.
    const { ids } = (req.body ?? {}) as { ids?: string[] };
    const existing = await pool.query<{ id: string }>(
      "SELECT id FROM blocks WHERE page_id = $1 AND tenant_id = $2 ORDER BY position",
      [req.params.pageId, tenantId],
    );
    const existingIds = existing.rows.map((r) => r.id);
    if (
      !Array.isArray(ids) ||
      ids.length !== existingIds.length ||
      new Set(ids).size !== ids.length
    ) {
      res
        .status(400)
        .json({ error: "ids must be a permutation of the page's block ids" });
      return;
    }
    const existingSet = new Set(existingIds);
    if (!ids.every((id) => existingSet.has(id))) {
      res
        .status(400)
        .json({ error: "ids must be a permutation of the page's block ids" });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const [i, id] of ids.entries()) {
        await client.query(
          "UPDATE blocks SET position = $1 WHERE id = $2 AND tenant_id = $3",
          [i, id, tenantId],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    res.json({ ok: true });
  });

  return router;
}
