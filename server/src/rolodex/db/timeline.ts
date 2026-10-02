/** One feed across everything logged, newest first, optionally narrowed to a person or a kind. */
import type { InteractionType, TimelineEntry } from "../types.js";
import type { Row } from "./rows.js";
import type { Queryable } from "./index.js";

export interface TimelineRepo {
  /** `kind` is "news", "reminder_done", "interaction", or "interaction_<type>" for one sort. */
  timeline(
    personId: number | null,
    kind: string | null,
  ): Promise<TimelineEntry[]>;
}

const wants = (kind: string | null, of: string) => kind == null || kind === of;

export function timelineRepo(db: Queryable, tenantId: number): TimelineRepo {
  const query = async (
    sql: string,
    params: (string | number)[],
  ): Promise<Row[]> => {
    const result = await db.query<Row>(sql, [tenantId, ...params]);
    return result.rows;
  };

  const interactions = async (
    personId: number | null,
    kind: string | null,
  ): Promise<TimelineEntry[]> => {
    const sub = kind?.startsWith("interaction_")
      ? kind.slice("interaction_".length)
      : null;
    const params: (string | number)[] = [];
    let personClause = "";
    if (personId != null) {
      params.push(personId);
      personClause = "AND i.person_id = $2";
    }
    const rows = await query(
      `SELECT i.*, p.name AS person_name FROM interactions i
       JOIN people p ON p.id = i.person_id WHERE i.tenant_id = $1 ${personClause}`,
      params,
    );
    return rows
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

  const news = async (personId: number | null): Promise<TimelineEntry[]> => {
    const params: (string | number)[] = [];
    let personClause = "";
    if (personId != null) {
      params.push(personId);
      personClause = "AND n.person_id = $2";
    }
    const rows = await query(
      `SELECT n.*, p.name AS person_name FROM news n
       JOIN people p ON p.id = n.person_id WHERE n.tenant_id = $1 ${personClause}`,
      params,
    );
    return rows.map((r): TimelineEntry => ({
      id: `news-${r.id as number}`,
      person_id: r.person_id as number,
      person_name: r.person_name as string,
      kind: "news",
      interaction_type: null,
      date: r.date as string,
      text: r.text as string,
    }));
  };

  const remindersDone = async (
    personId: number | null,
  ): Promise<TimelineEntry[]> => {
    const params: (string | number)[] = [];
    let personClause = "";
    if (personId != null) {
      params.push(personId);
      personClause = "AND r.person_id = $2";
    }
    const rows = await query(
      `SELECT r.*, p.name AS person_name FROM reminders r
       JOIN people p ON p.id = r.person_id WHERE r.tenant_id = $1 AND r.done = true ${personClause}`,
      params,
    );
    return rows.map((r): TimelineEntry => ({
      id: `reminder-${r.id as number}`,
      person_id: r.person_id as number,
      person_name: r.person_name as string,
      kind: "reminder_done",
      interaction_type: null,
      date:
        (r.done_at as string | null)?.slice(0, 10) ?? (r.due_date as string),
      text: r.text as string,
    }));
  };

  return {
    timeline: async (personId, kind) => {
      const entries = [
        ...(wants(kind, "interaction") || kind?.startsWith("interaction_")
          ? await interactions(personId, kind)
          : []),
        ...(wants(kind, "news") ? await news(personId) : []),
        ...(wants(kind, "reminder_done") ? await remindersDone(personId) : []),
      ];
      return entries.sort((a, b) => b.date.localeCompare(a.date));
    },
  };
}
