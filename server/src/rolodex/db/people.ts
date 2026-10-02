/** People, and the check-in status derived for each of them on the way out. */
import { computeStatus } from "../cadence.js";
import { nowISO } from "../dates.js";
import type { Person, PersonComputed, PersonInput } from "../types.js";
import { personFromRow, type Row } from "./rows.js";
import type { Queryable } from "./index.js";

interface NewPerson extends Partial<PersonInput> {
  name: string;
}

export interface PeopleRepo {
  listPeople(): Promise<PersonComputed[]>;
  getPerson(id: number): Promise<PersonComputed | null>;
  createPerson(input: NewPerson): Promise<Person>;
  updatePerson(id: number, patch: Partial<PersonInput>): Promise<Person | null>;
  deletePerson(id: number): Promise<boolean>;
  personCount(): Promise<number>;
  allTags(): Promise<string[]>;
}

const PERSON_COLUMNS = [
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

const INSERT_COLUMNS = [
  "tenant_id",
  ...PERSON_COLUMNS,
  "created_at",
  "updated_at",
];
const INSERT_PLACEHOLDERS = INSERT_COLUMNS.map((_, i) => `$${i + 1}`).join(
  ", ",
);

function personValues(input: NewPerson): unknown[] {
  const row: Record<string, unknown> = {
    ...input,
    circle: input.circle ?? "close",
    checkins_off: input.checkins_off ?? false,
    tags: JSON.stringify(input.tags ?? []),
  };
  return PERSON_COLUMNS.map((c) => row[c] ?? null);
}

export function peopleRepo(db: Queryable, tenantId: number): PeopleRepo {
  async function computed(p: Person): Promise<PersonComputed> {
    const last = await db.query<{ last: string | null }>(
      "SELECT MAX(date) AS last FROM interactions WHERE person_id = $1 AND tenant_id = $2",
      [p.id, tenantId],
    );
    const news = await db.query<Row>(
      "SELECT id, text, date FROM news WHERE person_id = $1 AND tenant_id = $2 ORDER BY date DESC, id DESC LIMIT 1",
      [p.id, tenantId],
    );
    const status = computeStatus(p, last.rows[0].last);
    const newsRow = news.rows[0] as Row | undefined;
    return {
      ...p,
      last_contacted: last.rows[0].last,
      next_due: status.nextDue,
      status: status.status,
      latest_news: newsRow
        ? {
            id: newsRow.id as number,
            text: newsRow.text as string,
            date: newsRow.date as string,
          }
        : null,
    };
  }

  async function read(id: number): Promise<Person | undefined> {
    const result = await db.query<Row>(
      "SELECT * FROM people WHERE id = $1 AND tenant_id = $2",
      [id, tenantId],
    );
    return result.rows[0] ? personFromRow(result.rows[0]) : undefined;
  }

  return {
    listPeople: async () => {
      const result = await db.query<Row>(
        "SELECT * FROM people WHERE tenant_id = $1 ORDER BY lower(name)",
        [tenantId],
      );
      return Promise.all(result.rows.map((r) => computed(personFromRow(r))));
    },

    getPerson: async (id) => {
      const result = await db.query<Row>(
        "SELECT * FROM people WHERE id = $1 AND tenant_id = $2",
        [id, tenantId],
      );
      return result.rows[0] ? computed(personFromRow(result.rows[0])) : null;
    },

    createPerson: async (input) => {
      const now = nowISO();
      const result = await db.query<Row>(
        `INSERT INTO people (${INSERT_COLUMNS.join(", ")}) VALUES (${INSERT_PLACEHOLDERS}) RETURNING *`,
        [tenantId, ...personValues(input), now, now],
      );
      return personFromRow(result.rows[0]);
    },

    updatePerson: async (id, patch) => {
      const current = await read(id);
      if (!current) return null;
      const merged = { ...current, ...patch };
      await db.query(
        `UPDATE people SET name = $1, email = $2, phone = $3, job_title = $4, company = $5, city = $6, timezone = $7, circle = $8, cadence_override_days = $9, checkins_off = $10, snoozed_until = $11, how_met = $12, met_where = $13, met_on = $14, notes = $15, tags = $16, photo = $17, updated_at = $18 WHERE id = $19 AND tenant_id = $20`,
        [
          merged.name,
          merged.email,
          merged.phone,
          merged.job_title,
          merged.company,
          merged.city,
          merged.timezone,
          merged.circle,
          merged.cadence_override_days,
          merged.checkins_off,
          merged.snoozed_until,
          merged.how_met,
          merged.met_where,
          merged.met_on,
          merged.notes,
          JSON.stringify(merged.tags),
          merged.photo,
          nowISO(),
          id,
          tenantId,
        ],
      );
      return (await read(id)) ?? null;
    },

    deletePerson: async (id) => {
      const result = await db.query(
        "DELETE FROM people WHERE id = $1 AND tenant_id = $2",
        [id, tenantId],
      );
      return (result.rowCount ?? 0) > 0;
    },

    personCount: async () => {
      const result = await db.query<{ n: number }>(
        "SELECT COUNT(*)::int AS n FROM people WHERE tenant_id = $1",
        [tenantId],
      );
      return result.rows[0].n;
    },

    allTags: async () => {
      const result = await db.query<Row>(
        "SELECT tags FROM people WHERE tenant_id = $1",
        [tenantId],
      );
      const tags = new Set<string>();
      for (const r of result.rows)
        for (const t of JSON.parse(r.tags as string) as string[]) tags.add(t);
      return [...tags].sort((a, b) => a.localeCompare(b));
    },
  };
}
