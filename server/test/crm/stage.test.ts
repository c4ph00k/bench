import { beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
  DEAL_STAGES,
  createDeal,
  getDeal,
  moveDeal,
  listDeals,
} from "../../src/crm/db.js";
import { setupCrm } from "./helpers.js";

let pool: Pool;
let tenantId: number;

beforeEach(async () => {
  ({ pool, tenantId } = await setupCrm());
});

describe("deal stage changes", () => {
  it("moves a deal through every pipeline stage", async () => {
    const deal = await createDeal(pool, tenantId, {
      name: "Journey deal",
      stage: "New",
      value: 10000,
    });
    for (const stage of DEAL_STAGES) {
      const updated = await moveDeal(pool, tenantId, deal.id, stage);
      expect(updated!.stage).toBe(stage);
      expect((await getDeal(pool, tenantId, deal.id))!.stage).toBe(stage);
    }
  });

  it("marks a deal Won and it shows in the Won column", async () => {
    const deal = await createDeal(pool, tenantId, {
      name: "Winner",
      stage: "Negotiation",
      value: 50000,
    });
    await moveDeal(pool, tenantId, deal.id, "Won");
    expect((await getDeal(pool, tenantId, deal.id))!.stage).toBe("Won");
    expect(
      (await listDeals(pool, tenantId, { stage: "Won" })).map((d) => d.name),
    ).toContain("Winner");
  });

  it("marks a deal Lost and it leaves its old column", async () => {
    const deal = await createDeal(pool, tenantId, {
      name: "Loser",
      stage: "Proposal",
      value: 20000,
    });
    await moveDeal(pool, tenantId, deal.id, "Lost");
    expect((await getDeal(pool, tenantId, deal.id))!.stage).toBe("Lost");
    expect(await listDeals(pool, tenantId, { stage: "Proposal" })).toHaveLength(
      0,
    );
    expect(await listDeals(pool, tenantId, { stage: "Lost" })).toHaveLength(1);
  });

  it("rejects an invalid stage", async () => {
    const deal = await createDeal(pool, tenantId, {
      name: "Deal",
      stage: "New",
      value: 1000,
    });
    await expect(
      moveDeal(pool, tenantId, deal.id, "Imaginary" as never),
    ).rejects.toThrow();
    expect((await getDeal(pool, tenantId, deal.id))!.stage).toBe("New");
  });
});
