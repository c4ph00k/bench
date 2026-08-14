import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import { openDb } from "../../src/space/db.js";
import { openDb as openCrmDb } from "../../src/crm/db.js";
import { createApp } from "../../src/app.js";
import type Database from "better-sqlite3";
import type express from "express";

let db: Database.Database;
let app: express.Express;

beforeEach(async () => {
  db = openDb(":memory:");
  app = createApp({ crm: openCrmDb(":memory:"), space: db });
  const parent = (await request(app).post("/api/space/pages").send({ title: "Travel", icon: "✈️" })).body;
  await request(app).post("/api/space/pages").send({ title: "Japan Trip", parentId: parent.id });
  const dbPage = (await request(app).post("/api/space/pages").send({ title: "Reading List", type: "database" })).body;
  await request(app).post(`/api/space/databases/${dbPage.id}/rows`).send({ title: "Japanese Cooking" });
});

describe("search API", () => {
  it("matches page, database, and row titles case-insensitively", async () => {
    const res = await request(app).get("/api/space/search?q=japan");
    const titles = res.body.map((r: any) => r.title);
    expect(titles).toContain("Japan Trip");
    expect(titles).toContain("Japanese Cooking");
  });

  it("includes the result type and parent title for context", async () => {
    const res = await request(app).get("/api/space/search?q=japan");
    const row = res.body.find((r: any) => r.title === "Japanese Cooking");
    expect(row.type).toBe("row");
    expect(row.parent_title).toBe("Reading List");
    const page = res.body.find((r: any) => r.title === "Japan Trip");
    expect(page.parent_title).toBe("Travel");
  });

  it("finds databases by title", async () => {
    const res = await request(app).get("/api/space/search?q=reading");
    expect(res.body[0].type).toBe("database");
  });

  it("ranks prefix matches first", async () => {
    await request(app).post("/api/space/pages").send({ title: "About Japan" });
    const res = await request(app).get("/api/space/search?q=japan");
    expect(res.body[0].title).toBe("Japan Trip");
  });

  it("returns an empty list for a blank query and escapes LIKE wildcards", async () => {
    expect((await request(app).get("/api/space/search?q=")).body).toEqual([]);
    expect((await request(app).get("/api/space/search?q=%")).body).toEqual([]);
    expect((await request(app).get("/api/space/search?q=_")).body).toEqual([]);
  });
});
