import type { ImportantDate } from "./types.js";
import { daysBetweenISO, todayISO, toISO } from "./dates.js";

export interface Occurrence {
  date: string;
  years: number | null;
  ageTurning: number | null;
  milestone: boolean;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function isValidMonthDay(
  month: number,
  day: number,
  year?: number,
): boolean {
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(day) || day < 1) return false;
  const y = year ?? (isLeapReference(month, day) ? 2024 : 2023);
  return day <= daysInMonth(y, month);
}

function isLeapReference(month: number, day: number): boolean {
  return month === 2 && day === 29;
}

/**
 * The day an annual date is celebrated in a given year. A 29 February birthday
 * is celebrated on 28 February in non-leap years — sensible and predictable.
 */
export function effectiveDay(month: number, day: number, year: number): number {
  if (month === 2 && day === 29 && !isLeapYear(year)) return 28;
  return day;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function occurrenceYear(d: ImportantDate, year: number): number | null {
  return d.year != null ? year - d.year : null;
}

/**
 * The next occurrence of an annual date on or after `fromISO` (today by default).
 * Looks in the current calendar year first; if that occurrence has passed, it
 * rolls over to the next calendar year.
 */
export function nextOccurrence(
  d: Pick<ImportantDate, "month" | "day" | "year">,
  fromISO: string = todayISO(),
): Occurrence {
  const fromDate = new Date(fromISO + "T00:00:00");
  const currentYear = fromDate.getFullYear();

  for (const year of [currentYear, currentYear + 1]) {
    const day = effectiveDay(d.month, d.day, year);
    const date = toISO(new Date(year, d.month - 1, day));
    if (daysBetweenISO(fromISO, date) >= 0) {
      const ageTurning = occurrenceYear(d as ImportantDate, year);
      return {
        date,
        years: d.year != null ? year - d.year : null,
        ageTurning,
        milestone:
          ageTurning != null && ageTurning > 0 && ageTurning % 10 === 0,
      };
    }
  }
  // Unreachable: nextOccurrence only looks forward
  throw new Error("Could not compute next occurrence");
}

export interface UpcomingDate extends Pick<
  ImportantDate,
  "id" | "person_id" | "type" | "label" | "month" | "day" | "year"
> {
  person_name: string;
  date: string;
  days_away: number;
  age_turning: number | null;
  milestone: boolean;
}

export function upcomingDates(
  dates: (ImportantDate & { person_name: string })[],
  withinDays: number,
  today: string = todayISO(),
): UpcomingDate[] {
  const result: UpcomingDate[] = [];
  for (const d of dates) {
    const occ = nextOccurrence(d, today);
    if (daysBetweenISO(today, occ.date) <= withinDays) {
      result.push({
        id: d.id,
        person_id: d.person_id,
        person_name: d.person_name,
        type: d.type,
        label: d.label,
        month: d.month,
        day: d.day,
        year: d.year,
        date: occ.date,
        days_away: daysBetweenISO(today, occ.date),
        age_turning: occ.ageTurning,
        milestone: occ.milestone,
      });
    }
  }
  return result.sort((a, b) => a.days_away - b.days_away);
}

/** All occurrences of annual dates that land inside a given calendar month. */
export function datesInMonth(
  dates: (ImportantDate & { person_name: string })[],
  year: number,
  month: number, // 1-12
): UpcomingDate[] {
  const result: UpcomingDate[] = [];
  for (const d of dates) {
    if (d.month !== month) continue;
    const day = effectiveDay(d.month, d.day, year);
    const date = toISO(new Date(year, month - 1, day));
    const years = d.year != null ? year - d.year : null;
    result.push({
      id: d.id,
      person_id: d.person_id,
      person_name: d.person_name,
      type: d.type,
      label: d.label,
      month: d.month,
      day: d.day,
      year: d.year,
      date,
      days_away: daysBetweenISO(todayISO(), date),
      age_turning: years,
      milestone: years != null && years > 0 && years % 10 === 0,
    });
  }
  return result.sort((a, b) => a.day - b.day);
}

/** Current age as of today, for annual dates with a known year. */
export function currentAge(
  d: Pick<ImportantDate, "month" | "day" | "year">,
  today: string = todayISO(),
): number | null {
  if (d.year == null) return null;
  const t = new Date(today + "T00:00:00");
  const year = t.getFullYear();
  const day = effectiveDay(d.month, d.day, year);
  const occurredThisYear = new Date(year, d.month - 1, day) <= t;
  const lastOccurrenceYear = occurredThisYear ? year : year - 1;
  return lastOccurrenceYear - d.year;
}
