import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type express from "express";
import { appWithRolodex } from "./app.js";
import { makePerson, testRepo } from "./helpers.js";
import type { Repo } from "../../src/rolodex/db/index.js";
import { todayISO, addDaysISO } from "../../src/rolodex/dates.js";
import type {
  Gift,
  ImportantDate,
  Interaction,
  NewsItem,
  Person,
  PersonComputed,
  Reminder,
  TimelineEntry,
} from "../../src/rolodex/types.js";

/**
 * supertest types a body as `any`, and that spreads through every assertion. These name what
 * each endpoint actually hands back.
 */
interface PersonPage {
  person: PersonComputed;
  interactions: Interaction[];
  dates: ImportantDate[];
  facts: { id: number; text: string }[];
  news: NewsItem[];
  reminders: Reminder[];
  gifts: Gift[];
  connections: { id: number; other_name: string; description: string }[];
}

interface TodayPage {
  today: string;
  to_contact: { id: number; name: string; overdue_days: number }[];
  upcoming_dates: { person_name: string; date: string }[];
  reminders: Reminder[];
  recent: TimelineEntry[];
}

interface Stats {
  months: { key: string; label: string; count: number }[];
  circles: { circle: string; total: number }[];
}

interface CalendarPage {
  year: number;
  month: number;
  events: { person_name: string; date: string }[];
  upcoming: { person_name: string; date: string }[];
}

interface ImportPreview {
  format: string;
  headers?: string[];
  raw_rows?: Record<string, string>[];
  rows: {
    index: number;
    person: Record<string, string | null>;
    duplicate: { isDuplicate: boolean; reason: string | null };
  }[];
}

interface Applied {
  created: { id: number; name: string }[];
  skipped: number;
}

interface Failure {
  error: string;
}

let repo: Repo;
let app: express.Express;

beforeEach(() => {
  repo = testRepo();
  app = appWithRolodex(repo);
});

const post = (path: string, body: object) =>
  request(app).post(`/api/rolodex${path}`).send(body);
const get = (path: string) => request(app).get(`/api/rolodex${path}`);

describe("people", () => {
  it("creates a person and reads them back with their derived status", async () => {
    const created = await post("/people", {
      name: "  Ada Lovelace  ",
      email: "ada@example.com",
      circle: "inner",
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      name: "Ada Lovelace",
      circle: "inner",
    });

    const list = await get("/people");
    const people = list.body as PersonComputed[];
    expect(people).toHaveLength(1);
    // Never contacted means due from today, so they are overdue only from tomorrow.
    expect(people[0]).toMatchObject({
      status: "due_soon",
      next_due: todayISO(),
      last_contacted: null,
    });
  });

  it("refuses a person with no name", async () => {
    const res = await post("/people", { email: "nobody@example.com" });
    expect(res.status).toBe(400);
    expect(res.body as Failure).toEqual({ error: "Name is required" });
  });

  it("filters the list by search, circle and tag", async () => {
    makePerson(repo, "Maya Chen", { company: "Figma", tags: ["design"] });
    makePerson(repo, "Ben Foster", { circle: "inner", tags: ["university"] });

    const found = async (query: string) =>
      ((await get(`/people${query}`)).body as PersonComputed[]).length;
    expect(await found("?search=figma")).toBe(1);
    expect(await found("?circle=inner")).toBe(1);
    expect(await found("?tag=design")).toBe(1);
    expect(await found("?circle=nonsense")).toBe(2);
  });

  it("answers 404 for someone who is not there", async () => {
    const res = await get("/people/99");
    expect(res.status).toBe(404);
    expect(res.body as Failure).toEqual({ error: "Not found" });
  });

  it("returns everything logged about a person in one reply", async () => {
    const p = makePerson(repo);
    const res = await get(`/people/${p.id}`);
    expect(
      Object.keys(res.body as PersonPage).sort((a, b) => a.localeCompare(b)),
    ).toEqual([
      "connections",
      "dates",
      "facts",
      "gifts",
      "interactions",
      "news",
      "person",
      "reminders",
    ]);
  });

  it("edits a person but ignores an id or created_at sent with the edit", async () => {
    const p = makePerson(repo, "Maya Chen");
    const res = await request(app)
      .patch(`/api/rolodex/people/${p.id}`)
      .send({ company: "Figma", id: 999, created_at: "1999-01-01" });
    const updated = res.body as Person;
    expect(updated).toMatchObject({ id: p.id, company: "Figma" });
    expect(updated.created_at).toBe(p.created_at);
  });

  it("deletes a person, once", async () => {
    const p = makePerson(repo);
    expect(
      (await request(app).delete(`/api/rolodex/people/${p.id}`)).status,
    ).toBe(200);
    expect(
      (await request(app).delete(`/api/rolodex/people/${p.id}`)).status,
    ).toBe(404);
  });
});

