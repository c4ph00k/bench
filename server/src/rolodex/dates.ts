import {
  addDays,
  differenceInCalendarDays,
  format,
  parse,
  startOfDay,
} from "date-fns";

const ISO_FORMAT = "yyyy-MM-dd";

export function todayISO(): string {
  return format(startOfDay(new Date()), ISO_FORMAT);
}

function parseISODate(iso: string): Date {
  const d = parse(iso, ISO_FORMAT, startOfDay(new Date()));
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ISO date: ${iso}`);
  return d;
}

export function toISO(d: Date): string {
  return format(startOfDay(d), ISO_FORMAT);
}

export function addDaysISO(iso: string, days: number): string {
  return toISO(addDays(parseISODate(iso), days));
}

export function daysBetweenISO(fromISO: string, toISOStr: string): number {
  return differenceInCalendarDays(
    parseISODate(toISOStr),
    parseISODate(fromISO),
  );
}

export function nowISO(): string {
  return new Date().toISOString();
}
