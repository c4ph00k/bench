import type { PropertyOption } from "../api";

/** The palette select options cycle through, in the order new ones are handed out. */
export const OPTION_COLORS = [
  "gray",
  "amber",
  "blue",
  "purple",
  "green",
  "red",
  "pink",
  "teal",
  "orange",
  "brown",
] as const;

export function nextColor(existing: PropertyOption[]): string {
  return OPTION_COLORS[existing.length % OPTION_COLORS.length];
}
