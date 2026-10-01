import { beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
  createContact,
  createDeal,
  createActivity,
  getActivity,
  listActivities,
  updateActivity,
} from "../../src/crm/db.js";
import { setupCrm } from "./helpers.js";

let pool: Pool;
let tenantId: number;

beforeEach(async () => {
  ({ pool, tenantId } = await setupCrm());
});

describe("adding activities", () => {
  it("adds an activity to a contact and lists it on their timeline", async () => {
    const contact = await createContact(pool, tenantId, {
      name: "Jane",
      status: "lead",
    });
    await createActivity(pool, tenantId, {
      type: "call",
      contact_id: contact.id,
      description: "Discovery call",
    });
    const timeline = await listActivities(pool, tenantId, {
      contact_id: contact.id,
    });
    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({
      type: "call",
      description: "Discovery call",
    });
  });

  it("adds an activity to a deal and lists it on the deal timeline", async () => {
    const deal = await createDeal(pool, tenantId, {
      name: "Big deal",
      stage: "Proposal",
      value: 1000,
    });
    await createActivity(pool, tenantId, {
      type: "email",
      deal_id: deal.id,
      description: "Sent proposal",
    });
    expect(
      await listActivities(pool, tenantId, { deal_id: deal.id }),
    ).toHaveLength(1);
  });

  it("orders a timeline newest first", async () => {
    const contact = await createContact(pool, tenantId, {
      name: "Jane",
      status: "lead",
    });
    await createActivity(pool, tenantId, {
      type: "note",
      contact_id: contact.id,
      description: "First",
      occurred_at: "2026-06-01 09:00:00",
    });
    await createActivity(pool, tenantId, {
      type: "note",
      contact_id: contact.id,
      description: "Second",
      occurred_at: "2026-06-15 09:00:00",
    });
    await createActivity(pool, tenantId, {
      type: "note",
      contact_id: contact.id,
      description: "Third",
      occurred_at: "2026-06-30 09:00:00",
    });
    expect(
      (await listActivities(pool, tenantId, { contact_id: contact.id })).map(
        (a) => a.description,
      ),
    ).toEqual(["Third", "Second", "First"]);
  });

  it("stores an optional due date so an activity doubles as a task", async () => {
    const activity = await createActivity(pool, tenantId, {
      type: "note",
      description: "Follow up",
      due_date: "2026-07-10",
    });
    expect(await getActivity(pool, tenantId, activity.id)).toMatchObject({
      due_date: "2026-07-10",
      done: false,
    });
  });
});

describe("toggling task completion", () => {
  it("marks a task done and back to not-done", async () => {
    const activity = await createActivity(pool, tenantId, {
      type: "call",
      description: "Call back",
      due_date: "2026-07-10",
    });
    await updateActivity(pool, tenantId, activity.id, { done: true });
    expect((await getActivity(pool, tenantId, activity.id))!.done).toBe(true);
    await updateActivity(pool, tenantId, activity.id, { done: false });
    expect((await getActivity(pool, tenantId, activity.id))!.done).toBe(false);
  });

  it("keeps other fields intact when toggling", async () => {
    const activity = await createActivity(pool, tenantId, {
      type: "email",
      description: "Send recap",
      due_date: "2026-07-08",
    });
    await updateActivity(pool, tenantId, activity.id, { done: true });
    expect(await getActivity(pool, tenantId, activity.id)).toMatchObject({
      type: "email",
      description: "Send recap",
      due_date: "2026-07-08",
      done: true,
    });
  });
});
