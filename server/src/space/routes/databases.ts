import { Router } from "express";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { PropertyOptionRow, PropertyRow } from "../db.js";
import { asText } from "../text.js";

export const PROPERTY_TYPES = [
  "text",
  "number",
  "select",
  "multi_select",
  "date",
  "checkbox",
  "url",
] as const;
export const VIEW_KINDS = ["table", "board", "list"] as const;
export const OPTION_COLORS = [
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

const UPSERT_VALUE =
  "INSERT INTO row_values (row_id, property_id, value) VALUES (?, ?, ?) ON CONFLICT(row_id, property_id) DO UPDATE SET value = excluded.value";

/** The projections these queries select, rather than whole rows. */
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
interface RowSummary {
  id: string;
  title: string;
  icon: string | null;
  position: number;
}
interface NextPosition {
  pos: number;
}

function isPropertyType(value: string): boolean {
  return (PROPERTY_TYPES as readonly string[]).includes(value);
}

function isViewKind(value: string): boolean {
  return (VIEW_KINDS as readonly string[]).includes(value);
}

/** The reads every group of routes below needs, bound to one connection. */
interface Queries {
  db: Database.Database;
  getDb: (id: string) => DatabasePage | undefined;
  optionsOf: (propertyId: string) => OptionSummary[];
  propertiesOf: (databaseId: string) => PropertySummary[];
  nextPosition: (sql: string, id: string) => number;
}

function queriesFor(db: Database.Database): Queries {
  return {
    db,
    getDb: (id) =>
      db
        .prepare("SELECT * FROM pages WHERE id = ? AND type = 'database'")
        .get(id) as DatabasePage | undefined,
    optionsOf: (propertyId) =>
      db
        .prepare(
          "SELECT id, name, color, position FROM property_options WHERE property_id = ? ORDER BY position",
        )
        .all(propertyId) as OptionSummary[],
    propertiesOf: (databaseId) =>
      db
        .prepare(
          "SELECT id, name, type, position FROM properties WHERE database_id = ? ORDER BY position",
        )
        .all(databaseId) as PropertySummary[],
    nextPosition: (sql, id) => (db.prepare(sql).get(id) as NextPosition).pos,
  };
}

/** Reading a whole database: its properties with options, its rows with values, and its views. */
function registerDatabaseRoutes(router: Router, q: Queries) {
  router.get("/databases/:id", (req, res) => {
    const page = q.getDb(req.params.id);
    if (!page) {
      res.status(404).json({ error: "database not found" });
      return;
    }
    const properties = q.propertiesOf(req.params.id);
    const optionsByProp = new Map<string, OptionSummary[]>();
    for (const p of properties) optionsByProp.set(p.id, q.optionsOf(p.id));
    const rows = q.db
      .prepare(
        "SELECT id, title, icon, position FROM pages WHERE parent_id = ? AND type = 'row' ORDER BY position",
      )
      .all(req.params.id) as RowSummary[];
    const values = q.db
      .prepare(
        `SELECT rv.row_id, rv.property_id, rv.value FROM row_values rv
         JOIN pages p ON p.id = rv.row_id WHERE p.parent_id = ?`,
      )
      .all(req.params.id) as {
      row_id: string;
      property_id: string;
      value: string | null;
    }[];
    const valuesByRow = new Map<string, Record<string, unknown>>();
    for (const v of values) {
      const map = valuesByRow.get(v.row_id) ?? {};
      map[v.property_id] =
        v.value === null ? null : (JSON.parse(v.value) as unknown);
      valuesByRow.set(v.row_id, map);
    }
    const views: Record<string, unknown> = {};
    for (const kind of VIEW_KINDS) {
      const row = q.db
        .prepare("SELECT config FROM views WHERE database_id = ? AND kind = ?")
        .get(req.params.id, kind) as { config: string } | undefined;
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
      rows: rows.map((r) => ({ ...r, values: valuesByRow.get(r.id) ?? {} })),
      views,
    });
  });
}

