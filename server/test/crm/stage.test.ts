import { beforeEach, describe, expect, it } from "vitest";
import {
  DB,
  DEAL_STAGES,
  DealStage,
  openDb,
  createDeal,
  getDeal,
  moveDeal,
  listDeals,
} from "../../src/crm/db.js";

let db: DB;

beforeEach(() => {
  db = openDb(":memory:");
});

describe("deal stage changes", () => {
  it("moves a deal through every pipeline stage", () => {
    const deal = createDeal(db, {
      name: "Journey deal",
      stage: "New",
      value: 10000,
    });
    for (const stage of DEAL_STAGES) {
      const updated = moveDeal(db, deal.id, stage);
      expect(updated!.stage).toBe(stage);
      expect(getDeal(db, deal.id)!.stage).toBe(stage);
    }
  });

  it("marks a deal Won and it shows in the Won column", () => {
    const deal = createDeal(db, {
      name: "Winner",
      stage: "Negotiation",
      value: 50000,
    });
    moveDeal(db, deal.id, "Won");
    expect(getDeal(db, deal.id)!.stage).toBe("Won");
    expect(listDeals(db, { stage: "Won" }).map((d) => d.name)).toContain(
      "Winner",
    );
  });

  it("marks a deal Lost and it leaves its old column", () => {
    const deal = createDeal(db, {
      name: "Loser",
      stage: "Proposal",
      value: 20000,
    });
    moveDeal(db, deal.id, "Lost");
    expect(getDeal(db, deal.id)!.stage).toBe("Lost");
    expect(listDeals(db, { stage: "Proposal" })).toHaveLength(0);
    expect(listDeals(db, { stage: "Lost" })).toHaveLength(1);
  });

  it("rejects an invalid stage", () => {
    const deal = createDeal(db, { name: "Deal", stage: "New", value: 1000 });
    expect(() =>
      moveDeal(db, deal.id, "Imaginary" as unknown as DealStage),
    ).toThrow();
    expect(getDeal(db, deal.id)!.stage).toBe("New");
  });
});
