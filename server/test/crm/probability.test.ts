import { beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DB,
  STAGE_PROBABILITY,
  expectedValue,
  openDb,
  createDeal,
  getDeal,
  updateDeal,
  updateDealStage,
} from "../../src/crm/db.js";

let db: DB;

beforeEach(() => {
  db = openDb(":memory:");
});

const deal = (
  stage: "New" | "Qualified" | "Won" | "Lost" = "New",
  value = 10_000,
) => createDeal(db, { name: "Test deal", stage, value });

describe("deal probability", () => {
  it("defaults to the probability of the stage it is created in", () => {
    expect(deal("New").probability).toBe(STAGE_PROBABILITY.New);
    expect(deal("Qualified").probability).toBe(STAGE_PROBABILITY.Qualified);
    expect(deal("Won").probability).toBe(100);
    expect(deal("Lost").probability).toBe(0);
  });

  it("accepts an explicit override", () => {
    const d = createDeal(db, {
      name: "Override",
      stage: "New",
      value: 1000,
      probability: 65,
    });
    expect(d.probability).toBe(65);
  });

  it("re-bases on the new stage when a deal moves along the pipeline", () => {
    const d = deal("New");
    expect(d.probability).toBe(10);

    const moved = updateDealStage(db, d.id, "Negotiation");
    expect(moved.stage).toBe("Negotiation");
    expect(moved.probability).toBe(STAGE_PROBABILITY.Negotiation);

    expect(updateDealStage(db, d.id, "Won").probability).toBe(100);
    expect(updateDealStage(db, d.id, "Lost").probability).toBe(0);
  });

  it("keeps the stage default when an edit does not mention probability", () => {
    const d = deal("New");
    const updated = updateDeal(db, d.id, {
      name: "Renamed",
      stage: "Proposal",
      value: 5000,
    });
    expect(updated.probability).toBe(STAGE_PROBABILITY.Proposal);
  });

  it("survives a round trip through the database", () => {
    const d = createDeal(db, {
      name: "Round trip",
      stage: "Proposal",
      value: 2000,
      probability: 40,
    });
    expect(getDeal(db, d.id).probability).toBe(40);
  });

  it("weights value by probability", () => {
    expect(expectedValue({ value: 10_000, probability: 25 })).toBe(2_500);
    expect(expectedValue({ value: 10_000, probability: 0 })).toBe(0);
    expect(expectedValue({ value: 10_000, probability: 100 })).toBe(10_000);
  });
});

describe("migrating a database that predates probability", () => {
  it("adds the column and backfills from each deal stage when reopened", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "crm-migrate-"));
    const file = path.join(dir, "legacy.sqlite");

    // A database as it looked before deals carried a probability.
    const legacy = new Database(file);
    legacy.exec(`CREATE TABLE deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      organization_id INTEGER,
      contact_id INTEGER,
      stage TEXT NOT NULL,
      value REAL NOT NULL DEFAULT 0,
      close_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    legacy
      .prepare(
        "INSERT INTO deals (name, stage, value) VALUES ('Old', 'Negotiation', 1000)",
      )
      .run();
    legacy.close();

    // Opening it the normal way must migrate it in place, without losing the row.
    const migrated = openDb(file);
    const row = migrated
      .prepare("SELECT * FROM deals WHERE name = 'Old'")
      .get() as {
      probability: number;
      value: number;
    };
    expect(row.probability).toBe(STAGE_PROBABILITY.Negotiation);
    expect(row.value).toBe(1000);
    migrated.close();

    rmSync(dir, { recursive: true, force: true });
  });
});
