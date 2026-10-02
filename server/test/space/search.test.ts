import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import type express from "express";
import { appWithSpace, sessionCookie } from "./app.js";
import type { Page, SearchHit } from "./responses.js";

let app: express.Express;
let cookie: string;

const search = async (q: string) =>
  (await request(app).get(`/api/space/search?q=${q}`).set("Cookie", cookie))
    .body as SearchHit[];

beforeEach(async () => {
  app = await appWithSpace();
  cookie = await sessionCookie(app);
  const parent = (
    (
      await request(app)
        .post("/api/space/pages")
        .set("Cookie", cookie)
        .send({ title: "Travel", icon: "✈️" })
    ).body as Page
  ).id;
  await request(app)
    .post("/api/space/pages")
    .set("Cookie", cookie)
    .send({ title: "Japan Trip", parentId: parent });
  const dbPage = (
    (
      await request(app)
        .post("/api/space/pages")
        .set("Cookie", cookie)
        .send({ title: "Reading List", type: "database" })
    ).body as Page
  ).id;
  await request(app)
    .post(`/api/space/databases/${dbPage}/rows`)
    .set("Cookie", cookie)
    .send({ title: "Japanese Cooking" });
});

describe("search API", () => {
  it("matches page, database, and row titles case-insensitively", async () => {
    const titles = (await search("japan")).map((r) => r.title);
    expect(titles).toContain("Japan Trip");
    expect(titles).toContain("Japanese Cooking");
  });

  it("includes the result type and parent title for context", async () => {
    const hits = await search("japan");
    const row = hits.find((r) => r.title === "Japanese Cooking")!;
    expect(row.type).toBe("row");
    expect(row.parent_title).toBe("Reading List");
    const page = hits.find((r) => r.title === "Japan Trip")!;
    expect(page.parent_title).toBe("Travel");
  });

  it("finds databases by title", async () => {
    expect((await search("reading"))[0].type).toBe("database");
  });

  it("ranks prefix matches first", async () => {
    await request(app)
      .post("/api/space/pages")
      .set("Cookie", cookie)
      .send({ title: "About Japan" });
    expect((await search("japan"))[0].title).toBe("Japan Trip");
  });

  it("returns an empty list for a blank query and escapes LIKE wildcards", async () => {
    expect(await search("")).toEqual([]);
    expect(await search("%")).toEqual([]);
    expect(await search("_")).toEqual([]);
  });
});
