/** Turning Postgres rows into domain objects. Booleans are real booleans now. */
import type {
  Connection,
  ConnectionKind,
  Fact,
  Gift,
  GiftKind,
  ImportantDate,
  ImportantDateType,
  Interaction,
  InteractionType,
  NewsItem,
  Person,
  Reminder,
} from "../types.js";

export type Row = Record<string, unknown>;

export function personFromRow(r: Row): Person {
  return {
    id: r.id as number,
    name: r.name as string,
    email: r.email as string | null,
    phone: r.phone as string | null,
    job_title: r.job_title as string | null,
    company: r.company as string | null,
    city: r.city as string | null,
    timezone: r.timezone as string | null,
    circle: r.circle as Person["circle"],
    cadence_override_days: r.cadence_override_days as number | null,
    checkins_off: r.checkins_off as boolean,
    snoozed_until: r.snoozed_until as string | null,
    how_met: r.how_met as string | null,
    met_where: r.met_where as string | null,
    met_on: r.met_on as string | null,
    notes: r.notes as string | null,
    tags: JSON.parse(r.tags as string) as string[],
    photo: r.photo as string | null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

export function interactionFromRow(r: Row): Interaction {
  return {
    id: r.id as number,
    person_id: r.person_id as number,
    type: r.type as InteractionType,
    date: r.date as string,
    notes: r.notes as string | null,
    created_at: r.created_at as string,
  };
}

export function dateFromRow(r: Row): ImportantDate {
  return {
    id: r.id as number,
    person_id: r.person_id as number,
    type: r.type as ImportantDateType,
    label: r.label as string | null,
    month: r.month as number,
    day: r.day as number,
    year: r.year as number | null,
    created_at: r.created_at as string,
  };
}

export function factFromRow(r: Row): Fact {
  return {
    id: r.id as number,
    person_id: r.person_id as number,
    text: r.text as string,
    created_at: r.created_at as string,
  };
}

export function newsFromRow(r: Row): NewsItem {
  return {
    id: r.id as number,
    person_id: r.person_id as number,
    text: r.text as string,
    date: r.date as string,
    created_at: r.created_at as string,
  };
}

export function reminderFromRow(r: Row): Reminder {
  return {
    id: r.id as number,
    person_id: r.person_id as number,
    text: r.text as string,
    due_date: r.due_date as string,
    done: r.done as boolean,
    done_at: r.done_at as string | null,
    created_at: r.created_at as string,
  };
}

export function giftFromRow(r: Row): Gift {
  return {
    id: r.id as number,
    person_id: r.person_id as number,
    name: r.name as string,
    kind: r.kind as GiftKind,
    occasion: r.occasion as string | null,
    date: r.date as string,
    created_at: r.created_at as string,
  };
}

export function connectionFromRow(r: Row): Connection {
  return {
    id: r.id as number,
    person_a: r.person_a as number,
    person_b: r.person_b as number,
    kind: r.kind as ConnectionKind,
    a_is_parent: r.a_is_parent as boolean,
    label: r.label as string | null,
    inverse_label: r.inverse_label as string | null,
    note: r.note as string | null,
    created_at: r.created_at as string,
  };
}
