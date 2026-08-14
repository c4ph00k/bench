import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import { openDb } from "../../src/space/db.js";
import { openDb as openCrmDb } from "../../src/crm/db.js";
import { createApp } from "../../src/app.js";
import { seedIfEmpty } from "../../src/space/seed.js";
import { buildTree } from "../../src/space/routes/pages.js";
import type Database from "better-sqlite3";
import type express from "express";

let db: Database.Database;
let app: express.Express;

beforeEach(() => {
  db = openDb(":memory:");
  app = createApp({ crm: openCrmDb(":memory:"), space: db });
});

describe("pages API", () => {
  it("creates a page and returns it in the tree", async () => {
    const created = await request(app).post("/api/space/pages").send({ title: "Alpha", icon: "🅰️" });
    expect(created.status).toBe(201);
    expect(created.body.title).toBe("Alpha");

    const tree = await request(app).get("/api/space/tree");
    expect(tree.body).toHaveLength(1);
    expect(tree.body[0].icon).toBe("🅰️");
  });

  it("nests pages under a parent and orders siblings by position", async () => {
    const parent = (await request(app).post("/api/space/pages").send({ title: "Parent" })).body;
    await request(app).post("/api/space/pages").send({ title: "First", parentId: parent.id });
    await request(app).post("/api/space/pages").send({ title: "Second", parentId: parent.id });

    const tree = (await request(app).get("/api/space/tree")).body;
    expect(tree[0].children.map((c: any) => c.title)).toEqual(["First", "Second"]);
  });

  it("rejects an unknown parent and a bad type", async () => {
    const bad = await request(app).post("/api/space/pages").send({ title: "X", parentId: "nope" });
    expect(bad.status).toBe(400);
    const badType = await request(app).post("/api/space/pages").send({ title: "X", type: "row" });
    expect(badType.status).toBe(400);
  });

  it("reads a single page with its blocks array", async () => {
    const page = (await request(app).post("/api/space/pages").send({ title: "Solo" })).body;
    const res = await request(app).get(`/api/space/pages/${page.id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Solo");
    expect(res.body.blocks).toEqual([]);
    expect((await request(app).get("/api/space/pages/missing")).status).toBe(404);
  });

  it("renames a page and updates its icon", async () => {
    const page = (await request(app).post("/api/space/pages").send({ title: "Old" })).body;
    const renamed = await request(app).patch(`/api/space/pages/${page.id}`).send({ title: "New", icon: "🚀" });
    expect(renamed.body.title).toBe("New");
    expect(renamed.body.icon).toBe("🚀");
    const cleared = await request(app).patch(`/api/space/pages/${page.id}`).send({ icon: null });
    expect(cleared.body.icon).toBeNull();
    expect((await request(app).patch("/api/space/pages/missing").send({ title: "x" })).status).toBe(404);
  });

  it("deletes a page and cascades to all descendants", async () => {
    const a = (await request(app).post("/api/space/pages").send({ title: "A" })).body;
    const b = (await request(app).post("/api/space/pages").send({ title: "B", parentId: a.id })).body;
    const c = (await request(app).post("/api/space/pages").send({ title: "C", parentId: b.id })).body;

    const del = await request(app).delete(`/api/space/pages/${a.id}`);
    expect(del.body.ok).toBe(true);
    for (const id of [a.id, b.id, c.id]) {
      expect((await request(app).get(`/api/space/pages/${id}`)).status).toBe(404);
    }
    expect((await request(app).delete("/api/space/pages/missing")).status).toBe(404);
  });
});

describe("seed", () => {
  it("populates an empty database once, several levels deep, with icons", () => {
    seedIfEmpty(db);
    const count = (db.prepare("SELECT COUNT(*) AS c FROM pages").get() as any).c;
    expect(count).toBeGreaterThan(10);
    seedIfEmpty(db);
    expect((db.prepare("SELECT COUNT(*) AS c FROM pages").get() as any).c).toBe(count);

    const depth3 = db
      .prepare(
        `SELECT p3.title FROM pages p3
         JOIN pages p2 ON p3.parent_id = p2.id
         JOIN pages p1 ON p2.parent_id = p1.id
         WHERE p1.parent_id IS NULL`,
      )
      .all();
    expect(depth3.length).toBeGreaterThan(0);
    const noIcon = db.prepare("SELECT COUNT(*) AS c FROM pages WHERE icon IS NULL AND type != 'row'").get() as any;
    expect(noIcon.c).toBe(0);
  });
});

describe("buildTree", () => {
  it("attaches children to parents and returns roots", () => {
    const rows = [
      { id: "1", parent_id: null, type: "page", title: "Root", icon: null, position: 0 },
      { id: "2", parent_id: "1", type: "page", title: "Child", icon: null, position: 0 },
      { id: "3", parent_id: "missing", type: "page", title: "Orphan", icon: null, position: 1 },
    ] as any;
    const tree = buildTree(rows);
    expect(tree.map((n) => n.title)).toEqual(["Root", "Orphan"]);
    expect(tree[0].children[0].title).toBe("Child");
  });
});
