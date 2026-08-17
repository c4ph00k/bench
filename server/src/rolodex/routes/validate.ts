/**
 * Narrowing helpers for untrusted request bodies. Express hands them over as `any`, and these
 * are what turn that back into something typed - a bad request answers 400 rather than reaching
 * SQLite as a wrong-shaped value.
 */
import type express from "express";

export const notFound = (res: express.Response) =>
  res.status(404).json({ error: "Not found" });

export const badRequest = (res: express.Response, error: string) =>
  res.status(400).json({ error });

/** The JSON body, as a bag of unknowns for the caller to narrow. */
export function body(req: express.Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>;
}

export function isText(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Text that is optional: absent, empty or blank all mean "not set". */
export function optionalText(v: unknown): string | null {
  return isText(v) ? v.trim() : null;
}

export function isISODate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function isOneOf<T extends string>(
  values: readonly T[],
  v: unknown,
): v is T {
  return typeof v === "string" && (values as readonly string[]).includes(v);
}
