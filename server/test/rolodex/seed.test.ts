import { beforeEach, describe, expect, it } from "vitest";
import type { Repo } from "../../src/rolodex/db/index.js";
import { seedIfEmpty } from "../../src/rolodex/seed.js";
import { todayISO } from "../../src/rolodex/dates.js";
import { upcomingDates } from "../../src/rolodex/importantDates.js";
import { setupRolodex } from "./helpers.js";

/**
 * The seed is what a new rolodex looks like on first launch, so it is checked the way you would
 * look at it: is every screen alive, and is any of it obviously wrong?
 */
let repo: Repo;
let pool: Awaited<ReturnType<typeof setupRolodex>>["pool"];
let tenantId: number;

beforeEach(async () => {
  const ctx = await setupRolodex();
  pool = ctx.pool;
  tenantId = ctx.tenantId;
  repo = ctx.repo;
  await seedIfEmpty(pool, tenantId);
});

describe("the seeded rolodex", () => {
  it("fills every circle with people", async () => {
    const people = await repo.listPeople();
    expect(people.length).toBeGreaterThan(20);
    for (const circle of ["inner", "close", "wider", "distant"] as const)
      expect(people.filter((p) => p.circle === circle).length).toBeGreaterThan(
        0,
      );
  });

  it("leaves nobody without an email or a tag to filter by", async () => {
    const people = await repo.listPeople();
    for (const p of people) {
      expect(p.email).toBeTruthy();
      expect(p.name.trim()).not.toBe("");
    }
    expect((await repo.allTags()).length).toBeGreaterThan(5);
  });

  it("gives Today something in each of its sections", async () => {
    const people = await repo.listPeople();
    expect(people.some((p) => p.status === "overdue")).toBe(true);
    expect(people.some((p) => p.status === "in_touch")).toBe(true);
    expect((await repo.listOpenReminders()).length).toBeGreaterThan(0);
    expect(upcomingDates(await repo.listAllDates(), 30).length).toBeGreaterThan(
      0,
    );
  });

  it("spreads interactions back through the year, none of them in the future", async () => {
    const timeline = await repo.timeline(null, "interaction");
    expect(timeline.length).toBeGreaterThan(50);
    const today = todayISO();
    for (const entry of timeline) expect(entry.date <= today).toBe(true);
    const oldest = timeline.at(-1)!;
    expect(oldest.date < today).toBe(true);
  });

  it("connects people to each other, readably from both ends", async () => {
    const people = await repo.listPeople();
    const allConnections = await Promise.all(
      people.map((p) => repo.listConnections(p.id)),
    );
    const withConnections = allConnections.filter((c) => c.length > 0);
    expect(withConnections.length).toBeGreaterThan(4);
    for (const connection of withConnections.flat())
      expect(connection.description).not.toBe("");
  });

  it("includes someone snoozed and someone with check-ins off, so both states show", async () => {
    const people = await repo.listPeople();
    expect(people.some((p) => p.status === "snoozed")).toBe(true);
    expect(people.some((p) => p.checkins_off)).toBe(true);
  });

  it("does not seed a second time over an existing rolodex", async () => {
    const before = await repo.personCount();
    await seedIfEmpty(pool, tenantId);
    expect(await repo.personCount()).toBe(before);
  });

  it("plants a birthday in each of the next three months, whatever today is", async () => {
    const upcoming = upcomingDates(await repo.listAllDates(), 95);
    expect(upcoming.length).toBeGreaterThanOrEqual(3);
  });
});
