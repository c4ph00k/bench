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
  deleteRow,
  factFromRow,
  interactionFromRow,
  newsFromRow,
  readRow,
  type DB,
  type Row,
} from "./rows.js";

export interface LogRepo {
  listInteractions(personId: number): Interaction[];
  createInteraction(
    personId: number,
    type: InteractionType,
    date: string,
    notes: string | null,
  ): Interaction;
  deleteInteraction(id: number): boolean;
  lastContacted(personId: number): string | null;

  listDates(personId: number): ImportantDate[];
  listAllDates(): (ImportantDate & { person_name: string })[];
  createDate(
    personId: number,
    type: ImportantDateType,
    label: string | null,
    day: { month: number; day: number; year: number | null },
  ): ImportantDate;
  deleteDate(id: number): boolean;

  listFacts(personId: number): Fact[];
  createFact(personId: number, text: string): Fact;
  deleteFact(id: number): boolean;

  listNews(personId: number): NewsItem[];
  createNews(personId: number, text: string, date: string): NewsItem;
  deleteNews(id: number): boolean;
}

export function logRepo(db: DB): LogRepo {
  const rows = (sql: string, ...params: (string | number)[]) =>
    db.prepare(sql).all(...params) as Row[];

  return {
    listInteractions: (personId) =>
      rows(
        "SELECT * FROM interactions WHERE person_id = ? ORDER BY date DESC, id DESC",
        personId,
      ).map(interactionFromRow),

    createInteraction: (personId, type, date, notes) => {
      const info = db
        .prepare(
          "INSERT INTO interactions (person_id, type, date, notes, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .run(personId, type, date, notes, nowISO());
      return interactionFromRow(
        readRow(db, "interactions", info.lastInsertRowid),
      );
    },

    deleteInteraction: (id) => deleteRow(db, "interactions", id),

    lastContacted: (personId) =>
      (
        db
          .prepare(
            "SELECT MAX(date) AS last FROM interactions WHERE person_id = ?",
          )
          .get(personId) as Row
      ).last as string | null,

    listDates: (personId) =>
      rows(
        "SELECT * FROM important_dates WHERE person_id = ? ORDER BY month, day",
        personId,
      ).map(dateFromRow),

    listAllDates: () =>
      rows(
        `SELECT d.*, p.name AS person_name FROM important_dates d
         JOIN people p ON p.id = d.person_id ORDER BY d.month, d.day`,
      ).map((r) => ({
        ...dateFromRow(r),
        person_name: r.person_name as string,
      })),

    createDate: (personId, type, label, { month, day, year }) => {
      if (!isValidMonthDay(month, day, year ?? undefined))
        throw new Error(`${day}/${month} is not a date`);
      const info = db
        .prepare(
          `INSERT INTO important_dates (person_id, type, label, month, day, year, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(personId, type, label, month, day, year, nowISO());
      return dateFromRow(readRow(db, "important_dates", info.lastInsertRowid));
    },

    deleteDate: (id) => deleteRow(db, "important_dates", id),

    listFacts: (personId) =>
      rows(
        "SELECT * FROM facts WHERE person_id = ? ORDER BY created_at, id",
        personId,
      ).map(factFromRow),

    createFact: (personId, text) => {
      const info = db
        .prepare(
          "INSERT INTO facts (person_id, text, created_at) VALUES (?, ?, ?)",
        )
        .run(personId, text, nowISO());
      return factFromRow(readRow(db, "facts", info.lastInsertRowid));
    },

    deleteFact: (id) => deleteRow(db, "facts", id),

    listNews: (personId) =>
      rows(
        "SELECT * FROM news WHERE person_id = ? ORDER BY date DESC, id DESC",
        personId,
      ).map(newsFromRow),

    createNews: (personId, text, date) => {
      const info = db
        .prepare(
          "INSERT INTO news (person_id, text, date, created_at) VALUES (?, ?, ?, ?)",
        )
        .run(personId, text, date, nowISO());
      return newsFromRow(readRow(db, "news", info.lastInsertRowid));
    },

    deleteNews: (id) => deleteRow(db, "news", id),
  };
}
