import { describe, expect, it } from "vitest";
import { filterPeople } from "./search";
import { person } from "./test/helpers";

const people = [
  person({ id: 1, name: "Maya Chen", company: "Figma", tags: ["cycling"] }),
  person({
    id: 2,
    name: "Ben Foster",
    company: "Foster & Co",
    city: "Bristol",
    circle: "inner",
    tags: ["university"],
    email: "ben@example.com",
  }),
  person({ id: 3, name: "Ada Lovelace", company: null, tags: [] }),
];

const names = (rows: ReturnType<typeof filterPeople>) =>
  rows.map((p) => p.name);

describe("filterPeople", () => {
  it("returns everyone when nothing is asked for", () => {
    expect(filterPeople(people, {})).toHaveLength(3);
    expect(
      filterPeople(people, { query: "", circle: "all", tag: "all" }),
    ).toHaveLength(3);
  });

  it("matches across name, company, city, email and tags", () => {
    expect(names(filterPeople(people, { query: "figma" }))).toEqual([
      "Maya Chen",
    ]);
    expect(names(filterPeople(people, { query: "bristol" }))).toEqual([
      "Ben Foster",
    ]);
    expect(names(filterPeople(people, { query: "ben@example" }))).toEqual([
      "Ben Foster",
    ]);
    expect(names(filterPeople(people, { query: "cycling" }))).toEqual([
      "Maya Chen",
    ]);
  });

  it("needs every word to match somewhere, so more words narrow", () => {
    expect(names(filterPeople(people, { query: "maya figma" }))).toEqual([
      "Maya Chen",
    ]);
    expect(filterPeople(people, { query: "maya bristol" })).toHaveLength(0);
  });

  it("filters by circle and by tag", () => {
    expect(names(filterPeople(people, { circle: "inner" }))).toEqual([
      "Ben Foster",
    ]);
    expect(names(filterPeople(people, { tag: "university" }))).toEqual([
      "Ben Foster",
    ]);
  });
});
