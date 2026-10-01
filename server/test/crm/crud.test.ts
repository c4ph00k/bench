import { beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
  createOrganization,
  getOrganization,
  listOrganizations,
  updateOrganization,
  deleteOrganization,
  createContact,
  getContact,
  listContacts,
  updateContact,
  deleteContact,
  createDeal,
  getDeal,
  listDeals,
  updateDeal,
  deleteDeal,
  createActivity,
  getActivity,
  listActivities,
  updateActivity,
  deleteActivity,
} from "../../src/crm/db.js";
import { setupCrm } from "./helpers.js";

let pool: Pool;
let tenantId: number;

beforeEach(async () => {
  ({ pool, tenantId } = await setupCrm());
});

describe("organizations CRUD", () => {
  it("creates and reads an organization", async () => {
    const org = await createOrganization(pool, tenantId, {
      name: "Acme Corp",
      website: "acme.com",
      industry: "Manufacturing",
    });
    expect(org.id).toBeGreaterThan(0);
    expect(await getOrganization(pool, tenantId, org.id)).toMatchObject({
      name: "Acme Corp",
      website: "acme.com",
    });
  });

  it("lists organizations", async () => {
    await createOrganization(pool, tenantId, { name: "Beta" });
    await createOrganization(pool, tenantId, { name: "Alpha" });
    expect(
      (await listOrganizations(pool, tenantId)).map((o) => o.name),
    ).toEqual(["Alpha", "Beta"]);
  });

  it("updates an organization", async () => {
    const org = await createOrganization(pool, tenantId, { name: "Acme Corp" });
    await updateOrganization(pool, tenantId, org.id, {
      name: "Acme Inc",
      industry: "Retail",
    });
    expect(await getOrganization(pool, tenantId, org.id)).toMatchObject({
      name: "Acme Inc",
      industry: "Retail",
    });
  });

  it("deletes an organization", async () => {
    const org = await createOrganization(pool, tenantId, { name: "Acme Corp" });
    await deleteOrganization(pool, tenantId, org.id);
    expect(await getOrganization(pool, tenantId, org.id)).toBeUndefined();
  });
});

describe("contacts CRUD", () => {
  it("creates and reads a contact", async () => {
    const org = await createOrganization(pool, tenantId, { name: "Acme Corp" });
    const contact = await createContact(pool, tenantId, {
      name: "Jane Doe",
      email: "jane@example.com",
      status: "lead",
      organization_id: org.id,
    });
    expect(await getContact(pool, tenantId, contact.id)).toMatchObject({
      name: "Jane Doe",
      email: "jane@example.com",
      status: "lead",
      organization_id: org.id,
    });
  });

  it("updates a contact", async () => {
    const contact = await createContact(pool, tenantId, {
      name: "Jane Doe",
      status: "lead",
    });
    await updateContact(pool, tenantId, contact.id, {
      name: "Jane Doe",
      status: "customer",
      phone: "555-0100",
    });
    expect(await getContact(pool, tenantId, contact.id)).toMatchObject({
      status: "customer",
      phone: "555-0100",
    });
  });

  it("deletes a contact", async () => {
    const contact = await createContact(pool, tenantId, {
      name: "Jane Doe",
      status: "lead",
    });
    await deleteContact(pool, tenantId, contact.id);
    expect(await getContact(pool, tenantId, contact.id)).toBeUndefined();
  });

  it("lists contacts filtered by status", async () => {
    await createContact(pool, tenantId, { name: "A", status: "lead" });
    await createContact(pool, tenantId, { name: "B", status: "customer" });
    expect(
      (await listContacts(pool, tenantId, { status: "customer" })).map(
        (c) => c.name,
      ),
    ).toEqual(["B"]);
  });
});

describe("deals CRUD", () => {
  it("creates and reads a deal", async () => {
    const org = await createOrganization(pool, tenantId, { name: "Acme Corp" });
    const deal = await createDeal(pool, tenantId, {
      name: "Big deal",
      stage: "New",
      value: 50000,
      organization_id: org.id,
    });
    expect(await getDeal(pool, tenantId, deal.id)).toMatchObject({
      name: "Big deal",
      stage: "New",
      value: 50000,
    });
  });

  it("updates a deal", async () => {
    const deal = await createDeal(pool, tenantId, {
      name: "Big deal",
      stage: "New",
      value: 50000,
    });
    await updateDeal(pool, tenantId, deal.id, {
      name: "Bigger deal",
      stage: "Proposal",
      value: 75000,
      close_date: "2026-09-01",
    });
    expect(await getDeal(pool, tenantId, deal.id)).toMatchObject({
      name: "Bigger deal",
      stage: "Proposal",
      value: 75000,
    });
  });

  it("deletes a deal", async () => {
    const deal = await createDeal(pool, tenantId, {
      name: "Big deal",
      stage: "New",
      value: 50000,
    });
    await deleteDeal(pool, tenantId, deal.id);
    expect(await getDeal(pool, tenantId, deal.id)).toBeUndefined();
  });

  it("lists deals by stage", async () => {
    await createDeal(pool, tenantId, { name: "A", stage: "New", value: 1 });
    await createDeal(pool, tenantId, { name: "B", stage: "Won", value: 2 });
    expect(
      (await listDeals(pool, tenantId, { stage: "Won" })).map((d) => d.name),
    ).toEqual(["B"]);
  });
});

describe("activities CRUD", () => {
  it("creates and reads an activity", async () => {
    const contact = await createContact(pool, tenantId, {
      name: "Jane Doe",
      status: "lead",
    });
    const activity = await createActivity(pool, tenantId, {
      type: "call",
      contact_id: contact.id,
      description: "Intro call",
    });
    expect(await getActivity(pool, tenantId, activity.id)).toMatchObject({
      type: "call",
      contact_id: contact.id,
      description: "Intro call",
      done: false,
    });
    expect(activity.occurred_at).toBeTruthy();
  });

  it("updates an activity", async () => {
    const activity = await createActivity(pool, tenantId, {
      type: "note",
      description: "Draft",
    });
    await updateActivity(pool, tenantId, activity.id, {
      description: "Final",
      due_date: "2026-08-01",
    });
    expect(await getActivity(pool, tenantId, activity.id)).toMatchObject({
      description: "Final",
      due_date: "2026-08-01",
    });
  });

  it("deletes an activity", async () => {
    const activity = await createActivity(pool, tenantId, {
      type: "note",
      description: "Temp",
    });
    await deleteActivity(pool, tenantId, activity.id);
    expect(await getActivity(pool, tenantId, activity.id)).toBeUndefined();
  });

  it("lists activities newest first", async () => {
    await createActivity(pool, tenantId, {
      type: "note",
      description: "Old",
      occurred_at: "2026-01-01 10:00:00",
    });
    await createActivity(pool, tenantId, {
      type: "note",
      description: "New",
      occurred_at: "2026-06-01 10:00:00",
    });
    expect(
      (await listActivities(pool, tenantId)).map((a) => a.description),
    ).toEqual(["New", "Old"]);
  });
});
