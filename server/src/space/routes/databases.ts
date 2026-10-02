import { Router, type Response } from "express";
import { requestDb } from "../../db/rls.js";
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

async function getDb(
  res: Response,
  id: string,
): Promise<DatabasePage | undefined> {
  const result = await requestDb(res).query<DatabasePage>(
    "SELECT id, title, icon FROM pages WHERE id = $1 AND tenant_id = $2 AND type = 'database'",
    [id, tenantIdOf(res)],
  );
  return result.rows[0];
}

async function optionsOf(
  res: Response,
  propertyId: string,
): Promise<OptionSummary[]> {
  const result = await requestDb(res).query<OptionSummary>(
    "SELECT id, name, color, position FROM property_options WHERE property_id = $1 AND tenant_id = $2 ORDER BY position",
    [propertyId, tenantIdOf(res)],
  );
  return result.rows;
}

async function propertiesOf(
  res: Response,
  databaseId: string,
): Promise<PropertySummary[]> {
  const result = await requestDb(res).query<PropertySummary>(
    "SELECT id, name, type, position FROM properties WHERE database_id = $1 AND tenant_id = $2 ORDER BY position",
    [databaseId, tenantIdOf(res)],
  );
  return result.rows;
}

async function nextPosition(
  res: Response,
  sql: string,
  id: string,
): Promise<number> {
  const result = await requestDb(res).query<{ pos: number }>(sql, [
    id,
    tenantIdOf(res),
  ]);
  return result.rows[0].pos;
}