function registerPropertyRoutes(router: Router, q: Queries) {
  router.post("/databases/:id/properties", (req, res) => {
    if (!q.getDb(req.params.id)) {
      res.status(404).json({ error: "database not found" });
      return;
    }
    // `name` stays unknown: it is untrusted JSON, and asText is a real coercion rather than the
    // redundant one a `string` type would have implied.
    const { name = "", type = "" } = (req.body ?? {}) as {
      name?: unknown;
      type?: string;
    };
    if (!isPropertyType(type)) {
      res.status(400).json({ error: `unknown property type '${type}'` });
      return;
    }
    const pos = q.nextPosition(
      "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM properties WHERE database_id = ?",
      req.params.id,
    );
    const id = randomUUID();
    q.db
      .prepare(
        "INSERT INTO properties (id, database_id, name, type, position) VALUES (?, ?, ?, ?, ?)",
      )
      .run(id, req.params.id, asText(name), type, pos);
    res
      .status(201)
      .json({ id, name: asText(name), type, position: pos, options: [] });
  });

  router.patch("/properties/:id", (req, res) => {
    const prop = q.db
      .prepare("SELECT * FROM properties WHERE id = ?")
      .get(req.params.id) as PropertyRow | undefined;
    if (!prop) {
      res.status(404).json({ error: "property not found" });
      return;
    }
    const { name, type } = (req.body ?? {}) as {
      name?: unknown;
      type?: string;
    };
    if (type !== undefined && type !== prop.type) {
      res
        .status(400)
        .json({ error: "a property's type is fixed once created" });
      return;
    }
    if (name !== undefined) {
      q.db
        .prepare("UPDATE properties SET name = ? WHERE id = ?")
        .run(asText(name), req.params.id);
    }
    res.json(
      q.db.prepare("SELECT * FROM properties WHERE id = ?").get(req.params.id),
    );
  });

  router.delete("/properties/:id", (req, res) => {
    const result = q.db
      .prepare("DELETE FROM properties WHERE id = ?")
      .run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: "property not found" });
      return;
    }
    res.json({ ok: true });
  });

  router.post("/properties/:id/options", (req, res) => {
    const prop = q.db
      .prepare("SELECT * FROM properties WHERE id = ?")
      .get(req.params.id) as PropertyRow | undefined;
    if (!prop) {
      res.status(404).json({ error: "property not found" });
      return;
    }
    if (prop.type !== "select" && prop.type !== "multi_select") {
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
    const pos = q.nextPosition(
      "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM property_options WHERE property_id = ?",
      req.params.id,
    );
    const id = randomUUID();
    q.db
      .prepare(
        "INSERT INTO property_options (id, property_id, name, color, position) VALUES (?, ?, ?, ?, ?)",
      )
      .run(id, req.params.id, name, chosen, pos);
    res.status(201).json({ id, name, color: chosen, position: pos });
  });
}

