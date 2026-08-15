import type { Circle, PersonComputed } from "./types";

export interface SearchFilters {
  query?: string;
  circle?: Circle | "all";
  tag?: string;
}

/** Every word has to appear somewhere in the person, so "ada figma" narrows rather than widens. */
function matchesQuery(p: PersonComputed, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const combined = [
    p.name,
    p.company ?? "",
    p.email ?? "",
    p.city ?? "",
    p.job_title ?? "",
    ...p.tags,
  ]
    .join(" ")
    .toLowerCase();
  return needle.split(/\s+/).every((w) => combined.includes(w));
}

export function filterPeople(
  people: PersonComputed[],
  filters: SearchFilters,
): PersonComputed[] {
  let out = people;
  if (filters.circle && filters.circle !== "all")
    out = out.filter((p) => p.circle === filters.circle);
  if (filters.tag && filters.tag !== "all")
    out = out.filter((p) => p.tags.includes(filters.tag!));
  if (filters.query) out = out.filter((p) => matchesQuery(p, filters.query!));
  return out;
}
