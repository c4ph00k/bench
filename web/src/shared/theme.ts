/**
 * One theme across all four apps. Each is its own document, so the choice travels in
 * localStorage rather than in React state, and every entry point calls initTheme() before it
 * renders - set after the first paint, the page would flash the wrong theme on every navigation.
 */
export type Theme = "light" | "dark";

const KEY = "bench.theme";

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** The stored choice, or the operating system's preference the first time you arrive. */
export function initTheme(): void {
  const stored = localStorage.getItem(KEY);
  const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
  document.documentElement.dataset.theme = stored ?? preferred;
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem(KEY, next);
  return next;
}
