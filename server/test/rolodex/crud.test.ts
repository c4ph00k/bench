import { describe, it, expect, beforeEach } from "vitest";
import { setupRolodex, makePerson } from "./helpers.js";
import type { ConnectionInput } from "../../src/rolodex/db/connections.js";
import type { Repo } from "../../src/rolodex/db/index.js";

/** A plain colleague connection, spread over with whatever the test is actually about. */
const CONNECTION: ConnectionInput = {
  kind: "colleague",
  a_is_parent: false,
  label: null,
  inverse_label: null,
  note: null,
};

let repo: Repo;
beforeEach(async () => {
  repo = (await setupRolodex()).repo;
});

describe("people CRUD", () => {
  it("creates and reads a person", async () => {
    const p = await repo.createPerson({
      name: "Ada Lovelace",
      email: "ada@example.com",
      circle: "inner",
      tags: ["maths"],
    });
    expect(p.id).toBeGreaterThan(0);
    const fetched = (await repo.getPerson(p.id))!;
    expect(fetched.name).toBe("Ada Lovelace");
    expect(fetched.circle).toBe("inner");
    expect(fetched.tags).toEqual(["maths"]);
    expect(fetched.status).toBeDefined();
  });

  it("updates a person", async () => {
    const p = await makePerson(repo, "Grace Hopper");
    const updated = (await repo.updatePerson(p.id, {
      company: "US Navy",
      circle: "wider",
      tags: ["computing"],
    }))!;
    expect(updated.company).toBe("US Navy");
    expect(updated.circle).toBe("wider");
    expect(updated.tags).toEqual(["computing"]);
    expect((await repo.getPerson(p.id))!.name).toBe("Grace Hopper"); // untouched fields stay
  });

  it("deletes a person and cascades", async () => {
    const p = await makePerson(repo, "Temp Person");
    await repo.createInteraction(p.id, "call", "2026-01-01", "x");
    await repo.createFact(p.id, "fact");
    const q = await makePerson(repo, "Other Person");
    await repo.createConnection(p.id, q.id, CONNECTION);
    expect(await repo.deletePerson(p.id)).toBe(true);
    expect(await repo.getPerson(p.id)).toBeNull();
    expect(await repo.listInteractions(p.id)).toHaveLength(0);
    expect(await repo.listFacts(p.id)).toHaveLength(0);
    expect(await repo.listConnections(q.id)).toHaveLength(0); // no broken connections
    expect(await repo.deletePerson(p.id)).toBe(false);
  });

  it("lists people with computed fields", async () => {
    const p = await makePerson(repo, "With News");
    await repo.createInteraction(p.id, "met", "2026-01-15", "lunch");
    await repo.createNews(p.id, "Started a new job", "2026-01-10");
    const listed = (await repo.listPeople()).find((x) => x.id === p.id)!;
    expect(listed.last_contacted).toBe("2026-01-15");
    expect(listed.latest_news?.text).toBe("Started a new job");
  });
});

describe("interactions CRUD", () => {
  it("creates, lists newest-first, and deletes", async () => {
    const p = await makePerson(repo);
    const i1 = await repo.createInteraction(
      p.id,
      "call",
      "2025-06-01",
      "first",
    );
    await repo.createInteraction(p.id, "email", "2026-02-01", "second");
    const list = await repo.listInteractions(p.id);
    expect(list).toHaveLength(2);
    expect(list[0].notes).toBe("second"); // newest first
    expect(await repo.lastContacted(p.id)).toBe("2026-02-01");
    expect(await repo.deleteInteraction(i1.id)).toBe(true);
    expect(await repo.listInteractions(p.id)).toHaveLength(1);
  });

  it("recalculates last contacted when the newest interaction is deleted", async () => {
    const p = await makePerson(repo);
    const newest = await repo.createInteraction(
      p.id,
      "call",
      "2026-05-01",
      "newest",
    );
    await repo.createInteraction(p.id, "call", "2026-01-01", "older");
    expect(await repo.lastContacted(p.id)).toBe("2026-05-01");
    await repo.deleteInteraction(newest.id);
    expect(await repo.lastContacted(p.id)).toBe("2026-01-01");
  });
});

describe("important dates CRUD", () => {
  it("creates, reads and deletes dates", async () => {
    const p = await makePerson(repo);
    const d = await repo.createDate(p.id, "birthday", null, {
      month: 3,
      day: 15,
      year: 1990,
    });
    await repo.createDate(p.id, "anniversary", "Wedding", {
      month: 6,
      day: 14,
      year: 2018,
    });
    const list = await repo.listDates(p.id);
    expect(list).toHaveLength(2);
    expect(list.find((x) => x.id === d.id)!.year).toBe(1990);
    expect(await repo.listAllDates()).toHaveLength(2);
    await repo.deleteDate(d.id);
    expect(await repo.listDates(p.id)).toHaveLength(1);
  });
});

describe("facts CRUD", () => {
  it("creates and deletes facts", async () => {
    const p = await makePerson(repo);
    const f = await repo.createFact(p.id, "Allergic to shellfish");
    expect(await repo.listFacts(p.id)).toHaveLength(1);
    await repo.deleteFact(f.id);
    expect(await repo.listFacts(p.id)).toHaveLength(0);
  });
});

