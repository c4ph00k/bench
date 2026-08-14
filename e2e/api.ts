import type { APIResponse, Page } from "@playwright/test";

/**
 * Playwright types a JSON body as `any`, and that spreads through every assertion that reads one.
 * These are the shapes the specs actually depend on, not the whole API surface.
 */
export async function json<T>(response: APIResponse): Promise<T> {
  return (await response.json()) as T;
}

/**
 * The Space editor autosaves each block on its own debounce, so a spec that types several blocks
 * and then reloads has to know every write landed. Reading them back is that signal; waiting for
 * one response only covers the last block, and a fixed wait only guesses at the timer.
 */
export async function savedBlockTexts(page: Page): Promise<string[]> {
  const pageId = new URL(page.url()).pathname.split("/").pop()!;
  const body = await json<{ blocks: { content: { text?: string } }[] }>(
    await page.request.get(`/api/space/pages/${pageId}`),
  );
  return body.blocks.map((b) => b.content.text ?? "");
}

export interface Deal {
  id: number;
  name: string;
  organization_id: number | null;
  contact_id: number | null;
  stage: string;
  value: number;
  probability: number;
  close_date: string | null;
}

export interface Organization {
  id: number;
  name: string;
}

export interface Contact {
  id: number;
  name: string;
  organization_id: number | null;
}

export interface TreeNode {
  id: string;
  title: string;
  type: string;
  children: TreeNode[];
}

interface SpaceOption {
  id: string;
  name: string;
}

interface SpaceProperty {
  id: string;
  name: string;
  options: SpaceOption[];
}

interface SpaceRow {
  id: string;
  title: string;
}

export interface SpaceDatabase {
  id: string;
  properties: SpaceProperty[];
  rows: SpaceRow[];
}
