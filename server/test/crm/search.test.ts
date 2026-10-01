import { beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
  createOrganization,
  createContact,
  listOrganizations,
  listContacts,
  createDeal,
  listDeals,
} from "../../src/crm/db.js";
import { setupCrm } from "./helpers.js";

let pool: Pool;
let tenantId: number;
let bluepeakId: number;
let jonasId: number;

beforeEach(async () => {
  ({ pool, tenantId } = await setupCrm());
  await createOrganization(pool, tenantId, {
    name: "Northwind Logistics",
    industry: "Transportation",
  });
  const bluepeak = await createOrganization(pool, tenantId, {
    name: "Bluepeak Software",
    website: "bluepeak.io",
    industry: "Software",
  });
  bluepeakId = bluepeak.id;
  await createContact(pool, tenantId, {
    name: "Maria Delgado",
    email: "maria@example.com",
    status: "customer",
  });
  const jonas = await createContact(pool, tenantId, {
    name: "Jonas Lindqvist",
    email: "jonas@example.com",
    status: "qualified",
  });
  jonasId = jonas.id;
  await createContact(pool, tenantId, {
    name: "Sam Okafor",
    email: "sam@example.com",
    status: "lead",
  });
  await createDeal(pool, tenantId, {
    name: "Enterprise upgrade",
    organization_id: bluepeakId,
    contact_id: jonasId,
    stage: "Negotiation",
    value: 120000,
  });
  await createDeal(pool, tenantId, {
    name: "Loyalty program",
    stage: "Qualified",
    value: 38000,
  });
});

describe("organization search", () => {
  it("matches by name, case-insensitively", async () => {
    expect(
      (await listOrganizations(pool, tenantId, "northwind")).map((o) => o.name),
    ).toEqual(["Northwind Logistics"]);
  });

  it("matches by website and industry", async () => {
    expect(await listOrganizations(pool, tenantId, "bluepeak.io")).toHaveLength(
      1,
    );
    expect(await listOrganizations(pool, tenantId, "Transport")).toHaveLength(
      1,
    );
  });

  it("returns nothing for a non-match", async () => {
    expect(await listOrganizations(pool, tenantId, "zzz")).toHaveLength(0);
  });
});

describe("contact search and filter", () => {
  it("searches by name", async () => {
    expect(
      (await listContacts(pool, tenantId, { q: "maria" })).map((c) => c.name),
    ).toEqual(["Maria Delgado"]);
  });

  it("searches by email", async () => {
    // The fixtures share a reserved domain, so the local part is what distinguishes them.
    expect(
      (await listContacts(pool, tenantId, { q: "jonas@" })).map((c) => c.name),
    ).toEqual(["Jonas Lindqvist"]);
  });

  it("filters by status", async () => {
    expect(
      (await listContacts(pool, tenantId, { status: "lead" })).map(
        (c) => c.name,
      ),
    ).toEqual(["Sam Okafor"]);
  });

  it("combines search and status filter", async () => {
    expect(
      await listContacts(pool, tenantId, { q: "sam", status: "customer" }),
    ).toHaveLength(0);
    expect(
      await listContacts(pool, tenantId, { q: "sam", status: "lead" }),
    ).toHaveLength(1);
  });
});

describe("deal search", () => {
  it("searches by name", async () => {
    expect(
      (await listDeals(pool, tenantId, { q: "upgrade" })).map((d) => d.name),
    ).toEqual(["Enterprise upgrade"]);
  });

  it("searches by the organization the deal is with", async () => {
    expect(
      (await listDeals(pool, tenantId, { q: "Bluepeak" })).map((d) => d.name),
    ).toEqual(["Enterprise upgrade"]);
  });

  it("searches by the primary contact", async () => {
    expect(
      (await listDeals(pool, tenantId, { q: "Jonas" })).map((d) => d.name),
    ).toEqual(["Enterprise upgrade"]);
  });

  it("still matches a deal that has no organization or contact", async () => {
    expect(
      (await listDeals(pool, tenantId, { q: "Loyalty" })).map((d) => d.name),
    ).toEqual(["Loyalty program"]);
  });

  it("combines search with the stage filter", async () => {
    expect(
      await listDeals(pool, tenantId, { q: "Bluepeak", stage: "Negotiation" }),
    ).toHaveLength(1);
    expect(
      await listDeals(pool, tenantId, { q: "Bluepeak", stage: "Qualified" }),
    ).toHaveLength(0);
  });

  it("returns nothing for a non-match", async () => {
    expect(await listDeals(pool, tenantId, { q: "zzz" })).toHaveLength(0);
  });
});
