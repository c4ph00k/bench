import { describe, it, expect } from "vitest";
import { filterPeople } from "../../src/rolodex/search.js";
import type { PersonComputed } from "../../src/rolodex/types.js";

function person(over: Partial<PersonComputed>): PersonComputed {
  return {
    id: 1,
    name: "Maya Chen",
    email: "maya.chen@example.com",
    phone: "+1 415 555 0132",
    job_title: "Senior Product Designer",
    company: "Figma",
    city: "San Francisco",
    timezone: "America/Los_Angeles",
    circle: "inner",
    cadence_override_days: null,
    checkins_off: false,
    snoozed_until: null,
    how_met: null,
    met_where: null,
    met_on: null,
    notes: null,
    tags: ["family", "design"],
    photo: null,
    created_at: "",
    updated_at: "",
    last_contacted: "2026-01-01",
    next_due: "2026-01-31",
    status: "in_touch",
    latest_news: null,
    ...over,
  };
}

const people = [
  person({
    id: 1,
    name: "Maya Chen",
    company: "Figma",
    email: "maya@example.com",
    city: "San Francisco",
    tags: ["family"],
  }),
  person({
    id: 2,
    name: "Sam Okafor",
    company: "Stripe",
    email: "sam@example.com",
    city: "London",
    tags: ["cycling"],
    circle: "close",
    job_title: "Data Engineer",
  }),
  person({
    id: 3,
    name: "Tom Becker",
    company: "Chorlton High School",
    email: "tom@example.org",
    city: "Manchester",
    tags: ["university"],
    circle: "wider",
    job_title: "History teacher",
  }),
];

describe("search", () => {
  it("finds by name (case-insensitive)", () => {
    expect(filterPeople(people, { query: "maya" })).toHaveLength(1);
    expect(filterPeople(people, { query: "OKAFOR" })).toHaveLength(1);
  });

  it("finds by company", () => {
    expect(filterPeople(people, { query: "stripe" })).toHaveLength(1);
    expect(filterPeople(people, { query: "figma" })[0].id).toBe(1);
  });

  it("finds by email", () => {
    expect(filterPeople(people, { query: "sam@example.com" })).toHaveLength(1);
  });

  it("finds by city and job title", () => {
    expect(filterPeople(people, { query: "manchester" })).toHaveLength(1);
    expect(filterPeople(people, { query: "designer" })).toHaveLength(1);
  });

  it("supports multi-word queries where all words must match", () => {
    expect(filterPeople(people, { query: "maya figma" })).toHaveLength(1);
    expect(filterPeople(people, { query: "maya stripe" })).toHaveLength(0);
  });

  it("filters by circle", () => {
    expect(filterPeople(people, { circle: "inner" })).toHaveLength(1);
    expect(filterPeople(people, { circle: "all" })).toHaveLength(3);
  });

  it("filters by tag", () => {
    expect(filterPeople(people, { tag: "cycling" })).toHaveLength(1);
    expect(filterPeople(people, { tag: "family" })[0].id).toBe(1);
  });

  it("combines query with filters", () => {
    expect(
      filterPeople(people, { query: "sam", circle: "inner" }),
    ).toHaveLength(0);
    expect(
      filterPeople(people, { query: "sam", circle: "close" }),
    ).toHaveLength(1);
  });
});
