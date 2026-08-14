import { describe, expect, it } from "vitest";
import {
  applyFilters,
  applySort,
  groupRows,
  matchesFilter,
  operatorsFor,
  TITLE_ID,
} from "./viewLogic";
import type { DbRow, Property } from "../api";

const props: Property[] = [
  { id: "author", name: "Author", type: "text", position: 0, options: [] },
  {
    id: "status",
    name: "Status",
    type: "select",
    position: 1,
    options: [
      { id: "toread", name: "To read", color: "amber", position: 0 },
      { id: "reading", name: "Reading", color: "blue", position: 1 },
    ],
  },
  {
    id: "genre",
    name: "Genre",
    type: "multi_select",
    position: 2,
    options: [
      { id: "scifi", name: "Sci-fi", color: "purple", position: 0 },
      { id: "classic", name: "Classic", color: "brown", position: 1 },
    ],
  },
  { id: "rating", name: "Rating", type: "number", position: 3, options: [] },
  { id: "done", name: "Done on", type: "date", position: 4, options: [] },
  { id: "owned", name: "Owned", type: "checkbox", position: 5, options: [] },
];

const row = (id: string, title: string, values: DbRow["values"]): DbRow => ({
  id,
  title,
  icon: null,
  position: 0,
  values,
});

const rows: DbRow[] = [
  row("r1", "Dune", {
    author: "Herbert",
    status: "reading",
    genre: ["scifi", "classic"],
    rating: 4.5,
    done: "2026-03-02",
    owned: true,
  }),
  row("r2", "Emma", {
    author: "Austen",
    status: "toread",
    genre: ["classic"],
    rating: 3,
    done: "2026-05-01",
    owned: false,
  }),
  row("r3", "Blindsight", {
    author: "Watts",
    genre: ["scifi"],
    rating: 5,
    owned: true,
  }),
];

describe("filters", () => {
  it("text contains and does not contain, case-insensitively", () => {
    expect(
      applyFilters(
        rows,
        [{ propertyId: "author", operator: "contains", value: "herb" }],
        props,
      ).map((r) => r.id),
    ).toEqual(["r1"]);
    expect(
      applyFilters(
        rows,
        [{ propertyId: "author", operator: "not_contains", value: "a" }],
        props,
      ).map((r) => r.id),
    ).toEqual(["r1"]);
  });

  it("filters on the title pseudo-property", () => {
    expect(
      applyFilters(
        rows,
        [{ propertyId: TITLE_ID, operator: "contains", value: "em" }],
        props,
      ).map((r) => r.id),
    ).toEqual(["r2"]);
  });

  it("select is / is not", () => {
    expect(
      applyFilters(
        rows,
        [{ propertyId: "status", operator: "is", value: "reading" }],
        props,
      ).map((r) => r.id),
    ).toEqual(["r1"]);
    expect(
      applyFilters(
        rows,
        [{ propertyId: "status", operator: "is_not", value: "reading" }],
        props,
      ).map((r) => r.id),
    ).toEqual(["r2", "r3"]);
  });

  it("multi-select contains", () => {
    expect(
      applyFilters(
        rows,
        [{ propertyId: "genre", operator: "has", value: "scifi" }],
        props,
      ).map((r) => r.id),
    ).toEqual(["r1", "r3"]);
  });

  it("checkbox checked state", () => {
    expect(
      applyFilters(
        rows,
        [{ propertyId: "owned", operator: "checked" }],
        props,
      ).map((r) => r.id),
    ).toEqual(["r1", "r3"]);
    expect(
      applyFilters(
        rows,
        [{ propertyId: "owned", operator: "unchecked" }],
        props,
      ).map((r) => r.id),
    ).toEqual(["r2"]);
  });

  it("date before / after, ignoring empty dates", () => {
    expect(
      applyFilters(
        rows,
        [{ propertyId: "done", operator: "before", value: "2026-04-01" }],
        props,
      ).map((r) => r.id),
    ).toEqual(["r1"]);
    expect(
      applyFilters(
        rows,
        [{ propertyId: "done", operator: "after", value: "2026-04-01" }],
        props,
      ).map((r) => r.id),
    ).toEqual(["r2"]);
  });

  it("number comparisons", () => {
    expect(
      applyFilters(
        rows,
        [{ propertyId: "rating", operator: "gt", value: 4 }],
        props,
      ).map((r) => r.id),
    ).toEqual(["r1", "r3"]);
    expect(
      applyFilters(
        rows,
        [{ propertyId: "rating", operator: "lt", value: 4 }],
        props,
      ).map((r) => r.id),
    ).toEqual(["r2"]);
    expect(
      applyFilters(
        rows,
        [{ propertyId: "rating", operator: "eq", value: 5 }],
        props,
      ).map((r) => r.id),
    ).toEqual(["r3"]);
  });

  it("combines multiple filters with AND", () => {
    const result = applyFilters(
      rows,
      [
        { propertyId: "genre", operator: "has", value: "scifi" },
        { propertyId: "owned", operator: "checked" },
        { propertyId: "rating", operator: "gt", value: 4.6 },
      ],
      props,
    );
    expect(result.map((r) => r.id)).toEqual(["r3"]);
  });

  it("unknown operator matches everything", () => {
    expect(
      matchesFilter(
        rows[0],
        { propertyId: "author", operator: "mystery" },
        props,
      ),
    ).toBe(true);
  });
});

