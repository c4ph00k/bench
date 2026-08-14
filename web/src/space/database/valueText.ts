/**
 * A property value as display text. Values arrive as `unknown` from the API, and `String()` on an
 * object renders "[object Object]"; a multi-select is a list of ids, so it reads as a list.
 */
export function valueText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) return value.map(valueText).join(", ");
  return "";
}
