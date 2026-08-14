import { Router } from "express";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

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

export function databasesRouter(db: Database.Database): Router {
  const router = Router();

  const getDb = (id: string) =>
    db
      .prepare("SELECT * FROM pages WHERE id = ? AND type = 'database'")
      .get(id) as any;

  router.get("/databases/:id", (req, res) => {
    const page = getDb(req.params.id);
    if (!page) {
      res.status(404).json({ error: "database not found" });
      return;
    }
    const properties = db
      .prepare(
        "SELECT id, name, type, position FROM properties WHERE database_id = ? ORDER BY position",
      )
      .all(req.params.id) as any[];
    const optionsByProp = new Map<string, any[]>();
    for (const p of properties) {
      optionsByProp.set(
        p.id,
        db
          .prepare(
            "SELECT id, name, color, position FROM property_options WHERE property_id = ? ORDER BY position",
          )
          .all(p.id),
      );
    }
    const rows = db
      .prepare(
        "SELECT id, title, icon, position FROM pages WHERE parent_id = ? AND type = 'row' ORDER BY position",
      )
      .all(req.params.id) as any[];
    const values = db
      .prepare(
        `SELECT rv.row_id, rv.property_id, rv.value FROM row_values rv
         JOIN pages p ON p.id = rv.row_id WHERE p.parent_id = ?`,
      )
      .all(req.params.id) as any[];
    const valuesByRow = new Map<string, Record<string, unknown>>();
    for (const v of values) {
      const map = valuesByRow.get(v.row_id) ?? {};
      map[v.property_id] = v.value === null ? null : JSON.parse(v.value);
      valuesByRow.set(v.row_id, map);
    }
    const views: Record<string, unknown> = {};
    for (const kind of VIEW_KINDS) {
      const row = db
        .prepare("SELECT config FROM views WHERE database_id = ? AND kind = ?")
        .get(req.params.id, kind) as any;
      views[kind] = row
        ? { ...DEFAULT_VIEW, ...JSON.parse(row.config) }
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

  router.post("/databases/:id/properties", (req, res) => {
    if (!getDb(req.params.id)) {
      res.status(404).json({ error: "database not found" });
      return;
    }
    const { name = "", type } = req.body ?? {};
    if (!PROPERTY_TYPES.includes(type)) {
      res.status(400).json({ error: `unknown property type '${type}'` });
      return;
    }
    const { pos } = db
      .prepare(
        "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM properties WHERE database_id = ?",
      )
      .get(req.params.id) as any;
    const id = randomUUID();
    db.prepare(
      "INSERT INTO properties (id, database_id, name, type, position) VALUES (?, ?, ?, ?, ?)",
    ).run(id, req.params.id, String(name), type, pos);
    res
      .status(201)
      .json({ id, name: String(name), type, position: pos, options: [] });
  });

  router.patch("/properties/:id", (req, res) => {
    const prop = db
      .prepare("SELECT * FROM properties WHERE id = ?")
      .get(req.params.id) as any;
    if (!prop) {
      res.status(404).json({ error: "property not found" });
      return;
    }
    const { name, type } = req.body ?? {};
    if (type !== undefined && type !== prop.type) {
      res
        .status(400)
        .json({ error: "a property's type is fixed once created" });
      return;
    }
    if (name !== undefined) {
      db.prepare("UPDATE properties SET name = ? WHERE id = ?").run(
        String(name),
        req.params.id,
      );
    }
    res.json(
      db.prepare("SELECT * FROM properties WHERE id = ?").get(req.params.id),
    );
  });

  router.delete("/properties/:id", (req, res) => {
    const result = db
      .prepare("DELETE FROM properties WHERE id = ?")
      .run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: "property not found" });
      return;
    }
    res.json({ ok: true });
  });

  router.post("/properties/:id/options", (req, res) => {
    const prop = db
      .prepare("SELECT * FROM properties WHERE id = ?")
      .get(req.params.id) as any;
    if (!prop) {
      res.status(404).json({ error: "property not found" });
      return;
    }
    if (prop.type !== "select" && prop.type !== "multi_select") {
      res
        .status(400)
        .json({
          error: "options only apply to select and multi-select properties",
        });
      return;
    }
    const { name } = req.body ?? {};
    const color = OPTION_COLORS.includes(req.body?.color)
      ? req.body.color
      : "gray";
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "option name required" });
      return;
    }
    const { pos } = db
      .prepare(
        "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM property_options WHERE property_id = ?",
      )
      .get(req.params.id) as any;
    const id = randomUUID();
    db.prepare(
      "INSERT INTO property_options (id, property_id, name, color, position) VALUES (?, ?, ?, ?, ?)",
    ).run(id, req.params.id, name, String(color), pos);
    res.status(201).json({ id, name, color: String(color), position: pos });
  });

  router.post("/databases/:id/rows", (req, res) => {
    if (!getDb(req.params.id)) {
      res.status(404).json({ error: "database not found" });
      return;
    }
    const { title = "", values = {} } = req.body ?? {};
    const { pos } = db
      .prepare(
        "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM pages WHERE parent_id = ?",
      )
      .get(req.params.id) as any;
    const id = randomUUID();
    db.prepare(
      "INSERT INTO pages (id, parent_id, type, title, position) VALUES (?, ?, 'row', ?, ?)",
    ).run(id, req.params.id, String(title), pos);
    const upsert = db.prepare(
      "INSERT INTO row_values (row_id, property_id, value) VALUES (?, ?, ?) ON CONFLICT(row_id, property_id) DO UPDATE SET value = excluded.value",
    );
    for (const [propId, value] of Object.entries(
      values as Record<string, unknown>,
    )) {
      upsert.run(id, propId, JSON.stringify(value));
    }
    res
      .status(201)
      .json({ id, title: String(title), icon: null, position: pos, values });
  });

  /** Reorder the rows of a database; ids must be a permutation of its current rows. */
  router.put("/databases/:id/rows/order", (req, res) => {
    const { ids } = req.body ?? {};
    const existing = db
      .prepare(
        "SELECT id FROM pages WHERE parent_id = ? AND type = 'row' ORDER BY position",
      )
      .all(req.params.id)
      .map((r: any) => r.id);
    const existingSet = new Set(existing);
    if (
      !Array.isArray(ids) ||
      ids.length !== existing.length ||
      new Set(ids).size !== ids.length ||
      !ids.every((id: string) => existingSet.has(id))
    ) {
      res
        .status(400)
        .json({ error: "ids must be a permutation of the database's row ids" });
      return;
    }
    const update = db.prepare("UPDATE pages SET position = ? WHERE id = ?");
    db.transaction(() => {
      ids.forEach((id: string, i: number) => update.run(i, id));
    })();
    res.json({ ok: true });
  });

  router.patch("/rows/:rowId/values", (req, res) => {
    const row = db
      .prepare("SELECT * FROM pages WHERE id = ? AND type = 'row'")
      .get(req.params.rowId);
    if (!row) {
      res.status(404).json({ error: "row not found" });
      return;
    }
    const { propertyId, value } = req.body ?? {};
    if (!db.prepare("SELECT id FROM properties WHERE id = ?").get(propertyId)) {
      res.status(400).json({ error: "property not found" });
      return;
    }
    db.prepare(
      "INSERT INTO row_values (row_id, property_id, value) VALUES (?, ?, ?) ON CONFLICT(row_id, property_id) DO UPDATE SET value = excluded.value",
    ).run(req.params.rowId, propertyId, JSON.stringify(value ?? null));
    res.json({ ok: true });
  });

  router.get("/rows/:rowId", (req, res) => {
    const row = db
      .prepare("SELECT * FROM pages WHERE id = ? AND type = 'row'")
      .get(req.params.rowId) as any;
    if (!row) {
      res.status(404).json({ error: "row not found" });
      return;
    }
    const properties = db
      .prepare(
        "SELECT id, name, type, position FROM properties WHERE database_id = ? ORDER BY position",
      )
      .all(row.parent_id) as any[];
    for (const p of properties) {
      (p as any).options = db
        .prepare(
          "SELECT id, name, color, position FROM property_options WHERE property_id = ? ORDER BY position",
        )
        .all(p.id);
    }
    const values: Record<string, unknown> = {};
    for (const v of db
      .prepare("SELECT property_id, value FROM row_values WHERE row_id = ?")
      .all(row.id) as any[]) {
      values[v.property_id] = v.value === null ? null : JSON.parse(v.value);
    }
    const parent = db
      .prepare("SELECT title FROM pages WHERE id = ?")
      .get(row.parent_id) as any;
    res.json({
      id: row.id,
      database_id: row.parent_id,
      database_title: parent?.title ?? "",
      title: row.title,
      properties,
      values,
    });
  });

  router.patch("/databases/:id/views/:kind", (req, res) => {
    if (!getDb(req.params.id)) {
      res.status(404).json({ error: "database not found" });
      return;
    }
    if (!VIEW_KINDS.includes(req.params.kind as any)) {
      res.status(400).json({ error: "unknown view kind" });
      return;
    }
    const existing = db
      .prepare("SELECT config FROM views WHERE database_id = ? AND kind = ?")
      .get(req.params.id, req.params.kind) as any;
    const config = {
      ...DEFAULT_VIEW,
      ...(existing ? JSON.parse(existing.config) : {}),
      ...(req.body ?? {}),
    };
    db.prepare(
      "INSERT INTO views (database_id, kind, config) VALUES (?, ?, ?) ON CONFLICT(database_id, kind) DO UPDATE SET config = excluded.config",
    ).run(req.params.id, req.params.kind, JSON.stringify(config));
    res.json(config);
  });

  return router;
}