describe("what gets logged against a person", () => {
  it("logs an interaction, which resets the check-in clock", async () => {
    const p = makePerson(repo, "Maya Chen", { circle: "inner" });
    const res = await post(`/people/${p.id}/interactions`, {
      type: "call",
      date: todayISO(),
      notes: "  Caught up  ",
    });
    expect(res.status).toBe(201);
    expect((res.body as Interaction).notes).toBe("Caught up");
    expect(((await get("/people")).body as PersonComputed[])[0]).toMatchObject({
      status: "in_touch",
      last_contacted: todayISO(),
    });
  });

  it("refuses an interaction of an unknown kind, or with a bad date", async () => {
    const p = makePerson(repo);
    expect(
      (
        await post(`/people/${p.id}/interactions`, {
          type: "smoke signal",
          date: todayISO(),
        })
      ).body as Failure,
    ).toEqual({ error: "Invalid interaction type" });
    expect(
      (
        await post(`/people/${p.id}/interactions`, {
          type: "call",
          date: "yesterday",
        })
      ).body as Failure,
    ).toEqual({ error: "A valid date (yyyy-mm-dd) is required" });
  });

  it("records an important date, and rejects one that never happens", async () => {
    const p = makePerson(repo);
    const ok = await post(`/people/${p.id}/dates`, {
      type: "birthday",
      month: 3,
      day: 15,
      year: 1990,
    });
    expect(ok.status).toBe(201);

    const bad = await post(`/people/${p.id}/dates`, {
      type: "birthday",
      month: 2,
      day: 31,
    });
    expect(bad.status).toBe(400);
    expect((bad.body as Failure).error).toMatch(/not a date/);

    const worse = await post(`/people/${p.id}/dates`, {
      type: "birthday",
      month: 13,
      day: 1,
    });
    expect(worse.body as Failure).toEqual({ error: "Invalid month/day" });
  });

  it("keeps facts and news, and dates news today when none is given", async () => {
    const p = makePerson(repo);
    expect(
      (await post(`/people/${p.id}/facts`, { text: "Allergic to shellfish" }))
        .status,
    ).toBe(201);
    expect(
      (await post(`/people/${p.id}/facts`, { text: "  " })).body as Failure,
    ).toEqual({
      error: "Text is required",
    });

    const news = await post(`/people/${p.id}/news`, {
      text: "Moved to Berlin",
    });
    expect((news.body as NewsItem).date).toBe(todayISO());
  });

  it("carries a reminder through to done and back off the list", async () => {
    const p = makePerson(repo);
    const created = await post(`/people/${p.id}/reminders`, {
      text: "Book a table",
      due_date: addDaysISO(todayISO(), 3),
    });
    expect(created.status).toBe(201);

    const done = await request(app)
      .patch(`/api/rolodex/reminders/${(created.body as Reminder).id}`)
      .send({ done: true });
    expect(done.body as Reminder).toMatchObject({ done: true });
    expect((done.body as Reminder).done_at).not.toBeNull();

    const today = await get("/today");
    expect((today.body as TodayPage).reminders).toHaveLength(0);
  });

  it("moves a gift from idea to given", async () => {
    const p = makePerson(repo);
    const gift = await post(`/people/${p.id}/gifts`, {
      name: "Ceramic bowls",
      kind: "idea",
    });
    expect((gift.body as Gift).date).toBe(todayISO());

    const given = await request(app)
      .patch(`/api/rolodex/gifts/${(gift.body as Gift).id}`)
      .send({ kind: "given" });
    expect(given.body as Gift).toMatchObject({
      kind: "given",
      name: "Ceramic bowls",
    });
    expect(
      (await request(app).patch("/api/rolodex/gifts/999").send({})).status,
    ).toBe(404);
  });

  it("refuses a gift of an unknown kind", async () => {
    const p = makePerson(repo);
    expect(
      (await post(`/people/${p.id}/gifts`, { name: "Socks", kind: "borrowed" }))
        .body as Failure,
    ).toEqual({ error: "Invalid gift kind" });
  });

  it("connects two people, reading correctly from each side", async () => {
    const kate = makePerson(repo, "Kate Marsh");
    const sam = makePerson(repo, "Sam Fielding");
    const res = await post(`/people/${kate.id}/connections`, {
      other_id: sam.id,
      kind: "parent_child",
      a_is_parent: true,
    });
    expect(res.status).toBe(201);

    const from = async (id: number) =>
      ((await get(`/people/${id}`)).body as PersonPage).connections[0]
        .description;
    expect(await from(kate.id)).toBe("Parent of Sam Fielding");
    expect(await from(sam.id)).toBe("Child of Kate Marsh");
  });

  it("will not connect someone to themselves, or to nobody", async () => {
    const kate = makePerson(repo, "Kate Marsh");
    expect(
      (
        await post(`/people/${kate.id}/connections`, {
          other_id: kate.id,
          kind: "partner",
        })
      ).body as Failure,
    ).toEqual({ error: "A valid other person is required" });
    expect(
      (
        await post(`/people/${kate.id}/connections`, {
          other_id: 404,
          kind: "partner",
        })
      ).body as Failure,
    ).toEqual({ error: "A valid other person is required" });
  });
});

