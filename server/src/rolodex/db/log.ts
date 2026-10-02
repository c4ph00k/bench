/** What you log against a person: interactions, annual dates, facts and news. */
import { nowISO } from "../dates.js";
import type {
  Fact,
  ImportantDate,
  ImportantDateType,
  Interaction,
  InteractionType,
  NewsItem,
} from "../types.js";
import { isValidMonthDay } from "../importantDates.js";
import {
  dateFromRow,
  factFromRow,
  interactionFromRow,
  newsFromRow,
  type Row,
} from "./rows.js";
import type { Queryable } from "./index.js";

export interface LogRepo {
  listInteractions(personId: number): Promise<Interaction[]>;
  createInteraction(
    personId: number,
    type: InteractionType,
    date: string,
    notes: string | null,
  ): Promise<Interaction>;
  deleteInteraction(id: number): Promise<boolean>;
  lastContacted(personId: number): Promise<string | null>;
  interactionDates(): Promise<string[]>;

  listDates(personId: number): Promise<ImportantDate[]>;
  listAllDates(): Promise<(ImportantDate & { person_name: string })[]>;
  createDate(
    personId: number,
    type: ImportantDateType,
    label: string | null,
    day: { month: number; day: number; year: number | null },
  ): Promise<ImportantDate>;
  deleteDate(id: number): Promise<boolean>;

  listFacts(personId: number): Promise<Fact[]>;
  createFact(personId: number, text: string): Promise<Fact>;
  deleteFact(id: number): Promise<boolean>;

  listNews(personId: number): Promise<NewsItem[]>;
  createNews(personId: number, text: string, date: string): Promise<NewsItem>;
  deleteNews(id: number): Promise<boolean>;
}

export function logRepo(db: Queryable, tenantId: number): LogRepo {
  const rows = async (sql: string, params: (string | number)[] = []) => {
    const result = await db.query<Row>(sql, [tenantId, ...params]);
    return result.rows;
  };

  return {
    listInteractions: async (personId) =>
      (
        await rows(
          "SELECT * FROM interactions WHERE person_id = $2 AND tenant_id = $1 ORDER BY date DESC, id DESC",
          [personId],
        )
      ).map(interactionFromRow),

    createInteraction: async (personId, type, date, notes) => {
      const result = await db.query<Row>(
        "INSERT INTO interactions (tenant_id, person_id, type, date, notes, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [tenantId, personId, type, date, notes, nowISO()],
      );
      return interactionFromRow(result.rows[0]);
    },

    deleteInteraction: async (id) => {
      const result = await db.query(
        "DELETE FROM interactions WHERE id = $1 AND tenant_id = $2",
        [id, tenantId],
      );
      return (result.rowCount ?? 0) > 0;
    },

    lastContacted: async (personId) => {
      const result = await db.query<{ last: string | null }>(
        "SELECT MAX(date) AS last FROM interactions WHERE person_id = $1 AND tenant_id = $2",
        [personId, tenantId],
      );
      return result.rows[0].last;
    },

    interactionDates: async () => {
      const result = await db.query<{ date: string }>(
        "SELECT date FROM interactions WHERE tenant_id = $1",
        [tenantId],
      );
      return result.rows.map((r) => r.date);
    },

    listDates: async (personId) =>
      (
        await rows(
          "SELECT * FROM important_dates WHERE person_id = $2 AND tenant_id = $1 ORDER BY month, day",
          [personId],
        )
      ).map(dateFromRow),

    listAllDates: async () => {
      const result = await db.query<Row>(
        `SELECT d.*, p.name AS person_name FROM important_dates d
         JOIN people p ON p.id = d.person_id WHERE d.tenant_id = $1 ORDER BY d.month, d.day`,
        [tenantId],
      );
      return result.rows.map((r) => ({
        ...dateFromRow(r),
        person_name: r.person_name as string,
      }));
    },

    createDate: async (personId, type, label, { month, day, year }) => {
      if (!isValidMonthDay(month, day, year ?? undefined))
        throw new Error(`${day}/${month} is not a date`);
      const result = await db.query<Row>(
        `INSERT INTO important_dates (tenant_id, person_id, type, label, month, day, year, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [tenantId, personId, type, label, month, day, year, nowISO()],
      );
      return dateFromRow(result.rows[0]);
    },

    deleteDate: async (id) => {
      const result = await db.query(
        "DELETE FROM important_dates WHERE id = $1 AND tenant_id = $2",
        [id, tenantId],
      );
      return (result.rowCount ?? 0) > 0;
    },

    listFacts: async (personId) =>
      (
        await rows(
          "SELECT * FROM facts WHERE person_id = $2 AND tenant_id = $1 ORDER BY created_at, id",
          [personId],
        )
      ).map(factFromRow),

    createFact: async (personId, text) => {
      const result = await db.query<Row>(
        "INSERT INTO facts (tenant_id, person_id, text, created_at) VALUES ($1, $2, $3, $4) RETURNING *",
        [tenantId, personId, text, nowISO()],
      );
      return factFromRow(result.rows[0]);
    },

    deleteFact: async (id) => {
      const result = await db.query(
        "DELETE FROM facts WHERE id = $1 AND tenant_id = $2",
        [id, tenantId],
      );
      return (result.rowCount ?? 0) > 0;
    },

    listNews: async (personId) =>
      (
        await rows(
          "SELECT * FROM news WHERE person_id = $2 AND tenant_id = $1 ORDER BY date DESC, id DESC",
          [personId],
        )
      ).map(newsFromRow),

    createNews: async (personId, text, date) => {
      const result = await db.query<Row>(
        "INSERT INTO news (tenant_id, person_id, text, date, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [tenantId, personId, text, date, nowISO()],
      );
      return newsFromRow(result.rows[0]);
    },

    deleteNews: async (id) => {
      const result = await db.query(
        "DELETE FROM news WHERE id = $1 AND tenant_id = $2",
        [id, tenantId],
      );
      return (result.rowCount ?? 0) > 0;
    },
  };
}
