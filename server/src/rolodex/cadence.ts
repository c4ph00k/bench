import type { CheckInStatus, Circle, Person } from "./types.js";
import { addDaysISO, daysBetweenISO, todayISO } from "./dates.js";

export interface CircleMeta {
  key: Circle;
  label: string;
  cadenceDays: number;
  cadenceDescription: string;
  blurb: string;
}

export const CIRCLE_META: Record<Circle, CircleMeta> = {
  inner: {
    key: "inner",
    label: "Inner",
    cadenceDays: 30,
    cadenceDescription: "Monthly",
    blurb: "Your closest people — aim to be in touch every month.",
  },
  close: {
    key: "close",
    label: "Close",
    cadenceDays: 91,
    cadenceDescription: "Quarterly",
    blurb: "Good friends and close family — every three months or so.",
  },
  wider: {
    key: "wider",
    label: "Wider",
    cadenceDays: 182,
    cadenceDescription: "Every six months",
    blurb: "Friends you want to keep — twice a year.",
  },
  distant: {
    key: "distant",
    label: "Distant",
    cadenceDays: 365,
    cadenceDescription: "Yearly",
    blurb: "Acquaintances and old friends — once a year is enough.",
  },
};

const DUE_SOON_WINDOW_DAYS = 7;

export function cadenceDays(
  person: Pick<Person, "circle" | "cadence_override_days" | "checkins_off">,
): number | null {
  if (person.checkins_off) return null;
  if (
    person.cadence_override_days != null &&
    person.cadence_override_days > 0
  ) {
    return person.cadence_override_days;
  }
  return CIRCLE_META[person.circle].cadenceDays;
}

export interface StatusResult {
  status: CheckInStatus;
  nextDue: string | null;
  daysOverdue: number;
}

/**
 * Derives check-in status. Statuses:
 *  - off:      check-ins are disabled for this person
 *  - snoozed:  snoozed until a date that has not yet passed
 *  - overdue:  the check-in due date is in the past
 *  - due_soon: the check-in due date lands within the next week
 *  - in_touch: plenty of time before the next check-in is due
 *
 * Someone with no logged interactions is due from today: the clock starts now, which makes them
 * due_soon on the day and overdue from tomorrow.
 */
export function computeStatus(
  person: Pick<
    Person,
    "circle" | "cadence_override_days" | "checkins_off" | "snoozed_until"
  >,
  lastContacted: string | null,
  today: string = todayISO(),
): StatusResult {
  if (person.checkins_off)
    return { status: "off", nextDue: null, daysOverdue: 0 };

  if (
    person.snoozed_until &&
    daysBetweenISO(today, person.snoozed_until) >= 0
  ) {
    return { status: "snoozed", nextDue: null, daysOverdue: 0 };
  }

  const days = cadenceDays(person);
  if (days == null) return { status: "off", nextDue: null, daysOverdue: 0 };

  const nextDue = lastContacted ? addDaysISO(lastContacted, days) : today;
  const diff = daysBetweenISO(today, nextDue);
  if (diff < 0) return { status: "overdue", nextDue, daysOverdue: -diff };
  if (diff <= DUE_SOON_WINDOW_DAYS)
    return { status: "due_soon", nextDue, daysOverdue: 0 };
  return { status: "in_touch", nextDue, daysOverdue: 0 };
}
