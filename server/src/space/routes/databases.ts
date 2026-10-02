import { Router } from "express";
import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import type { PropertyOptionRow, PropertyRow } from "../db.js";
import { asText } from "../text.js";
import { tenantIdOf } from "../../tenant.js";

const PROPERTY_TYPES = [
  "text",
  "number",
  "select",
  "multi_select",
  "date",
  "checkbox",
  "url",
] as const;
const VIEW_KINDS = ["table", "board", "list"] as const;
const OPTION_COLORS = [
  "gray",
  "amber",
  "blue",
  "purple",
  "green",
  "red",
  "pink",
  "teal",
  "orange",
  "brown",
];

const DEFAULT_VIEW = { filters: [], sort: null, groupBy: null };

type PropertySummary = Pick<PropertyRow, "id" | "name" | "type" | "position">;
type OptionSummary = Pick<
  PropertyOptionRow,
  "id" | "name" | "color" | "position"
>;
interface DatabasePage {
  id: string;
  title: string;
  icon: string | null;
}

function isPropertyType(value: string): boolean {
  return (PROPERTY_TYPES as readonly string[]).includes(value);
}

function isViewKind(value: string): boolean {
  return (VIEW_KINDS as readonly string[]).includes(value);
}

interface Queries {
  getDb: (id: string, tenantId: number) => Promise<DatabasePage | undefined>;
  optionsOf: (propertyId: string, tenantId: number) => Promise<OptionSummary[]>;
  propertiesOf: (
    databaseId: string,
    tenantId: number,
  ) => Promise<PropertySummary[]>;
  nextPosition: (sql: string, id: string, tenantId: number) => Promise<number>;
}

function queries(pool: Pool): Queries {
  return {
    getDb: async (id, tenantId) => {
      const result = await pool.query<DatabasePage>(
        "SELECT id, title, icon FROM pages WHERE id = $1 AND tenant_id = $2 AND type = 'database'",
        [id, tenantId],
      );
      return result.rows[0];
    },
    optionsOf: async (propertyId, tenantId) => {
      const result = await pool.query<OptionSummary>(
        "SELECT id, name, color, position FROM property_options WHERE property_id = $1 AND tenant_id = $2 ORDER BY position",
        [propertyId, tenantId],
      );
      return result.rows;
    },
    propertiesOf: async (databaseId, tenantId) => {
      const result = await pool.query<PropertySummary>(
        "SELECT id, name, type, position FROM properties WHERE database_id = $1 AND tenant_id = $2 ORDER BY position",
        [databaseId, tenantId],
      );
      return result.rows;
    },
    nextPosition: async (sql, id, tenantId) => {
      const result = await pool.query<{ pos: number }>(sql, [id, tenantId]);
      return result.rows[0].pos;
    },
  };
}

function databaseRoutes(router: Router, pool: Pool, q: Queries) {
  router.get("/databases/:id", async (req, res) => {
    const tenantId = tenantIdOf(res);
    const page = await q.getDb(req.params.id, tenantId);
    if (!page) {
      res.status(404).json({ error: "database not found" });
      return;
    }
    const properties = await q.propertiesOf(req.params.id, tenantId);
    const optionsByProp = new Map<string, OptionSummary[]>();
    for (const p of properties)
      optionsByProp.set(p.id, await q.optionsOf(p.id, tenantId));
    const rowResult = await pool.query<{
      id: string;
      title: string;
      icon: string | null;
      position: number;
    }>(
      "SELECT id, title, icon, position FROM pages WHERE parent_id = $1 AND tenant_id = $2 AND type = 'row' ORDER BY position",
      [req.params.id, tenantId],
    );
    const values = await pool.query<{
      row_id: string;
      property_id: string;
      value: string | null;
    }>(
      `SELECT rv.row_id, rv.property_id, rv.value FROM row_values rv
       JOIN pages p ON p.id = rv.row_id WHERE p.parent_id = $1 AND rv.tenant_id = $2`,
      [req.params.id, tenantId],
    );
    const valuesByRow = new Map<string, Record<string, unknown>>();
    for (const v of values.rows) {
      const map = valuesByRow.get(v.row_id) ?? {};
      map[v.property_id] =
        v.value === null ? null : (JSON.parse(v.value) as unknown);
      valuesByRow.set(v.row_id, map);
    }
    const views: Record<string, unknown> = {};
    for (const kind of VIEW_KINDS) {
      const cur = await pool.query<{ config: string }>(
        "SELECT config FROM views WHERE database_id = $1 AND kind = $2 AND tenant_id = $3",
        [req.params.id, kind, tenantId],
      );
      const row = cur.rows[0] as { config: string } | undefined;
      views[kind] = row
        ? { ...DEFAULT_VIEW, ...(JSON.parse(row.config) as object) }
        : { ...DEFAULT_VIEW };
    }
    res.json({
      id: page.id,
      title: page.title,
      icon: page.icon,
      properties: properties.map((p) => ({
        ...p,
        options: optionsByProp.get(p.id) ?? [],
      })),
      rows: rowResult.rows.map((r) => ({
        ...r,
        values: valuesByRow.get(r.id) ?? {},
      })),
      views,
    });
  });
}

