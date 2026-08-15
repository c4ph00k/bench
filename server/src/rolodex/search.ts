import type { Circle, PersonComputed } from "./types.js";

export interface SearchFilters {
  query?: string;
  circle?: Circle | "all";
  tag?: string;
}

function matchesQuery(p: PersonComputed, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const haystacks = [
    p.name,
    p.company ?? "",
    p.email ?? "",
    p.city ?? "",
    p.job_title ?? "",
    ...p.tags,
  ];
  const words = needle.split(/\s+/);
  const combined = haystacks.join(" ").toLowerCase();
  // every word must appear somewhere (so "ada figma" works)
  return words.every((w) => combined.includes(w));
}

export function filterPeople(
  people: PersonComputed[],
  filters: SearchFilters,
): PersonComputed[] {
  let out = people;
  const circle = filters.circle;
  const tag = filters.tag;
  if (circle && circle !== "all") out = out.filter((p) => p.circle === circle);
  if (tag && tag !== "all") out = out.filter((p) => p.tags.includes(tag));
  if (filters.query) out = out.filter((p) => matchesQuery(p, filters.query!));
  return out;
}
