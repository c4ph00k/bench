import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import { openDb } from "../../src/space/db.js";
import { openDb as openCrmDb } from "../../src/crm/db.js";
import { createApp } from "../../src/app.js";
import type Database from "better-sqlite3";
import type express from "express";

let db: Database.Database;
let app: express.Express;
let pageId: string;

beforeEach(async () => {
  db = openDb(":memory:");
  app = createApp({ crm: openCrmDb(":memory:"), space: db });
  pageId = (await request(app).post("/api/space/pages").send({ title: "Doc" }))
    .body.id;
});

const addBlock = async (type: string, text: string, index?: number) =>
  (
    await request(app)
      .post(`/api/space/pages/${pageId}/blocks`)
      .send({ type, content: { text }, index })
  ).body;

const blockTitles = async () => {
  const page = (await request(app).get(`/api/space/pages/${pageId}`)).body;
  return page.blocks.map((b: any) => b.content.text);
};

describe("blocks API", () => {
  it("creates blocks appended and at an index, keeping order", async () => {
    await addBlock("paragraph", "one");
    await addBlock("paragraph", "three");
    const created = await addBlock("heading1", "two", 1);
    expect(created.type).toBe("heading1");
    expect(await blockTitles()).toEqual(["one", "two", "three"]);
  });

  it("accepts a client-provided id", async () => {
    const res = await request(app)
      .post(`/api/space/pages/${pageId}/blocks`)
      .send({
        id: "client-id-1",
        type: "todo",
        content: { text: "task", checked: false },
      });
    expect(res.body.id).toBe("client-id-1");
  });

  it("rejects unknown block types and missing pages", async () => {
    const bad = await request(app)
      .post(`/api/space/pages/${pageId}/blocks`)
      .send({ type: "gif" });
    expect(bad.status).toBe(400);
    const missing = await request(app)
      .post("/api/space/pages/nope/blocks")
      .send({ type: "paragraph" });
    expect(missing.status).toBe(404);
  });

  it("edits content and converts type", async () => {
    const b = await addBlock("paragraph", "hello");
    const patched = await request(app)
      .patch(`/api/space/blocks/${b.id}`)
      .send({ type: "quote", content: { text: "hello!" } });
    expect(patched.body.type).toBe("quote");
    expect(patched.body.content.text).toBe("hello!");
    expect(
      (
        await request(app)
          .patch(`/api/space/blocks/${b.id}`)
          .send({ type: "gif" })
      ).status,
    ).toBe(400);
    expect(
      (await request(app).patch("/api/space/blocks/none").send({})).status,
    ).toBe(404);
  });

  it("deletes a block and compacts positions", async () => {
    const a = await addBlock("paragraph", "a");
    await addBlock("paragraph", "b");
    await addBlock("paragraph", "c");
    await request(app).delete(`/api/space/blocks/${a.id}`);
    expect(await blockTitles()).toEqual(["b", "c"]);
    const page = (await request(app).get(`/api/space/pages/${pageId}`)).body;
    expect(page.blocks.map((b: any) => b.position)).toEqual([0, 1]);
    expect((await request(app).delete("/api/space/blocks/none")).status).toBe(
      404,
    );
  });

  it("reorders blocks with a full permutation", async () => {
    const a = await addBlock("paragraph", "a");
    const b = await addBlock("paragraph", "b");
    const c = await addBlock("paragraph", "c");
    const res = await request(app)
      .put(`/api/space/pages/${pageId}/blocks/order`)
      .send({ ids: [c.id, a.id, b.id] });
    expect(res.body.ok).toBe(true);
    expect(await blockTitles()).toEqual(["c", "a", "b"]);
  });

  it("rejects partial or foreign id lists on reorder", async () => {
    const a = await addBlock("paragraph", "a");
    await addBlock("paragraph", "b");
    const partial = await request(app)
      .put(`/api/space/pages/${pageId}/blocks/order`)
      .send({ ids: [a.id] });
    expect(partial.status).toBe(400);
    const foreign = await request(app)
      .put(`/api/space/pages/${pageId}/blocks/order`)
      .send({ ids: [a.id, "not-a-block"] });
    expect(foreign.status).toBe(400);
  });

  it("removes blocks when their page is deleted", async () => {
    const b = await addBlock("paragraph", "orphan-to-be");
    await request(app).delete(`/api/space/pages/${pageId}`);
    const row = db.prepare("SELECT * FROM blocks WHERE id = ?").get(b.id);
    expect(row).toBeUndefined();
  });
});