describe("the views over it all", () => {
  it("puts the most overdue person first on today, with how late they are", async () => {
    const late = makePerson(repo, "Late Larry", { circle: "inner" });
    const later = makePerson(repo, "Later Lucy", { circle: "inner" });
    repo.createInteraction(late.id, "call", addDaysISO(todayISO(), -40), null);
    repo.createInteraction(
      later.id,
      "call",
      addDaysISO(todayISO(), -200),
      null,
    );

    const body = (await get("/today")).body as TodayPage;
    expect(body.today).toBe(todayISO());
    expect(body.to_contact.map((p) => p.name)).toEqual([
      "Later Lucy",
      "Late Larry",
    ]);
    expect(body.to_contact[0].overdue_days).toBeGreaterThan(
      body.to_contact[1].overdue_days,
    );
  });

  it("counts a year of interactions by month, and people by circle", async () => {
    const p = makePerson(repo, "Maya Chen", { circle: "close" });
    repo.createInteraction(p.id, "call", todayISO(), null);

    const body = (await get("/stats")).body as Stats;
    expect(body.months).toHaveLength(12);
    expect(body.months.at(-1)).toMatchObject({ count: 1 });
    expect(body.circles.map((c) => c.circle)).toEqual([
      "inner",
      "close",
      "wider",
      "distant",
    ]);
    expect(body.circles.find((c) => c.circle === "close")).toMatchObject({
      total: 1,
    });
  });

  it("lists a month's dates, and what is coming up", async () => {
    const p = makePerson(repo, "Maya Chen");
    repo.createDate(p.id, "birthday", null, { month: 3, day: 15, year: 1990 });

    const body = (await get("/calendar?year=2027&month=3"))
      .body as CalendarPage;
    expect(body).toMatchObject({ year: 2027, month: 3 });
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      person_name: "Maya Chen",
      date: "2027-03-15",
    });
  });

  it("filters the timeline by person and by kind", async () => {
    const maya = makePerson(repo, "Maya Chen");
    const ben = makePerson(repo, "Ben Foster");
    repo.createInteraction(maya.id, "call", "2026-06-01", "Talked");
    repo.createNews(ben.id, "Moved to Berlin", "2026-07-01");

    const entries = async (query: string) =>
      (await get(`/timeline${query}`)).body as TimelineEntry[];
    expect(await entries("")).toHaveLength(2);
    expect(await entries(`?person=${maya.id}`)).toHaveLength(1);
    expect((await entries("?kind=news"))[0]).toMatchObject({
      kind: "news",
      person_name: "Ben Foster",
    });
    expect(await entries("?kind=interaction_call")).toHaveLength(1);
  });

  it("collects the distinct tags in use", async () => {
    makePerson(repo, "One", { tags: ["family", "cycling"] });
    makePerson(repo, "Two", { tags: ["family"] });
    expect((await get("/tags")).body as string[]).toEqual([
      "cycling",
      "family",
    ]);
  });
});