function registerRowRoutes(router: Router, q: Queries) {
  router.post("/databases/:id/rows", (req, res) => {
    if (!q.getDb(req.params.id)) {
      res.status(404).json({ error: "database not found" });
      return;
    }
    const { title = "", values = {} } = (req.body ?? {}) as {
      title?: unknown;
      values?: Record<string, unknown>;
    };
    const pos = q.nextPosition(
      "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM pages WHERE parent_id = ?",
      req.params.id,
    );
    const id = randomUUID();
    q.db
      .prepare(
        "INSERT INTO pages (id, parent_id, type, title, position) VALUES (?, ?, 'row', ?, ?)",
      )
      .run(id, req.params.id, asText(title), pos);
    const upsert = q.db.prepare(UPSERT_VALUE);
    for (const [propId, value] of Object.entries(values)) {
      upsert.run(id, propId, JSON.stringify(value));
    }
    res
      .status(201)
      .json({ id, title: asText(title), icon: null, position: pos, values });
  });

  /** Reorder the rows of a database; ids must be a permutation of its current rows. */
  router.put("/databases/:id/rows/order", (req, res) => {
    // Shape asserted here, then checked below against the database's actual row ids.
    const { ids } = (req.body ?? {}) as { ids?: string[] };
    const existing = (
      q.db
        .prepare(
          "SELECT id FROM pages WHERE parent_id = ? AND type = 'row' ORDER BY position",
        )
        .all(req.params.id) as { id: string }[]
    ).map((r) => r.id);
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
    const update = q.db.prepare("UPDATE pages SET position = ? WHERE id = ?");
    q.db.transaction(() => {
      ids.forEach((id, i) => update.run(i, id));
    })();
    res.json({ ok: true });
  });

  router.patch("/rows/:rowId/values", (req, res) => {
    const row = q.db
      .prepare("SELECT * FROM pages WHERE id = ? AND type = 'row'")
      .get(req.params.rowId);
    if (!row) {
      res.status(404).json({ error: "row not found" });
      return;
    }
    const { propertyId, value } = (req.body ?? {}) as {
      propertyId?: string;
      value?: unknown;
    };
    if (
      !q.db.prepare("SELECT id FROM properties WHERE id = ?").get(propertyId)
    ) {
      res.status(400).json({ error: "property not found" });
      return;
    }
    q.db
      .prepare(UPSERT_VALUE)
      .run(req.params.rowId, propertyId, JSON.stringify(value ?? null));
    res.json({ ok: true });
  });

  router.get("/rows/:rowId", (req, res) => {
    const row = q.db
      .prepare("SELECT * FROM pages WHERE id = ? AND type = 'row'")
      .get(req.params.rowId) as
      { id: string; parent_id: string; title: string } | undefined;
    if (!row) {
      res.status(404).json({ error: "row not found" });
      return;
    }
    const properties = q.propertiesOf(row.parent_id).map((p) => ({
      ...p,
      options: q.optionsOf(p.id),
    }));
    const values: Record<string, unknown> = {};
    const stored = q.db
      .prepare("SELECT property_id, value FROM row_values WHERE row_id = ?")
      .all(row.id) as { property_id: string; value: string | null }[];
    for (const v of stored) {
      values[v.property_id] =
        v.value === null ? null : (JSON.parse(v.value) as unknown);
    }
    const parent = q.db
      .prepare("SELECT title FROM pages WHERE id = ?")
      .get(row.parent_id) as { title: string } | undefined;
    res.json({
      id: row.id,
      database_id: row.parent_id,
      database_title: parent?.title ?? "",
      title: row.title,
      properties,
      values,
    });
  });
}

function registerViewRoutes(router: Router, q: Queries) {
  router.patch("/databases/:id/views/:kind", (req, res) => {
    if (!q.getDb(req.params.id)) {
      res.status(404).json({ error: "database not found" });
      return;
    }
    if (!isViewKind(req.params.kind)) {
      res.status(400).json({ error: "unknown view kind" });
      return;
    }
    const existing = q.db
      .prepare("SELECT config FROM views WHERE database_id = ? AND kind = ?")
      .get(req.params.id, req.params.kind) as { config: string } | undefined;
    const config = {
      ...DEFAULT_VIEW,
      ...(existing ? (JSON.parse(existing.config) as object) : {}),
      ...((req.body ?? {}) as object),
    };
    q.db
      .prepare(
        "INSERT INTO views (database_id, kind, config) VALUES (?, ?, ?) ON CONFLICT(database_id, kind) DO UPDATE SET config = excluded.config",
      )
      .run(req.params.id, req.params.kind, JSON.stringify(config));
    res.json(config);
  });
}

export function databasesRouter(db: Database.Database): Router {
  const router = Router();
  const q = queriesFor(db);
  registerDatabaseRoutes(router, q);
  registerPropertyRoutes(router, q);
  registerRowRoutes(router, q);
  registerViewRoutes(router, q);
  return router;
}
