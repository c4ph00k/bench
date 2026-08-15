/** Reminders and gifts: the two things attached to a person that have a state of their own. */
import { nowISO } from "../dates.js";
import type { Gift, GiftKind, Reminder } from "../types.js";
import {
  deleteRow,
  giftFromRow,
  readRow,
  reminderFromRow,
  type DB,
  type Row,
} from "./rows.js";

export interface RemindersRepo {
  listReminders(personId: number): Reminder[];
  listOpenReminders(): (Reminder & { person_name: string })[];
  createReminder(personId: number, text: string, dueDate: string): Reminder;
  setReminderDone(id: number, done: boolean): Reminder | null;
  deleteReminder(id: number): boolean;

  listGifts(personId: number): Gift[];
  createGift(
    personId: number,
    name: string,
    kind: GiftKind,
    occasion: string | null,
    date: string,
  ): Gift;
  updateGift(
    id: number,
    patch: Partial<Pick<Gift, "kind" | "occasion" | "date">>,
  ): Gift | null;
  deleteGift(id: number): boolean;
}

export function remindersRepo(db: DB): RemindersRepo {
  const gift = (id: number): Gift | null => {
    const row = db.prepare("SELECT * FROM gifts WHERE id = ?").get(id) as
      Row | undefined;
    return row ? giftFromRow(row) : null;
  };

  return {
    listReminders: (personId) =>
      (
        db
          .prepare(
            "SELECT * FROM reminders WHERE person_id = ? ORDER BY due_date",
          )
          .all(personId) as Row[]
      ).map(reminderFromRow),

    listOpenReminders: () =>
      (
        db
          .prepare(
            `SELECT r.*, p.name AS person_name FROM reminders r
             JOIN people p ON p.id = r.person_id WHERE r.done = 0 ORDER BY r.due_date`,
          )
          .all() as Row[]
      ).map((r) => ({
        ...reminderFromRow(r),
        person_name: r.person_name as string,
      })),

    createReminder: (personId, text, dueDate) => {
      const info = db
        .prepare(
          "INSERT INTO reminders (person_id, text, due_date, done, created_at) VALUES (?, ?, ?, 0, ?)",
        )
        .run(personId, text, dueDate, nowISO());
      return reminderFromRow(readRow(db, "reminders", info.lastInsertRowid));
    },

    setReminderDone: (id, done) => {
      const info = db
        .prepare("UPDATE reminders SET done = ?, done_at = ? WHERE id = ?")
        .run(done ? 1 : 0, done ? nowISO() : null, id);
      if (info.changes === 0) return null;
      return reminderFromRow(readRow(db, "reminders", id));
    },

    deleteReminder: (id) => deleteRow(db, "reminders", id),

    listGifts: (personId) =>
      (
        db
          .prepare(
            "SELECT * FROM gifts WHERE person_id = ? ORDER BY date DESC, id DESC",
          )
          .all(personId) as Row[]
      ).map(giftFromRow),

    createGift: (personId, name, kind, occasion, date) => {
      const info = db
        .prepare(
          "INSERT INTO gifts (person_id, name, kind, occasion, date, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(personId, name, kind, occasion, date, nowISO());
      return giftFromRow(readRow(db, "gifts", info.lastInsertRowid));
    },

    updateGift: (id, patch) => {
      const current = gift(id);
      if (!current) return null;
      const merged = { ...current, ...patch };
      db.prepare(
        "UPDATE gifts SET kind = ?, occasion = ?, date = ? WHERE id = ?",
      ).run(merged.kind, merged.occasion, merged.date, id);
      return giftFromRow(readRow(db, "gifts", id));
    },

    deleteGift: (id) => deleteRow(db, "gifts", id),
  };
}