describe("importing", () => {
  const CSV = `Name,Email,Company\nNora Feldman,nora@example.com,Feldman Studio\nOwen Clarke,owen@example.com,Hartley PR`;

  it("parses a CSV, suggests a mapping and previews the rows", async () => {
    const body = (
      await post("/import/parse", { filename: "contacts.csv", content: CSV })
    ).body as ImportPreview;
    expect(body.format).toBe("csv");
    expect(body.headers).toEqual(["Name", "Email", "Company"]);
    expect(body.rows).toHaveLength(2);
    expect(body.rows[0].person).toMatchObject({
      name: "Nora Feldman",
      company: "Feldman Studio",
    });
  });

  it("flags someone already in the rolodex by their email", async () => {
    makePerson(repo, "Nora Feldman");
    const res = await post("/import/parse", {
      filename: "contacts.csv",
      content: "Name,Email\nNora Feldman,nora.feldman@example.com",
    });
    expect((res.body as ImportPreview).rows[0].duplicate).toMatchObject({
      isDuplicate: true,
      reason: "email",
    });
  });

  it("reads a vCard by its content, whatever the file is called", async () => {
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Ada Lovelace",
      "EMAIL:ada@example.com",
      "END:VCARD",
    ].join("\r\n");
    const body = (
      await post("/import/parse", { filename: "contacts.txt", content: vcard })
    ).body as ImportPreview;
    expect(body.format).toBe("vcf");
    expect(body.rows[0].person).toMatchObject({ name: "Ada Lovelace" });
  });

  it("refuses an empty file", async () => {
    expect(
      (await post("/import/parse", { content: "  " })).body as Failure,
    ).toEqual({
      error: "A file is required",
    });
  });

  it("re-reads a CSV through a corrected mapping", async () => {
    const parsed = (
      await post("/import/parse", { filename: "c.csv", content: CSV })
    ).body as ImportPreview;
    const remapped = (
      await post("/import/remap", {
        headers: parsed.headers,
        raw_rows: parsed.raw_rows,
        mapping: { Name: "name", Company: "city" },
      })
    ).body as ImportPreview;
    expect(remapped.rows[0].person).toMatchObject({
      name: "Nora Feldman",
      city: "Feldman Studio",
      company: null,
    });
    expect(
      (await post("/import/remap", { headers: "no" })).body as Failure,
    ).toEqual({
      error: "Invalid remap request",
    });
  });

  it("imports the chosen people, skipping the duplicates and keeping birthdays", async () => {
    const people = [
      {
        name: "Nora Feldman",
        email: "nora@example.com",
        phone: null,
        job_title: null,
        company: null,
        city: null,
        birthday: "1993-04-11",
        notes: null,
      },
      {
        name: "No Year",
        email: null,
        phone: null,
        job_title: null,
        company: null,
        city: null,
        birthday: "--04-11",
        notes: null,
      },
    ];
    const res = await post("/import/apply", { people });
    expect(res.status).toBe(201);
    expect((res.body as Applied).created).toHaveLength(2);

    const imported = (await get("/people")).body as PersonComputed[];
    expect(imported[0].tags).toEqual(["imported"]);
    const dates = repo.listAllDates();
    expect(dates.map((d) => [d.month, d.day, d.year])).toEqual([
      [4, 11, 1993],
      [4, 11, null],
    ]);

    // A second run of the same file adds nobody.
    const again = (await post("/import/apply", { people })).body as Applied;
    expect(again).toMatchObject({ skipped: 2 });
    expect(again.created).toHaveLength(0);
  });

  it("refuses an import with nobody in it", async () => {
    expect(
      (await post("/import/apply", { people: [] })).body as Failure,
    ).toEqual({
      error: "No people to import",
    });
  });
});

describe("caching", () => {
  it("tells the browser not to store an API reply", async () => {
    // Without this a revalidation comes back 304 with an empty body, and the client parses it.
    const res = await get("/people");
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});