describe("sort", () => {
  it("sorts text ascending and descending", () => {
    expect(
      applySort(rows, { propertyId: "author", direction: "asc" }, props).map(
        (r) => r.id,
      ),
    ).toEqual(["r2", "r1", "r3"]);
    expect(
      applySort(rows, { propertyId: "author", direction: "desc" }, props).map(
        (r) => r.id,
      ),
    ).toEqual(["r3", "r1", "r2"]);
  });

  it("sorts numbers with blanks last-ish and dates as strings", () => {
    expect(
      applySort(rows, { propertyId: "rating", direction: "desc" }, props).map(
        (r) => r.id,
      ),
    ).toEqual(["r3", "r1", "r2"]);
    expect(
      applySort(rows, { propertyId: "done", direction: "asc" }, props).map(
        (r) => r.id,
      ),
    ).toEqual(["r3", "r1", "r2"]);
  });

  it("sorts selects by option name and checkboxes by state", () => {
    expect(
      applySort(rows, { propertyId: "status", direction: "asc" }, props).map(
        (r) => r.id,
      ),
    ).toEqual(["r3", "r1", "r2"]);
    expect(
      applySort(rows, { propertyId: "owned", direction: "desc" }, props).map(
        (r) => r.id,
      ),
    ).toEqual(["r1", "r3", "r2"]);
  });

  it("sorts by title and returns the input when sort is null", () => {
    expect(
      applySort(rows, { propertyId: TITLE_ID, direction: "asc" }, props).map(
        (r) => r.id,
      ),
    ).toEqual(["r3", "r1", "r2"]);
    expect(applySort(rows, null, props)).toBe(rows);
  });
});

describe("groupRows", () => {
  it("builds one column per option plus a none column", () => {
    const statusProp = props.find((p) => p.id === "status")!;
    const columns = groupRows(rows, statusProp);
    expect(columns.map((c) => c.option?.name ?? "none")).toEqual([
      "none",
      "To read",
      "Reading",
    ]);
    expect(columns[0].rows.map((r) => r.id)).toEqual(["r3"]);
    expect(columns[1].rows.map((r) => r.id)).toEqual(["r2"]);
    expect(columns[2].rows.map((r) => r.id)).toEqual(["r1"]);
  });
});

describe("operatorsFor", () => {
  it("gives every type a sensible operator set", () => {
    expect(operatorsFor("text").map((o) => o.op)).toContain("contains");
    expect(operatorsFor("select").map((o) => o.op)).toEqual(["is", "is_not"]);
    expect(operatorsFor("checkbox").every((o) => !o.needsValue)).toBe(true);
    expect(operatorsFor("date").map((o) => o.op)).toEqual(["before", "after"]);
    expect(operatorsFor("number").map((o) => o.op)).toEqual(["eq", "gt", "lt"]);
    expect(operatorsFor("multi_select").map((o) => o.op)).toEqual(["has"]);
    expect(operatorsFor("url").map((o) => o.op)).toContain("contains");
    expect(operatorsFor("title").map((o) => o.op)).toContain("contains");
  });
});
