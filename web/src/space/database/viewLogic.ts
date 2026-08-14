import type { DbRow, Filter, Property, PropertyOption, PropertyType } from "../api";

export const TITLE_ID = "__title";

export interface OperatorDef {
  op: string;
  label: string;
  needsValue: boolean;
}

/** Operators offered per property type. */
export function operatorsFor(type: PropertyType | "title"): OperatorDef[] {
  switch (type) {
    case "title":
    case "text":
    case "url":
      return [
        { op: "contains", label: "contains", needsValue: true },
        { op: "not_contains", label: "does not contain", needsValue: true },
      ];
    case "number":
      return [
        { op: "eq", label: "=", needsValue: true },
        { op: "gt", label: ">", needsValue: true },
        { op: "lt", label: "<", needsValue: true },
      ];
    case "select":
      return [
        { op: "is", label: "is", needsValue: true },
        { op: "is_not", label: "is not", needsValue: true },
      ];
    case "multi_select":
      return [{ op: "has", label: "contains", needsValue: true }];
    case "date":
      return [
        { op: "before", label: "is before", needsValue: true },
        { op: "after", label: "is after", needsValue: true },
      ];
    case "checkbox":
      return [
        { op: "checked", label: "is checked", needsValue: false },
        { op: "unchecked", label: "is unchecked", needsValue: false },
      ];
  }
}

function rowValue(row: DbRow, propertyId: string): unknown {
  return propertyId === TITLE_ID ? row.title : row.values[propertyId];
}

export function matchesFilter(row: DbRow, filter: Filter, properties: Property[]): boolean {
  if (filter.propertyId !== TITLE_ID && !properties.some((p) => p.id === filter.propertyId)) {
    return true; // the filtered property was deleted; ignore the filter rather than hide everything
  }
  const value = rowValue(row, filter.propertyId);
  const fv = filter.value;
  switch (filter.operator) {
    case "contains":
      return typeof fv === "string" && String(value ?? "").toLowerCase().includes(fv.toLowerCase());
    case "not_contains":
      return typeof fv === "string" && !String(value ?? "").toLowerCase().includes(fv.toLowerCase());
    case "eq":
      return typeof value === "number" && value === Number(fv);
    case "gt":
      return typeof value === "number" && value > Number(fv);
    case "lt":
      return typeof value === "number" && value < Number(fv);
    case "is":
      return value === fv;
    case "is_not":
      return value !== fv;
    case "has":
      return Array.isArray(value) && value.includes(fv as string);
    case "before":
      return typeof value === "string" && value !== "" && typeof fv === "string" && value < fv;
    case "after":
      return typeof value === "string" && value !== "" && typeof fv === "string" && value > fv;
    case "checked":
      return Boolean(value);
    case "unchecked":
      return !value;
    default:
      return true;
  }
}

export function applyFilters(rows: DbRow[], filters: Filter[], properties: Property[]): DbRow[] {
  if (!filters || filters.length === 0) return rows;
  return rows.filter((row) => filters.every((f) => matchesFilter(row, f, properties)));
}

function sortKey(row: DbRow, propertyId: string, properties: Property[]): string | number {
  const value = rowValue(row, propertyId);
  const prop = properties.find((p) => p.id === propertyId);
  if (value == null) return prop?.type === "number" ? Number.NEGATIVE_INFINITY : "";
  switch (prop?.type) {
    case "number":
      return typeof value === "number" ? value : Number.NEGATIVE_INFINITY;
    case "checkbox":
      return value ? 1 : 0;
    case "select": {
      const opt = prop.options.find((o) => o.id === value);
      return (opt?.name ?? "").toLowerCase();
    }
    case "multi_select": {
      if (!Array.isArray(value)) return "";
      const names = value
        .map((id) => prop.options.find((o) => o.id === id)?.name ?? "")
        .filter(Boolean)
        .map((n) => n.toLowerCase());
      return names.sort().join(",");
    }
    default:
      return String(value).toLowerCase();
  }
}

export function applySort(
  rows: DbRow[],
  sort: { propertyId: string; direction: "asc" | "desc" } | null,
  properties: Property[],
): DbRow[] {
  if (!sort) return rows;
  const dir = sort.direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const ka = sortKey(a, sort.propertyId, properties);
    const kb = sortKey(b, sort.propertyId, properties);
    if (ka < kb) return -dir;
    if (ka > kb) return dir;
    return 0;
  });
}

export interface BoardColumn {
  option: PropertyOption | null;
  rows: DbRow[];
}

/** One column per option of the grouping select property, plus a "none" column. */
export function groupRows(rows: DbRow[], groupProperty: Property): BoardColumn[] {
  const columns: BoardColumn[] = [{ option: null, rows: [] }];
  for (const option of groupProperty.options) columns.push({ option, rows: [] });
  for (const row of rows) {
    const value = row.values[groupProperty.id];
    const column = columns.find((c) => c.option?.id === value) ?? columns[0];
    column.rows.push(row);
  }
  return columns;
}
