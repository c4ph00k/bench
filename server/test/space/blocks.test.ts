import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import type express from "express";
import { appWithSpace, sessionCookie } from "./app.js";
import type { Block, Ok, Page } from "./responses.js";

let app: express.Express;
let cookie: string;
let pageId: string;

beforeEach(async () => {
  app = await appWithSpace();
  cookie = await sessionCookie(app);
  pageId = (
    (
      await request(app)
        .post("/api/space/pages")
        .set("Cookie", cookie)
        .send({ title: "Doc" })
    ).body as Page
  ).id;
});

const addBlock = async (type: string, text: string, index?: number) =>
  (
    await request(app)
      .post(`/api/space/pages/${pageId}/blocks`)
      .set("Cookie", cookie)
      .send({ type, content: { text }, index })
  ).body as Block;

const readPage = async () =>
  (await request(app).get(`/api/space/pages/${pageId}`).set("Cookie", cookie))
    .body as Page;

const blockTitles = async () => {
  const page = await readPage();
  return page.blocks.map((b) => b.content.text);
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
      .set("Cookie", cookie)
      .send({
        id: "client-id-1",
        type: "todo",
        content: { text: "task", checked: false },
      });
    expect((res.body as Block).id).toBe("client-id-1");
  });

  it("rejects unknown block types and missing pages", async () => {
    const bad = await request(app)
      .post(`/api/space/pages/${pageId}/blocks`)
      .set("Cookie", cookie)
      .send({ type: "gif" });
    expect(bad.status).toBe(400);
    const missing = await request(app)
      .post("/api/space/pages/nope/blocks")
      .set("Cookie", cookie)
      .send({ type: "paragraph" });
    expect(missing.status).toBe(404);
  });

  it("edits content and converts type", async () => {
    const b = await addBlock("paragraph", "hello");
    const patched = await request(app)
      .patch(`/api/space/blocks/${b.id}`)
      .set("Cookie", cookie)
      .send({ type: "quote", content: { text: "hello!" } });
    expect((patched.body as Block).type).toBe("quote");
    expect((patched.body as Block).content.text).toBe("hello!");
    expect(
      (
        await request(app)
          .patch(`/api/space/blocks/${b.id}`)
          .set("Cookie", cookie)
          .send({ type: "gif" })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .patch("/api/space/blocks/none")
          .set("Cookie", cookie)
          .send({})
      ).status,
    ).toBe(404);
  });

  it("deletes a block and compacts positions", async () => {
    const a = await addBlock("paragraph", "a");
    await addBlock("paragraph", "b");
    await addBlock("paragraph", "c");
    await request(app)
      .delete(`/api/space/blocks/${a.id}`)
      .set("Cookie", cookie);
    expect(await blockTitles()).toEqual(["b", "c"]);
    const page = await readPage();
    expect(page.blocks.map((b) => b.position)).toEqual([0, 1]);
    expect(
      (
        await request(app)
          .delete("/api/space/blocks/none")
          .set("Cookie", cookie)
      ).status,
    ).toBe(404);
  });

  it("reorders blocks with a full permutation", async () => {
    const a = await addBlock("paragraph", "a");
    const b = await addBlock("paragraph", "b");
    const c = await addBlock("paragraph", "c");
    const res = await request(app)
      .put(`/api/space/pages/${pageId}/blocks/order`)
      .set("Cookie", cookie)
      .send({ ids: [c.id, a.id, b.id] });
    expect((res.body as Ok).ok).toBe(true);
    expect(await blockTitles()).toEqual(["c", "a", "b"]);
  });

  it("rejects partial or foreign id lists on reorder", async () => {
    const a = await addBlock("paragraph", "a");
    await addBlock("paragraph", "b");
    const partial = await request(app)
      .put(`/api/space/pages/${pageId}/blocks/order`)
      .set("Cookie", cookie)
      .send({ ids: [a.id] });
    expect(partial.status).toBe(400);
    const foreign = await request(app)
      .put(`/api/space/pages/${pageId}/blocks/order`)
      .set("Cookie", cookie)
      .send({ ids: [a.id, "not-a-block"] });
    expect(foreign.status).toBe(400);
  });

  it("removes blocks when their page is deleted", async () => {
    const b = await addBlock("paragraph", "orphan-to-be");
    await request(app)
      .delete(`/api/space/pages/${pageId}`)
      .set("Cookie", cookie);
    expect(
      (
        await request(app)
          .get(`/api/space/blocks/${b.id}`)
          .set("Cookie", cookie)
      ).status,
    ).toBe(404);
  });
});
