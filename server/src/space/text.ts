/**
 * Coerce an untrusted JSON value to text. `String()` on an object yields "[object Object]", which
 * would then be stored as a title or a property name, so anything that is not a primitive becomes
 * the empty string instead.
 */
export function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return "";
}
