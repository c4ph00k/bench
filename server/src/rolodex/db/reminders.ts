/** Reminders and gifts: the two things attached to a person that have a state of their own. */
import { nowISO } from "../dates.js";
import type { Gift, GiftKind, Reminder } from "../types.js";
import { giftFromRow, reminderFromRow, type Row } from "./rows.js";
import type { Queryable } from "./index.js";

export interface RemindersRepo {
  listReminders(personId: number): Promise<Reminder[]>;
  listOpenReminders(): Promise<(Reminder & { person_name: string })[]>;
  createReminder(
    personId: number,
    text: string,
    dueDate: string,
  ): Promise<Reminder>;
  setReminderDone(id: number, done: boolean): Promise<Reminder | null>;
  deleteReminder(id: number): Promise<boolean>;

  listGifts(personId: number): Promise<Gift[]>;
  createGift(
    personId: number,
    name: string,
    kind: GiftKind,
    occasion: string | null,
    date: string,
  ): Promise<Gift>;
  updateGift(
    id: number,
    patch: Partial<Pick<Gift, "kind" | "occasion" | "date">>,
  ): Promise<Gift | null>;
  deleteGift(id: number): Promise<boolean>;
}

export function remindersRepo(db: Queryable, tenantId: number): RemindersRepo {
  const gift = async (id: number): Promise<Gift | null> => {
    const result = await db.query<Row>(
      "SELECT * FROM gifts WHERE id = $1 AND tenant_id = $2",
      [id, tenantId],
    );
    return result.rows[0] ? giftFromRow(result.rows[0]) : null;
  };

  return {
    listReminders: async (personId) => {
      const result = await db.query<Row>(
        "SELECT * FROM reminders WHERE person_id = $1 AND tenant_id = $2 ORDER BY due_date",
        [personId, tenantId],
      );
      return result.rows.map(reminderFromRow);
    },

    listOpenReminders: async () => {
      const result = await db.query<Row>(
        `SELECT r.*, p.name AS person_name FROM reminders r
         JOIN people p ON p.id = r.person_id WHERE r.done = false AND r.tenant_id = $1 ORDER BY r.due_date`,
        [tenantId],
      );
      return result.rows.map((r) => ({
        ...reminderFromRow(r),
        person_name: r.person_name as string,
      }));
    },

    createReminder: async (personId, text, dueDate) => {
      const result = await db.query<Row>(
        "INSERT INTO reminders (tenant_id, person_id, text, due_date, done, created_at) VALUES ($1, $2, $3, $4, false, $5) RETURNING *",
        [tenantId, personId, text, dueDate, nowISO()],
      );
      return reminderFromRow(result.rows[0]);
    },

    setReminderDone: async (id, done) => {
      const result = await db.query<Row>(
        "UPDATE reminders SET done = $1, done_at = $2 WHERE id = $3 AND tenant_id = $4 RETURNING *",
        [done, done ? nowISO() : null, id, tenantId],
      );
      return result.rows[0] ? reminderFromRow(result.rows[0]) : null;
    },

    deleteReminder: async (id) => {
      const result = await db.query(
        "DELETE FROM reminders WHERE id = $1 AND tenant_id = $2",
        [id, tenantId],
      );
      return (result.rowCount ?? 0) > 0;
    },

    listGifts: async (personId) => {
      const result = await db.query<Row>(
        "SELECT * FROM gifts WHERE person_id = $1 AND tenant_id = $2 ORDER BY date DESC, id DESC",
        [personId, tenantId],
      );
      return result.rows.map(giftFromRow);
    },

    createGift: async (personId, name, kind, occasion, date) => {
      const result = await db.query<Row>(
        "INSERT INTO gifts (tenant_id, person_id, name, kind, occasion, date, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
        [tenantId, personId, name, kind, occasion, date, nowISO()],
      );
      return giftFromRow(result.rows[0]);
    },

    updateGift: async (id, patch) => {
      const current = await gift(id);
      if (!current) return null;
      const merged = { ...current, ...patch };
      await db.query(
        "UPDATE gifts SET kind = $1, occasion = $2, date = $3 WHERE id = $4 AND tenant_id = $5",
        [merged.kind, merged.occasion, merged.date, id, tenantId],
      );
      return gift(id);
    },

    deleteGift: async (id) => {
      const result = await db.query(
        "DELETE FROM gifts WHERE id = $1 AND tenant_id = $2",
        [id, tenantId],
      );
      return (result.rowCount ?? 0) > 0;
    },
  };
}