function propertyRoutes(router: Router, pool: Pool, q: Queries) {
  router.post("/databases/:id/properties", async (req, res) => {
    const tenantId = tenantIdOf(res);
    if (!(await q.getDb(req.params.id, tenantId))) {
      res.status(404).json({ error: "database not found" });
      return;
    }
    const { name = "", type = "" } = (req.body ?? {}) as {
      name?: unknown;
      type?: string;
    };
    if (!isPropertyType(type)) {
      res.status(400).json({ error: `unknown property type '${type}'` });
      return;
    }
    const pos = await q.nextPosition(
      "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM properties WHERE database_id = $1 AND tenant_id = $2",
      req.params.id,
      tenantId,
    );
    const id = randomUUID();
    await pool.query(
      "INSERT INTO properties (id, tenant_id, database_id, name, type, position) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, tenantId, req.params.id, asText(name), type, pos],
    );
    res
      .status(201)
      .json({ id, name: asText(name), type, position: pos, options: [] });
  });

  router.patch("/properties/:id", async (req, res) => {
    const tenantId = tenantIdOf(res);
    const prop = await pool.query<PropertyRow>(
      "SELECT * FROM properties WHERE id = $1 AND tenant_id = $2",
      [req.params.id, tenantId],
    );
    const current = prop.rows[0] as PropertyRow | undefined;
    if (!current) {
      res.status(404).json({ error: "property not found" });
      return;
    }
    const { name, type } = (req.body ?? {}) as {
      name?: unknown;
      type?: string;
    };
    if (type !== undefined && type !== current.type) {
      res
        .status(400)
        .json({ error: "a property's type is fixed once created" });
      return;
    }
    if (name !== undefined) {
      await pool.query(
        "UPDATE properties SET name = $1 WHERE id = $2 AND tenant_id = $3",
        [asText(name), req.params.id, tenantId],
      );
    }
    const updated = await pool.query(
      "SELECT * FROM properties WHERE id = $1 AND tenant_id = $2",
      [req.params.id, tenantId],
    );
    res.json(updated.rows[0]);
  });

  router.delete("/properties/:id", async (req, res) => {
    const tenantId = tenantIdOf(res);
    const result = await pool.query(
      "DELETE FROM properties WHERE id = $1 AND tenant_id = $2",
      [req.params.id, tenantId],
    );
    if ((result.rowCount ?? 0) === 0) {
      res.status(404).json({ error: "property not found" });
      return;
    }
    res.json({ ok: true });
  });

  router.post("/properties/:id/options", async (req, res) => {
    const tenantId = tenantIdOf(res);
    const prop = await pool.query<PropertyRow>(
      "SELECT * FROM properties WHERE id = $1 AND tenant_id = $2",
      [req.params.id, tenantId],
    );
    const current = prop.rows[0] as PropertyRow | undefined;
    if (!current) {
      res.status(404).json({ error: "property not found" });
      return;
    }
    if (current.type !== "select" && current.type !== "multi_select") {
      res.status(400).json({
        error: "options only apply to select and multi-select properties",
      });
      return;
    }
    const { name, color } = (req.body ?? {}) as {
      name?: unknown;
      color?: unknown;
    };
    const chosen =
      typeof color === "string" && OPTION_COLORS.includes(color)
        ? color
        : "gray";
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "option name required" });
      return;
    }
    const pos = await q.nextPosition(
      "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM property_options WHERE property_id = $1 AND tenant_id = $2",
      req.params.id,
      tenantId,
    );
    const id = randomUUID();
    await pool.query(
      "INSERT INTO property_options (id, tenant_id, property_id, name, color, position) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, tenantId, req.params.id, name, chosen, pos],
    );
    res.status(201).json({ id, name, color: chosen, position: pos });
  });

  router.put("/properties/:id/options/order", async (req, res) => {
    const tenantId = tenantIdOf(res);
    const { ids } = (req.body ?? {}) as { ids?: string[] };
    const existing = (await q.optionsOf(req.params.id, tenantId)).map(
      (o) => o.id,
    );
    const existingSet = new Set(existing);
    if (
      !Array.isArray(ids) ||
      ids.length !== existing.length ||
      new Set(ids).size !== ids.length ||
      !ids.every((id) => existingSet.has(id))
    ) {
      res
        .status(400)
        .json({ error: "ids must be a permutation of the property's options" });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const [i, id] of ids.entries()) {
        await client.query(
          "UPDATE property_options SET position = $1 WHERE id = $2 AND tenant_id = $3",
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
}

function rowRoutes(router: Router, pool: Pool, q: Queries) {
  router.post("/databases/:id/rows", async (req, res) => {
    const tenantId = tenantIdOf(res);
    if (!(await q.getDb(req.params.id, tenantId))) {
      res.status(404).json({ error: "database not found" });
      return;
    }
    const { title = "", values = {} } = (req.body ?? {}) as {
      title?: unknown;
      values?: Record<string, unknown>;
    };
    const pos = await q.nextPosition(
      "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM pages WHERE parent_id = $1 AND tenant_id = $2",
      req.params.id,
      tenantId,
    );
    const id = randomUUID();
    await pool.query(
      "INSERT INTO pages (id, tenant_id, parent_id, type, title, position) VALUES ($1, $2, $3, 'row', $4, $5)",
      [id, tenantId, req.params.id, asText(title), pos],
    );
    for (const [propId, value] of Object.entries(values)) {
      await pool.query(
        "INSERT INTO row_values (tenant_id, row_id, property_id, value) VALUES ($1, $2, $3, $4) ON CONFLICT (row_id, property_id) DO UPDATE SET value = excluded.value",
        [tenantId, id, propId, JSON.stringify(value)],
      );
    }
    res
      .status(201)
      .json({ id, title: asText(title), icon: null, position: pos, values });
  });

  router.put("/databases/:id/rows/order", async (req, res) => {
    const tenantId = tenantIdOf(res);
    const { ids } = (req.body ?? {}) as { ids?: string[] };
    const existingResult = await pool.query<{ id: string }>(
      "SELECT id FROM pages WHERE parent_id = $1 AND tenant_id = $2 AND type = 'row' ORDER BY position",
      [req.params.id, tenantId],
    );
    const existing = existingResult.rows.map((r) => r.id);
    const existingSet = new Set(existing);
    if (
      !Array.isArray(ids) ||
      ids.length !== existing.length ||
      new Set(ids).size !== ids.length ||
      !ids.every((id) => existingSet.has(id))
    ) {
      res
        .status(400)
        .json({ error: "ids must be a permutation of the database's row ids" });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const [i, id] of ids.entries()) {
        await client.query(
          "UPDATE pages SET position = $1 WHERE id = $2 AND tenant_id = $3",
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

  router.patch("/rows/:rowId/values", async (req, res) => {
    const tenantId = tenantIdOf(res);
    const row = await pool.query(
      "SELECT id FROM pages WHERE id = $1 AND tenant_id = $2 AND type = 'row'",
      [req.params.rowId, tenantId],
    );
    if (!row.rows[0]) {
      res.status(404).json({ error: "row not found" });
      return;
    }
    const { propertyId, value } = (req.body ?? {}) as {
      propertyId?: string;
      value?: unknown;
    };
    const prop = await pool.query(
      "SELECT id FROM properties WHERE id = $1 AND tenant_id = $2",
      [propertyId, tenantId],
    );
    if (!prop.rows[0]) {
      res.status(400).json({ error: "property not found" });
      return;
    }
    await pool.query(
      "INSERT INTO row_values (tenant_id, row_id, property_id, value) VALUES ($1, $2, $3, $4) ON CONFLICT (row_id, property_id) DO UPDATE SET value = excluded.value",
      [tenantId, req.params.rowId, propertyId, JSON.stringify(value ?? null)],
    );
    res.json({ ok: true });
  });

  router.get("/rows/:rowId", async (req, res) => {
    const tenantId = tenantIdOf(res);
    const rowResult = await pool.query<{
      id: string;
      parent_id: string;
      title: string;
    }>(
      "SELECT id, parent_id, title FROM pages WHERE id = $1 AND tenant_id = $2 AND type = 'row'",
      [req.params.rowId, tenantId],
    );
    const row = rowResult.rows[0] as
      { id: string; parent_id: string; title: string } | undefined;
    if (!row) {
      res.status(404).json({ error: "row not found" });
      return;
    }
    const properties = await q.propertiesOf(row.parent_id, tenantId);
    const withOptions = await Promise.all(
      properties.map(async (p) => ({
        ...p,
        options: await q.optionsOf(p.id, tenantId),
      })),
    );
    const values: Record<string, unknown> = {};
    const stored = await pool.query<{
      property_id: string;
      value: string | null;
    }>(
      "SELECT property_id, value FROM row_values WHERE row_id = $1 AND tenant_id = $2",
      [row.id, tenantId],
    );
    for (const v of stored.rows) {
      values[v.property_id] =
        v.value === null ? null : (JSON.parse(v.value) as unknown);
    }
    const parent = await pool.query<{ title: string }>(
      "SELECT title FROM pages WHERE id = $1 AND tenant_id = $2",
      [row.parent_id, tenantId],
    );
    res.json({
      id: row.id,
      database_id: row.parent_id,
      database_title: parent.rows[0]?.title ?? "",
      title: row.title,
      properties: withOptions,
      values,
    });
  });
}

function viewRoutes(router: Router, pool: Pool, q: Queries) {
  router.patch("/databases/:id/views/:kind", async (req, res) => {
    const tenantId = tenantIdOf(res);
    if (!(await q.getDb(req.params.id, tenantId))) {
      res.status(404).json({ error: "database not found" });
      return;
    }
    if (!isViewKind(req.params.kind)) {
      res.status(400).json({ error: "unknown view kind" });
      return;
    }
    const existing = await pool.query<{ config: string }>(
      "SELECT config FROM views WHERE database_id = $1 AND kind = $2 AND tenant_id = $3",
      [req.params.id, req.params.kind, tenantId],
    );
    const config = {
      ...DEFAULT_VIEW,
      ...(existing.rows[0]
        ? (JSON.parse(existing.rows[0].config) as object)
        : {}),
      ...((req.body ?? {}) as object),
    };
    await pool.query(
      "INSERT INTO views (tenant_id, database_id, kind, config) VALUES ($1, $2, $3, $4) ON CONFLICT (database_id, kind) DO UPDATE SET config = excluded.config",
      [tenantId, req.params.id, req.params.kind, JSON.stringify(config)],
    );
    res.json(config);
  });
}

export function databasesRouter(pool: Pool): Router {
  const router = Router();
  const q = queries(pool);
  databaseRoutes(router, pool, q);
  propertyRoutes(router, pool, q);
  rowRoutes(router, pool, q);
  viewRoutes(router, pool, q);
  return router;
}
