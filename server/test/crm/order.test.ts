import { beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createDeal, getDeal, listDeals, moveDeal } from "../../src/crm/db.js";
import { setupCrm } from "./helpers.js";

let pool: Pool;
let tenantId: number;

/** Ids of one column, in the order the board would draw them. */
async function column(stage: "New" | "Qualified") {
  const deals = await listDeals(pool, tenantId, { stage });
  return deals
    .toSorted((a, b) => a.board_order - b.board_order || a.id - b.id)
    .map((d) => d.name);
}

beforeEach(async () => {
  ({ pool, tenantId } = await setupCrm());
  for (const name of ["First", "Second", "Third"])
    await createDeal(pool, tenantId, { name, stage: "New", value: 1000 });
});

describe("deal order on the board", () => {
  it("gives each new deal the end of its column", async () => {
    expect(await column("New")).toEqual(["First", "Second", "Third"]);
  });

  it("keeps a deal where it is dropped within its column", async () => {
    const third = (await listDeals(pool, tenantId, { stage: "New" })).find(
      (d) => d.name === "Third",
    )!;
    await moveDeal(pool, tenantId, third.id, "New", 0);
    expect(await column("New")).toEqual(["Third", "First", "Second"]);
  });

  it("reordering inside a column leaves the probability alone", async () => {
    const deal = await createDeal(pool, tenantId, {
      name: "Hand-set",
      stage: "New",
      value: 5000,
      probability: 42,
    });
    await moveDeal(pool, tenantId, deal.id, "New", 0);
    expect((await getDeal(pool, tenantId, deal.id))!.probability).toBe(42);
  });

  it("dropping into another column re-bases the probability and takes the slot", async () => {
    await createDeal(pool, tenantId, {
      name: "Already there",
      stage: "Qualified",
      value: 2000,
    });
    const first = (await listDeals(pool, tenantId, { stage: "New" }))[0];
    const moved = (await moveDeal(pool, tenantId, first.id, "Qualified", 0))!;
    expect(moved.probability).toBe(25);
    expect(await column("Qualified")).toEqual(["First", "Already there"]);
    expect(await column("New")).toEqual(["Second", "Third"]);
  });

  it("appends when no index is given", async () => {
    const first = (await listDeals(pool, tenantId, { stage: "New" }))[0];
    await moveDeal(pool, tenantId, first.id, "Qualified");
    await createDeal(pool, tenantId, {
      name: "Later",
      stage: "Qualified",
      value: 100,
    });
    expect(await column("Qualified")).toEqual(["First", "Later"]);
  });
});
