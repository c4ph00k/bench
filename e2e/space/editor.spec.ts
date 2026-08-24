import { test, expect, login } from "../fixtures";
import { savedBlockTexts } from "../api";
import type { Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await login(page);
});

/** The editor autosaves on a debounce, so specs wait for the write rather than for a duration. */
const blockSaved = (page: Page) =>
  page.waitForResponse(
    (r) =>
      r.url().includes("/api/space/blocks/") &&
      r.request().method() === "PATCH" &&
      r.ok(),
  );

/** Create a fresh page and focus its first (auto-created) empty block. */
async function freshPage(page: Page, title: string) {
  await page.goto("/space/");
  await page.getByRole("button", { name: "New page" }).click();
  const input = page.getByPlaceholder("Untitled");
  await expect(input).toHaveValue("");
  await input.fill(title);
  await page.locator(".block-text").first().click();
}

test("typing into a page autosaves and survives a refresh", async ({
  page,
}) => {
  const title = `Editor Typing ${Date.now()}`;
  await freshPage(page, title);
  const saved = blockSaved(page);
  await page.keyboard.type("Hello, autosaved world");
  await expect(page.locator(".block-text").first()).toHaveText(
    "Hello, autosaved world",
  );
  await saved;

  await page.reload();
  await expect(page.locator(".block-text").first()).toHaveText(
    "Hello, autosaved world",
  );
  await expect(page.getByRole("button", { name: /^Save$/ })).toHaveCount(0);
});

test("Enter creates a block below; Backspace on an empty block removes it", async ({
  page,
}) => {
  await freshPage(page, `Editor Keys ${Date.now()}`);
  await page.keyboard.type("First");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second");
  await expect(page.locator(".block-row")).toHaveCount(2);

  await page.keyboard.press("Enter");
  await expect(page.locator(".block-row")).toHaveCount(3);
  await page.keyboard.press("Backspace");
  await expect(page.locator(".block-row")).toHaveCount(2);
});

test("slash menu inserts a heading using the keyboard alone", async ({
  page,
}) => {
  await freshPage(page, `Slash Keyboard ${Date.now()}`);
  await page.keyboard.type("/head");
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(page.getByRole("option")).toHaveCount(3);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toHaveCount(0);

  const saved = blockSaved(page);
  await page.keyboard.type("Section title");
  await expect(page.locator(".b-h2")).toHaveText("Section title");
  await saved;

  await page.reload();
  await expect(page.locator(".b-h2")).toHaveText("Section title");
});

test("slash menu works with the mouse", async ({ page }) => {
  await freshPage(page, `Slash Mouse ${Date.now()}`);
  await page.keyboard.type("/");
  await expect(page.getByRole("option")).toHaveCount(11);
  await page.getByRole("option", { name: "Quote" }).click();
  await page.keyboard.type("Clicked into being");
  await expect(page.locator(".b-quote-text")).toHaveText("Clicked into being");
});

test("to-do checkboxes toggle and persist", async ({ page }) => {
  await freshPage(page, `Todo Toggle ${Date.now()}`);
  await page.keyboard.type("/to");
  await page.getByRole("option", { name: "To-do" }).click();
  await page.keyboard.type("Ship phase two");
  const checkbox = page.getByRole("checkbox", { name: "Ship phase two" });
  await expect(checkbox).not.toBeChecked();
  const saved = blockSaved(page);
  await checkbox.check();
  await saved;

  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Ship phase two" }),
  ).toBeChecked();
});

test("blocks drag to a new position and the order survives a refresh", async ({
  page,
}) => {
  await freshPage(page, `Drag Order ${Date.now()}`);
  await page.keyboard.type("Alpha");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Beta");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Gamma");
  // Each block saves on its own timer, so wait for all three to be on the server.
  await expect
    .poll(() => savedBlockTexts(page))
    .toEqual(["Alpha", "Beta", "Gamma"]);

  const rowTexts = () =>
    page.locator(".block-row .block-text").allTextContents();
  expect(await rowTexts()).toEqual(["Alpha", "Beta", "Gamma"]);

  const gammaRow = page.locator(".block-row", { hasText: "Gamma" });
  await gammaRow.hover();
  const handle = gammaRow.locator(".drag-handle");
  const from = (await handle.boundingBox())!;
  const target = (await page
    .locator(".block-row", { hasText: "Alpha" })
    .boundingBox())!;

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + 40, target.y + 2, { steps: 12 });
  await page.mouse.up();

  await expect.poll(async () => rowTexts()).toEqual(["Gamma", "Alpha", "Beta"]);

  await page.reload();
  await expect.poll(async () => rowTexts()).toEqual(["Gamma", "Alpha", "Beta"]);
});
