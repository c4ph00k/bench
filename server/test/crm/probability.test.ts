import { beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
  STAGE_PROBABILITY,
  expectedValue,
  createDeal,
  getDeal,
  updateDeal,
  moveDeal,
} from "../../src/crm/db.js";
import { setupCrm } from "./helpers.js";

let pool: Pool;
let tenantId: number;

beforeEach(async () => {
  ({ pool, tenantId } = await setupCrm());
});

const deal = (
  stage: "New" | "Qualified" | "Won" | "Lost" = "New",
  value = 10_000,
) => createDeal(pool, tenantId, { name: "Test deal", stage, value });

describe("deal probability", () => {
  it("defaults to the probability of the stage it is created in", async () => {
    expect((await deal("New")).probability).toBe(STAGE_PROBABILITY.New);
    expect((await deal("Qualified")).probability).toBe(
      STAGE_PROBABILITY.Qualified,
    );
    expect((await deal("Won")).probability).toBe(100);
    expect((await deal("Lost")).probability).toBe(0);
  });

  it("accepts an explicit override", async () => {
    const d = await createDeal(pool, tenantId, {
      name: "Override",
      stage: "New",
      value: 1000,
      probability: 65,
    });
    expect(d.probability).toBe(65);
  });

  it("re-bases on the new stage when a deal moves along the pipeline", async () => {
    const d = await deal("New");
    expect(d.probability).toBe(10);

    const moved = await moveDeal(pool, tenantId, d.id, "Negotiation");
    expect(moved!.stage).toBe("Negotiation");
    expect(moved!.probability).toBe(STAGE_PROBABILITY.Negotiation);

    expect((await moveDeal(pool, tenantId, d.id, "Won"))!.probability).toBe(
      100,
    );
    expect((await moveDeal(pool, tenantId, d.id, "Lost"))!.probability).toBe(0);
  });

  it("keeps the stage default when an edit does not mention probability", async () => {
    const d = await deal("New");
    const updated = await updateDeal(pool, tenantId, d.id, {
      name: "Renamed",
      stage: "Proposal",
      value: 5000,
    });
    expect(updated!.probability).toBe(STAGE_PROBABILITY.Proposal);
  });

  it("survives a round trip through the database", async () => {
    const d = await createDeal(pool, tenantId, {
      name: "Round trip",
      stage: "Proposal",
      value: 2000,
      probability: 40,
    });
    expect((await getDeal(pool, tenantId, d.id))!.probability).toBe(40);
  });

  it("weights value by probability", () => {
    expect(expectedValue({ value: 10_000, probability: 25 })).toBe(2_500);
    expect(expectedValue({ value: 10_000, probability: 0 })).toBe(0);
    expect(expectedValue({ value: 10_000, probability: 100 })).toBe(10_000);
  });
});
