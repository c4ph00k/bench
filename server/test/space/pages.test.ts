import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import type express from "express";
import { appWithSpace, sessionCookie } from "./app.js";
import { buildTree, type PageRow } from "../../src/space/routes/pages.js";
import type { Ok, Page, TreeNode } from "./responses.js";

let app: express.Express;
let cookie: string;

beforeEach(async () => {
  app = await appWithSpace();
  cookie = await sessionCookie(app);
});

const createPage = async (payload: Record<string, unknown>) =>
  (
    await request(app)
      .post("/api/space/pages")
      .set("Cookie", cookie)
      .send(payload)
  ).body as Page;

const readTree = async () =>
  (await request(app).get("/api/space/tree").set("Cookie", cookie))
    .body as TreeNode[];

describe("pages API", () => {
  it("creates a page and returns it in the tree", async () => {
    const created = await request(app)
      .post("/api/space/pages")
      .set("Cookie", cookie)
      .send({ title: "Alpha", icon: "🅰️" });
    expect(created.status).toBe(201);
    expect((created.body as Page).title).toBe("Alpha");

    const tree = await readTree();
    const alpha = tree.find((n) => n.title === "Alpha")!;
    expect(alpha.icon).toBe("🅰️");
  });

  it("nests pages under a parent and orders siblings by position", async () => {
    const parent = await createPage({ title: "Parent" });
    await createPage({ title: "First", parentId: parent.id });
    await createPage({ title: "Second", parentId: parent.id });

    const tree = await readTree();
    const parentNode = tree.find((n) => n.title === "Parent")!;
    expect(parentNode.children.map((c) => c.title)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("rejects an unknown parent and a bad type", async () => {
    const bad = await request(app)
      .post("/api/space/pages")
      .set("Cookie", cookie)
      .send({ title: "X", parentId: "nope" });
    expect(bad.status).toBe(400);
    const badType = await request(app)
      .post("/api/space/pages")
      .set("Cookie", cookie)
      .send({ title: "X", type: "row" });
    expect(badType.status).toBe(400);
  });

  it("reads a single page with its blocks array", async () => {
    const page = await createPage({ title: "Solo" });
    const res = await request(app)
      .get(`/api/space/pages/${page.id}`)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect((res.body as Page).title).toBe("Solo");
    expect((res.body as Page).blocks).toEqual([]);
    expect(
      (await request(app).get("/api/space/pages/missing").set("Cookie", cookie))
        .status,
    ).toBe(404);
  });

  it("renames a page and updates its icon", async () => {
    const page = await createPage({ title: "Old" });
    const renamed = await request(app)
      .patch(`/api/space/pages/${page.id}`)
      .set("Cookie", cookie)
      .send({ title: "New", icon: "🚀" });
    expect((renamed.body as Page).title).toBe("New");
    expect((renamed.body as Page).icon).toBe("🚀");
    const cleared = await request(app)
      .patch(`/api/space/pages/${page.id}`)
      .set("Cookie", cookie)
      .send({ icon: null });
    expect((cleared.body as Page).icon).toBeNull();
    expect(
      (
        await request(app)
          .patch("/api/space/pages/missing")
          .set("Cookie", cookie)
          .send({ title: "x" })
      ).status,
    ).toBe(404);
  });

  it("deletes a page and cascades to all descendants", async () => {
    const a = await createPage({ title: "A" });
    const b = await createPage({ title: "B", parentId: a.id });
    const c = await createPage({ title: "C", parentId: b.id });

    const del = await request(app)
      .delete(`/api/space/pages/${a.id}`)
      .set("Cookie", cookie);
    expect((del.body as Ok).ok).toBe(true);
    for (const id of [a.id, b.id, c.id]) {
      expect(
        (await request(app).get(`/api/space/pages/${id}`).set("Cookie", cookie))
          .status,
      ).toBe(404);
    }
    expect(
      (
        await request(app)
          .delete("/api/space/pages/missing")
          .set("Cookie", cookie)
      ).status,
    ).toBe(404);
  });
});

describe("buildTree", () => {
  it("attaches children to parents and returns roots", () => {
    const rows: PageRow[] = [
      {
        id: "1",
        parent_id: null,
        type: "page",
        title: "Root",
        icon: null,
        position: 0,
      },
      {
        id: "2",
        parent_id: "1",
        type: "page",
        title: "Child",
        icon: null,
        position: 0,
      },
      {
        id: "3",
        parent_id: "missing",
        type: "page",
        title: "Orphan",
        icon: null,
        position: 1,
      },
    ];
    const tree = buildTree(rows);
    expect(tree.map((n) => n.title)).toEqual(["Root", "Orphan"]);
    expect(tree[0].children[0].title).toBe("Child");
  });
});
