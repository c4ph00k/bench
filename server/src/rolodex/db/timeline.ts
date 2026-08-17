/** One feed across everything logged, newest first, optionally narrowed to a person or a kind. */
import type { InteractionType, TimelineEntry } from "../types.js";
import type { DB, Row } from "./rows.js";

export interface TimelineRepo {
  /** `kind` is "news", "reminder_done", "interaction", or "interaction_<type>" for one sort. */
  timeline(personId: number | null, kind: string | null): TimelineEntry[];
}

const wants = (kind: string | null, of: string) => kind == null || kind === of;

export function timelineRepo(db: DB): TimelineRepo {
  /** Every query here filters on the same optional person, on a different table alias. */
  const query = (sql: string, alias: string, personId: number | null) =>
    db
      .prepare(personId == null ? sql : `${sql} AND ${alias}.person_id = ?`)
      .all(...(personId == null ? [] : [personId])) as Row[];

  const interactions = (personId: number | null, kind: string | null) => {
    const sub = kind?.startsWith("interaction_")
      ? kind.slice("interaction_".length)
      : null;
    return query(
      `SELECT i.*, p.name AS person_name FROM interactions i
       JOIN people p ON p.id = i.person_id WHERE 1 = 1`,
      "i",
      personId,
    )
      .filter((r) => !sub || r.type === sub)
      .map((r): TimelineEntry => ({
        id: `interaction-${r.id as number}`,
        person_id: r.person_id as number,
        person_name: r.person_name as string,
        kind: "interaction",
        interaction_type: r.type as InteractionType,
        date: r.date as string,
        text: (r.notes as string | null) ?? "",
      }));
  };

  const news = (personId: number | null) =>
    query(
      `SELECT n.*, p.name AS person_name FROM news n
       JOIN people p ON p.id = n.person_id WHERE 1 = 1`,
      "n",
      personId,
    ).map((r): TimelineEntry => ({
      id: `news-${r.id as number}`,
      person_id: r.person_id as number,
      person_name: r.person_name as string,
      kind: "news",
      interaction_type: null,
      date: r.date as string,
      text: r.text as string,
    }));

  const remindersDone = (personId: number | null) =>
    query(
      `SELECT r.*, p.name AS person_name FROM reminders r
       JOIN people p ON p.id = r.person_id WHERE r.done = 1`,
      "r",
      personId,
    ).map((r): TimelineEntry => ({
      id: `reminder-${r.id as number}`,
      person_id: r.person_id as number,
      person_name: r.person_name as string,
      kind: "reminder_done",
      interaction_type: null,
      date:
        (r.done_at as string | null)?.slice(0, 10) ?? (r.due_date as string),
      text: r.text as string,
    }));

  return {
    timeline: (personId, kind) => {
      const entries = [
        ...(wants(kind, "interaction") || kind?.startsWith("interaction_")
          ? interactions(personId, kind)
          : []),
        ...(wants(kind, "news") ? news(personId) : []),
        ...(wants(kind, "reminder_done") ? remindersDone(personId) : []),
      ];
      return entries.sort((a, b) => b.date.localeCompare(a.date));
    },
  };
}