describe("news CRUD", () => {
  it("creates, lists newest-first, deletes", async () => {
    const p = await makePerson(repo);
    await repo.createNews(p.id, "older news", "2025-01-01");
    const n2 = await repo.createNews(p.id, "newer news", "2026-01-01");
    const list = await repo.listNews(p.id);
    expect(list[0].text).toBe("newer news");
    expect((await repo.getPerson(p.id))!.latest_news!.text).toBe("newer news");
    await repo.deleteNews(n2.id);
    expect((await repo.getPerson(p.id))!.latest_news!.text).toBe("older news");
  });
});

describe("reminders CRUD", () => {
  it("creates, toggles done, deletes", async () => {
    const p = await makePerson(repo);
    const r = await repo.createReminder(
      p.id,
      "Send birthday card",
      "2026-09-01",
    );
    expect(r.done).toBe(false);
    const done = (await repo.setReminderDone(r.id, true))!;
    expect(done.done).toBe(true);
    expect(done.done_at).toBeTruthy();
    const undone = (await repo.setReminderDone(r.id, false))!;
    expect(undone.done).toBe(false);
    expect(undone.done_at).toBeNull();
    // open reminders only includes not-done
    await repo.setReminderDone(r.id, true);
    expect(await repo.listOpenReminders()).toHaveLength(0);
    await repo.deleteReminder(r.id);
    expect(await repo.listReminders(p.id)).toHaveLength(0);
  });
});

describe("gifts CRUD", () => {
  it("creates, updates (e.g. mark given), deletes", async () => {
    const p = await makePerson(repo);
    const g = await repo.createGift(
      p.id,
      "Ceramic bowl set",
      "idea",
      "Birthday",
      "2026-01-01",
    );
    expect(await repo.listGifts(p.id)).toHaveLength(1);
    const updated = (await repo.updateGift(g.id, { kind: "given" }))!;
    expect(updated.kind).toBe("given");
    await repo.deleteGift(g.id);
    expect(await repo.listGifts(p.id)).toHaveLength(0);
  });
});

describe("connections CRUD", () => {
  it("creates connections visible from both sides with correct descriptions", async () => {
    const kate = await makePerson(repo, "Kate Marsh");
    const sam = await makePerson(repo, "Sam Fielding");
    await repo.createConnection(kate.id, sam.id, {
      ...CONNECTION,
      kind: "parent_child",
      a_is_parent: true,
    });

    const fromKate = await repo.listConnections(kate.id);
    expect(fromKate[0].other_name).toBe("Sam Fielding");
    expect(fromKate[0].description).toBe("Parent of Sam Fielding");

    const fromSam = await repo.listConnections(sam.id);
    expect(fromSam[0].other_name).toBe("Kate Marsh");
    expect(fromSam[0].description).toBe("Child of Kate Marsh");
  });

  it("deletes a connection from either side", async () => {
    const a = await makePerson(repo, "A");
    const b = await makePerson(repo, "B");
    const c = await repo.createConnection(a.id, b.id, {
      ...CONNECTION,
      kind: "partner",
    });
    expect(await repo.listConnections(a.id)).toHaveLength(1);
    await repo.deleteConnection(c.id);
    expect(await repo.listConnections(a.id)).toHaveLength(0);
    expect(await repo.listConnections(b.id)).toHaveLength(0);
  });

  it('supports labelled "other" connections readably from both sides', async () => {
    const peter = await makePerson(repo, "Peter Novak");
    const elena = await makePerson(repo, "Elena Petrova");
    await repo.createConnection(peter.id, elena.id, {
      ...CONNECTION,
      kind: "other",
      label: "Introduced me to Elena",
      inverse_label: "Introduced me to Peter",
    });
    expect((await repo.listConnections(peter.id))[0].description).toBe(
      "Introduced me to Elena",
    );
    expect((await repo.listConnections(elena.id))[0].description).toBe(
      "Introduced me to Peter",
    );
  });
});

describe("timeline", () => {
  it("combines interactions, news and completed reminders, newest first", async () => {
    const p = await makePerson(repo);
    await repo.createInteraction(p.id, "call", "2026-03-01", "call notes");
    await repo.createNews(p.id, "a news item", "2026-02-01");
    const r = await repo.createReminder(p.id, "a reminder", "2026-01-01");
    await repo.setReminderDone(r.id, true);
    const entries = await repo.timeline(null, null);
    const today = new Date().toISOString().slice(0, 10);
    expect(entries.map((e) => e.date)).toEqual([
      today,
      "2026-03-01",
      "2026-02-01",
    ]);
    expect(await repo.timeline(p.id, "interaction")).toHaveLength(1);
    expect(await repo.timeline(p.id, "news")).toHaveLength(1);
    expect(await repo.timeline(p.id, "reminder_done")).toHaveLength(1);
  });
});

describe("tags", () => {
  it("collects the distinct set of tags", async () => {
    await makePerson(repo, "One", { tags: ["family", "cycling"] });
    await makePerson(repo, "Two", { tags: ["family", "tech"] });
    expect(await repo.allTags()).toEqual(["cycling", "family", "tech"]);
  });
});
