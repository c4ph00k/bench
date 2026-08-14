import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DB,
  createDeal,
  getDeal,
  listDeals,
  moveDeal,
  openDb,
} from "../../src/crm/db.js";

let db: DB;

/** Ids of one column, in the order the board would draw them. */
function column(stage: "New" | "Qualified") {
  return listDeals(db, { stage })
    .sort((a, b) => a.board_order - b.board_order || a.id - b.id)
    .map((d) => d.name);
}

beforeEach(() => {
  db = openDb(":memory:");
  for (const name of ["First", "Second", "Third"])
    createDeal(db, { name, stage: "New", value: 1000 });
});

describe("deal order on the board", () => {
  it("gives each new deal the end of its column", () => {
    expect(column("New")).toEqual(["First", "Second", "Third"]);
  });

  it("keeps a deal where it is dropped within its column", () => {
    const third = listDeals(db, { stage: "New" }).find(
      (d) => d.name === "Third",
    )!;
    moveDeal(db, third.id, "New", 0);
    expect(column("New")).toEqual(["Third", "First", "Second"]);
  });

  it("reordering inside a column leaves the probability alone", () => {
    const deal = createDeal(db, {
      name: "Hand-set",
      stage: "New",
      value: 5000,
      probability: 42,
    });
    moveDeal(db, deal.id, "New", 0);
    expect(getDeal(db, deal.id)!.probability).toBe(42);
  });

  it("dropping into another column re-bases the probability and takes the slot", () => {
    createDeal(db, { name: "Already there", stage: "Qualified", value: 2000 });
    const first = listDeals(db, { stage: "New" })[0];
    const moved = moveDeal(db, first.id, "Qualified", 0)!;
    expect(moved.probability).toBe(25);
    expect(column("Qualified")).toEqual(["First", "Already there"]);
    expect(column("New")).toEqual(["Second", "Third"]);
  });

  it("appends when no index is given", () => {
    const first = listDeals(db, { stage: "New" })[0];
    moveDeal(db, first.id, "Qualified");
    createDeal(db, { name: "Later", stage: "Qualified", value: 100 });
    expect(column("Qualified")).toEqual(["First", "Later"]);
  });

  it("backfills the column order for a database that predates it", () => {
    // On disk rather than in memory: the migration only runs on the second open.
    const file = join(mkdtempSync(join(tmpdir(), "crm-order-")), "old.sqlite");
    const before = openDb(file);
    before.exec("ALTER TABLE deals DROP COLUMN board_order");
    for (const name of ["A", "B", "C"])
      before
        .prepare(
          "INSERT INTO deals (name, stage, value, probability) VALUES (?, 'New', 1000, 10)",
        )
        .run(name);
    before.close();

    const after = openDb(file);
    const order = listDeals(after, { stage: "New" })
      .sort((a, b) => a.board_order - b.board_order)
      .map((d) => d.name);
    after.close();
    expect(order).toEqual(["A", "B", "C"]);
  });
});
