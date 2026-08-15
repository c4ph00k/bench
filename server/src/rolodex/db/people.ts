/** People, and the check-in status derived for each of them on the way out. */
import { computeStatus } from "../cadence.js";
import { nowISO } from "../dates.js";
import type { Person, PersonComputed, PersonInput } from "../types.js";
import {
  deleteRow,
  personFromRow,
  readRow,
  type DB,
  type Param,
  type Row,
} from "./rows.js";

interface NewPerson extends Partial<PersonInput> {
  name: string;
}

export interface PeopleRepo {
  listPeople(): PersonComputed[];
  getPerson(id: number): PersonComputed | null;
  createPerson(input: NewPerson): Person;
  updatePerson(id: number, patch: Partial<PersonInput>): Person | null;
  deletePerson(id: number): boolean;
  personCount(): number;
  allTags(): string[];
}

const COLUMNS = [
  "name",
  "email",
  "phone",
  "job_title",
  "company",
  "city",
  "timezone",
  "circle",
  "cadence_override_days",
  "checkins_off",
  "snoozed_until",
  "how_met",
  "met_where",
  "met_on",
  "notes",
  "tags",
  "photo",
] as const;

/** The column values in COLUMNS order. Three of them are not what SQLite can store: a circle
    defaults, a boolean becomes 0 or 1, and tags are JSON. Everything absent becomes NULL. */
function values(p: NewPerson | Person): Param[] {
  const row: Record<string, unknown> = {
    ...p,
    circle: p.circle ?? "close",
    checkins_off: p.checkins_off ? 1 : 0,
    tags: JSON.stringify(p.tags ?? []),
  };
  return COLUMNS.map((c) => (row[c] ?? null) as Param);
}

const PLACEHOLDERS = COLUMNS.map(() => "?").join(", ");
const ASSIGNMENTS = COLUMNS.map((c) => `${c} = ?`).join(", ");

export function peopleRepo(db: DB): PeopleRepo {
  const insert = db.prepare(
    `INSERT INTO people (${COLUMNS.join(", ")}, created_at, updated_at)
     VALUES (${PLACEHOLDERS}, ?, ?)`,
  );
  const update = db.prepare(
    `UPDATE people SET ${ASSIGNMENTS}, updated_at = ? WHERE id = ?`,
  );
  const lastContacted = db.prepare(
    "SELECT MAX(date) AS last FROM interactions WHERE person_id = ?",
  );
  const latestNews = db.prepare(
    "SELECT id, text, date FROM news WHERE person_id = ? ORDER BY date DESC, id DESC LIMIT 1",
  );

  /** A person plus what the app actually asks about them: when you last spoke, and whether that
      is overdue. Both are derived rather than stored, so they cannot drift. */
  function computed(p: Person): PersonComputed {
    const last = (lastContacted.get(p.id) as Row).last as string | null;
    const news = latestNews.get(p.id) as Row | undefined;
    const status = computeStatus(p, last);
    return {
      ...p,
      last_contacted: last,
      next_due: status.nextDue,
      status: status.status,
      latest_news: news
        ? {
            id: news.id as number,
            text: news.text as string,
            date: news.date as string,
          }
        : null,
    };
  }

  const read = (id: number): Person => personFromRow(readRow(db, "people", id));

  return {
    listPeople: () =>
      (
        db
          .prepare("SELECT * FROM people ORDER BY name COLLATE NOCASE")
          .all() as Row[]
      ).map((r) => computed(personFromRow(r))),

    getPerson: (id) => {
      const row = db.prepare("SELECT * FROM people WHERE id = ?").get(id) as
        Row | undefined;
      return row ? computed(personFromRow(row)) : null;
    },

    createPerson: (input) => {
      const now = nowISO();
      const info = insert.run(...values(input), now, now);
      return read(Number(info.lastInsertRowid));
    },

    updatePerson: (id, patch) => {
      update.run(...values({ ...read(id), ...patch }), nowISO(), id);
      return read(id);
    },

    deletePerson: (id) => deleteRow(db, "people", id),

    personCount: () =>
      (db.prepare("SELECT COUNT(*) AS n FROM people").get() as Row).n as number,

    allTags: () => {
      const rows = db.prepare("SELECT tags FROM people").all() as Row[];
      const tags = new Set<string>();
      for (const r of rows)
        for (const t of JSON.parse(r.tags as string) as string[]) tags.add(t);
      return [...tags].sort((a, b) => a.localeCompare(b));
    },
  };
}
