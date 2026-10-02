import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import type express from "express";
import { appWithSpace, sessionCookie } from "./app.js";
import type {
  DatabaseView,
  Option,
  Page,
  Property,
  Row,
  RowPage,
  TreeNode,
  View,
} from "./responses.js";

let app: express.Express;
let cookie: string;
let dbId: string;

beforeEach(async () => {
  app = await appWithSpace();
  cookie = await sessionCookie(app);
  dbId = (
    (
      await request(app)
        .post("/api/space/pages")
        .set("Cookie", cookie)
        .send({ title: "Books", type: "database" })
    ).body as Page
  ).id;
});

const addProp = async (name: string, type: string) =>
  (
    await request(app)
      .post(`/api/space/databases/${dbId}/properties`)
      .set("Cookie", cookie)
      .send({ name, type })
  ).body as Property;

const readDatabase = async () =>
  (await request(app).get(`/api/space/databases/${dbId}`).set("Cookie", cookie))
    .body as DatabaseView;

const addRow = async (title: string, values?: Record<string, unknown>) =>
  (
    await request(app)
      .post(`/api/space/databases/${dbId}/rows`)
      .set("Cookie", cookie)
      .send({ title, values })
  ).body as Row;

describe("databases API", () => {
  it("creates a database page that shows up in the tree", async () => {
    const tree = (
      await request(app).get("/api/space/tree").set("Cookie", cookie)
    ).body as TreeNode[];
    expect(tree.find((n) => n.id === dbId)!.type).toBe("database");
  });

  it("adds properties of every type and lists them in order", async () => {
    for (const [i, type] of [
      "text",
      "number",
      "select",
      "multi_select",
      "date",
      "checkbox",
      "url",
    ].entries()) {
      const p = await addProp(`P${i}`, type);
      expect(p.type).toBe(type);
    }
    const data = await readDatabase();
    expect(data.properties).toHaveLength(7);
    expect(data.properties.map((p) => p.name)).toEqual([
      "P0",
      "P1",
      "P2",
      "P3",
      "P4",
      "P5",
      "P6",
    ]);
  });

  it("rejects unknown property types and type changes after creation", async () => {
    expect(
      (
        await request(app)
          .post(`/api/space/databases/${dbId}/properties`)
          .set("Cookie", cookie)
          .send({ name: "X", type: "relation" })
      ).status,
    ).toBe(400);
    const p = await addProp("Status", "select");
    const rename = await request(app)
      .patch(`/api/space/properties/${p.id}`)
      .set("Cookie", cookie)
      .send({ name: "State" });
    expect((rename.body as Property).name).toBe("State");
    const retype = await request(app)
      .patch(`/api/space/properties/${p.id}`)
      .set("Cookie", cookie)
      .send({ type: "text" });
    expect(retype.status).toBe(400);
  });

  it("deletes a property and its values", async () => {
    const p = await addProp("Author", "text");
    const row = await addRow("Dune", { [p.id]: "Herbert" });
    await request(app)
      .delete(`/api/space/properties/${p.id}`)
      .set("Cookie", cookie);
    const data = await readDatabase();
    expect(data.properties).toHaveLength(0);
    expect(data.rows.find((r) => r.id === row.id)!.values).toEqual({});
  });

  it("creates colored options for selects only, shared across rows", async () => {
    const sel = await addProp("Status", "select");
    const opt = (
      await request(app)
        .post(`/api/space/properties/${sel.id}/options`)
        .set("Cookie", cookie)
        .send({ name: "Reading", color: "blue" })
    ).body as Option;
    expect(opt.color).toBe("blue");
    const text = await addProp("Author", "text");
    expect(
      (
        await request(app)
          .post(`/api/space/properties/${text.id}/options`)
          .set("Cookie", cookie)
          .send({ name: "Nope" })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post(`/api/space/properties/${sel.id}/options`)
          .set("Cookie", cookie)
          .send({})
      ).status,
    ).toBe(400);

    const data = await readDatabase();
    expect(data.properties[0].options).toHaveLength(1);
  });

  it("adds rows, edits values, and reads them back", async () => {
    const author = await addProp("Author", "text");
    const done = await addProp("Done", "checkbox");
    const row = await addRow("Dune");

    await request(app)
      .patch(`/api/space/rows/${row.id}/values`)
      .set("Cookie", cookie)
      .send({ propertyId: author.id, value: "Frank Herbert" });
    await request(app)
      .patch(`/api/space/rows/${row.id}/values`)
      .set("Cookie", cookie)
      .send({ propertyId: done.id, value: true });
    const bad = await request(app)
      .patch(`/api/space/rows/${row.id}/values`)
      .set("Cookie", cookie)
      .send({ propertyId: "nope", value: 1 });
    expect(bad.status).toBe(400);

    const data = await readDatabase();
    const stored = data.rows.find((r) => r.id === row.id)!;
    expect(stored.values[author.id]).toBe("Frank Herbert");
    expect(stored.values[done.id]).toBe(true);
  });

  it("opens a row as a page with properties and supports blocks", async () => {
    const author = await addProp("Author", "text");
    const row = await addRow("Dune", { [author.id]: "Frank Herbert" });

    const asRow = (
      await request(app).get(`/api/space/rows/${row.id}`).set("Cookie", cookie)
    ).body as RowPage;
    expect(asRow.database_id).toBe(dbId);
    expect(asRow.properties[0].name).toBe("Author");
    expect(asRow.values[author.id]).toBe("Frank Herbert");

    await request(app)
      .post(`/api/space/pages/${row.id}/blocks`)
      .set("Cookie", cookie)
      .send({ type: "paragraph", content: { text: "Notes" } });
    const asPage = (
      await request(app).get(`/api/space/pages/${row.id}`).set("Cookie", cookie)
    ).body as Page;
    expect(asPage.blocks).toHaveLength(1);
    expect(
      (
        await request(app)
          .get("/api/space/rows/not-a-row")
          .set("Cookie", cookie)
      ).status,
    ).toBe(404);
  });

  it("deleting a row removes it and its values; deleting the database removes everything", async () => {
    const author = await addProp("Author", "text");
    const row = await addRow("Dune", { [author.id]: "H" });
    await request(app)
      .delete(`/api/space/pages/${row.id}`)
      .set("Cookie", cookie);
    const dataAfterRow = await readDatabase();
    expect(dataAfterRow.rows.find((r) => r.id === row.id)).toBeUndefined();

    await addRow("Emma");
    await request(app).delete(`/api/space/pages/${dbId}`).set("Cookie", cookie);
    expect(
      (
        await request(app)
          .get(`/api/space/databases/${dbId}`)
          .set("Cookie", cookie)
      ).status,
    ).toBe(404);
  });

  it("rows do not appear in the sidebar tree", async () => {
    await addRow("Hidden");
    const tree = (
      await request(app).get("/api/space/tree").set("Cookie", cookie)
    ).body as TreeNode[];
    const dbNode = tree.find((n) => n.id === dbId)!;
    expect(dbNode.children).toHaveLength(0);
  });

  it("stores per-view config with defaults and partial updates", async () => {
    const data = await readDatabase();
    expect(data.views.table).toEqual({
      filters: [],
      sort: null,
      groupBy: null,
    });

    const sel = await addProp("Status", "select");
    const updated = (
      await request(app)
        .patch(`/api/space/databases/${dbId}/views/board`)
        .set("Cookie", cookie)
        .send({ groupBy: sel.id })
    ).body as View;
    expect(updated.groupBy).toBe(sel.id);

    const sorted = (
      await request(app)
        .patch(`/api/space/databases/${dbId}/views/board`)
        .set("Cookie", cookie)
        .send({ sort: { propertyId: sel.id, direction: "desc" } })
    ).body as View;
    expect(sorted.groupBy).toBe(sel.id);
    expect(sorted.sort!.direction).toBe("desc");
    expect(
      (
        await request(app)
          .patch(`/api/space/databases/${dbId}/views/gallery`)
          .set("Cookie", cookie)
          .send({})
      ).status,
    ).toBe(400);
  });

  it("404s on a missing database", async () => {
    expect(
      (
        await request(app)
          .get("/api/space/databases/none")
          .set("Cookie", cookie)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .post("/api/space/databases/none/rows")
          .set("Cookie", cookie)
          .send({})
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .post("/api/space/databases/none/properties")
          .set("Cookie", cookie)
          .send({ type: "text" })
      ).status,
    ).toBe(404);
  });
});