function databaseRoutes(router: Router) {
  router.get("/databases/:id", async (req, res) => {
    const tenantId = tenantIdOf(res);
    const page = await getDb(res, req.params.id);
    if (!page) {
      res.status(404).json({ error: "database not found" });
      return;
    }
    const properties = await propertiesOf(res, req.params.id);
    const optionsByProp = new Map<string, OptionSummary[]>();
    for (const p of properties)
      optionsByProp.set(p.id, await optionsOf(res, p.id));
    const rowResult = await requestDb(res).query<{
      id: string;
      title: string;
      icon: string | null;
      position: number;
    }>(
      "SELECT id, title, icon, position FROM pages WHERE parent_id = $1 AND tenant_id = $2 AND type = 'row' ORDER BY position",
      [req.params.id, tenantId],
    );
    const values = await requestDb(res).query<{
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
      const cur = await requestDb(res).query<{ config: string }>(
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

function propertyRoutes(router: Router) {
  router.post("/databases/:id/properties", async (req, res) => {
    if (!(await getDb(res, req.params.id))) {
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
    const pos = await nextPosition(
      res,
      "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM properties WHERE database_id = $1 AND tenant_id = $2",
      req.params.id,
    );
    const id = randomUUID();
    await requestDb(res).query(
      "INSERT INTO properties (id, tenant_id, database_id, name, type, position) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, tenantIdOf(res), req.params.id, asText(name), type, pos],
    );
    res
      .status(201)
      .json({ id, name: asText(name), type, position: pos, options: [] });
  });

  router.patch("/properties/:id", async (req, res) => {
    const prop = await requestDb(res).query<PropertyRow>(
      "SELECT * FROM properties WHERE id = $1 AND tenant_id = $2",
      [req.params.id, tenantIdOf(res)],
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
      await requestDb(res).query(
        "UPDATE properties SET name = $1 WHERE id = $2 AND tenant_id = $3",
        [asText(name), req.params.id, tenantIdOf(res)],
      );
    }
    const updated = await requestDb(res).query(
      "SELECT * FROM properties WHERE id = $1 AND tenant_id = $2",
      [req.params.id, tenantIdOf(res)],
    );
    res.json(updated.rows[0]);
  });

  router.delete("/properties/:id", async (req, res) => {
    const result = await requestDb(res).query(
      "DELETE FROM properties WHERE id = $1 AND tenant_id = $2",
      [req.params.id, tenantIdOf(res)],
    );
    if ((result.rowCount ?? 0) === 0) {
      res.status(404).json({ error: "property not found" });
      return;
    }
    res.json({ ok: true });
  });

  router.post("/properties/:id/options", async (req, res) => {
    const prop = await requestDb(res).query<PropertyRow>(
      "SELECT * FROM properties WHERE id = $1 AND tenant_id = $2",
      [req.params.id, tenantIdOf(res)],
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
    const pos = await nextPosition(
      res,
      "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM property_options WHERE property_id = $1 AND tenant_id = $2",
      req.params.id,
    );
    const id = randomUUID();
    await requestDb(res).query(
      "INSERT INTO property_options (id, tenant_id, property_id, name, color, position) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, tenantIdOf(res), req.params.id, name, chosen, pos],
    );
    res.status(201).json({ id, name, color: chosen, position: pos });
  });

  router.put("/properties/:id/options/order", async (req, res) => {
    const { ids } = (req.body ?? {}) as { ids?: string[] };
    const existing = (await optionsOf(res, req.params.id)).map((o) => o.id);
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
    for (const [i, id] of ids.entries()) {
      await requestDb(res).query(
        "UPDATE property_options SET position = $1 WHERE id = $2 AND tenant_id = $3",
        [i, id, tenantIdOf(res)],
      );
    }
    res.json({ ok: true });
  });
}

function rowRoutes(router: Router) {
  router.post("/databases/:id/rows", async (req, res) => {
    if (!(await getDb(res, req.params.id))) {
      res.status(404).json({ error: "database not found" });
      return;
    }
    const { title = "", values = {} } = (req.body ?? {}) as {
      title?: unknown;
      values?: Record<string, unknown>;
    };
    const pos = await nextPosition(
      res,
      "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM pages WHERE parent_id = $1 AND tenant_id = $2",
      req.params.id,
    );
    const id = randomUUID();
    await requestDb(res).query(
      "INSERT INTO pages (id, tenant_id, parent_id, type, title, position) VALUES ($1, $2, $3, 'row', $4, $5)",
      [id, tenantIdOf(res), req.params.id, asText(title), pos],
    );
    for (const [propId, value] of Object.entries(values)) {
      await requestDb(res).query(
        "INSERT INTO row_values (tenant_id, row_id, property_id, value) VALUES ($1, $2, $3, $4) ON CONFLICT (row_id, property_id) DO UPDATE SET value = excluded.value",
        [tenantIdOf(res), id, propId, JSON.stringify(value)],
      );
    }
    res
      .status(201)
      .json({ id, title: asText(title), icon: null, position: pos, values });
  });

  router.put("/databases/:id/rows/order", async (req, res) => {
    const { ids } = (req.body ?? {}) as { ids?: string[] };
    const existingResult = await requestDb(res).query<{ id: string }>(
      "SELECT id FROM pages WHERE parent_id = $1 AND tenant_id = $2 AND type = 'row' ORDER BY position",
      [req.params.id, tenantIdOf(res)],
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
    for (const [i, id] of ids.entries()) {
      await requestDb(res).query(
        "UPDATE pages SET position = $1 WHERE id = $2 AND tenant_id = $3",
        [i, id, tenantIdOf(res)],
      );
    }
    res.json({ ok: true });
  });

  router.patch("/rows/:rowId/values", async (req, res) => {
    const row = await requestDb(res).query(
      "SELECT id FROM pages WHERE id = $1 AND tenant_id = $2 AND type = 'row'",
      [req.params.rowId, tenantIdOf(res)],
    );
    if (!row.rows[0]) {
      res.status(404).json({ error: "row not found" });
      return;
    }
    const { propertyId, value } = (req.body ?? {}) as {
      propertyId?: string;
      value?: unknown;
    };
    const prop = await requestDb(res).query(
      "SELECT id FROM properties WHERE id = $1 AND tenant_id = $2",
      [propertyId, tenantIdOf(res)],
    );
    if (!prop.rows[0]) {
      res.status(400).json({ error: "property not found" });
      return;
    }
    await requestDb(res).query(
      "INSERT INTO row_values (tenant_id, row_id, property_id, value) VALUES ($1, $2, $3, $4) ON CONFLICT (row_id, property_id) DO UPDATE SET value = excluded.value",
      [
        tenantIdOf(res),
        req.params.rowId,
        propertyId,
        JSON.stringify(value ?? null),
      ],
    );
    res.json({ ok: true });
  });

  router.get("/rows/:rowId", async (req, res) => {
    const rowResult = await requestDb(res).query<{
      id: string;
      parent_id: string;
      title: string;
    }>(
      "SELECT id, parent_id, title FROM pages WHERE id = $1 AND tenant_id = $2 AND type = 'row'",
      [req.params.rowId, tenantIdOf(res)],
    );
    const row = rowResult.rows[0] as
      { id: string; parent_id: string; title: string } | undefined;
    if (!row) {
      res.status(404).json({ error: "row not found" });
      return;
    }
    const properties = await propertiesOf(res, row.parent_id);
    const withOptions = await Promise.all(
      properties.map(async (p) => ({
        ...p,
        options: await optionsOf(res, p.id),
      })),
    );
    const values: Record<string, unknown> = {};
    const stored = await requestDb(res).query<{
      property_id: string;
      value: string | null;
    }>(
      "SELECT property_id, value FROM row_values WHERE row_id = $1 AND tenant_id = $2",
      [row.id, tenantIdOf(res)],
    );
    for (const v of stored.rows) {
      values[v.property_id] =
        v.value === null ? null : (JSON.parse(v.value) as unknown);
    }
    const parent = await requestDb(res).query<{ title: string }>(
      "SELECT title FROM pages WHERE id = $1 AND tenant_id = $2",
      [row.parent_id, tenantIdOf(res)],
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

function viewRoutes(router: Router) {
  router.patch("/databases/:id/views/:kind", async (req, res) => {
    if (!(await getDb(res, req.params.id))) {
      res.status(404).json({ error: "database not found" });
      return;
    }
    if (!isViewKind(req.params.kind)) {
      res.status(400).json({ error: "unknown view kind" });
      return;
    }
    const existing = await requestDb(res).query<{ config: string }>(
      "SELECT config FROM views WHERE database_id = $1 AND kind = $2 AND tenant_id = $3",
      [req.params.id, req.params.kind, tenantIdOf(res)],
    );
    const config = {
      ...DEFAULT_VIEW,
      ...(existing.rows[0]
        ? (JSON.parse(existing.rows[0].config) as object)
        : {}),
      ...((req.body ?? {}) as object),
    };
    await requestDb(res).query(
      "INSERT INTO views (tenant_id, database_id, kind, config) VALUES ($1, $2, $3, $4) ON CONFLICT (database_id, kind) DO UPDATE SET config = excluded.config",
      [tenantIdOf(res), req.params.id, req.params.kind, JSON.stringify(config)],
    );
    res.json(config);
  });
}

export function databasesRouter(): Router {
  const router = Router();
  databaseRoutes(router);
  propertyRoutes(router);
  rowRoutes(router);
  viewRoutes(router);
  return router;
}
