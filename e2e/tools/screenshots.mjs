/**
 * Drives the running app in real Chromium and captures screenshots of every screen
 * in both themes into screenshots/. Usage: node e2e/screenshots.setup.mjs [baseURL]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:8100";
mkdirSync("screenshots", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(e.message));

async function shot(name) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `screenshots/${name}.png` });
  console.log("captured", name);
}

async function openTrip() {
  const chev = page.getByRole("button", { name: "Expand Travel" });
  if (await chev.count()) await chev.click();
  await page.getByRole("treeitem", { name: /Trip Planner/ }).click();
  await page.getByRole("tab", { name: "Table" }).waitFor();
}

for (const theme of ["light", "dark"]) {
  await page.goto(base + "/space/");
  await page.getByRole("treeitem", { name: "🏠 Home" }).waitFor();
  const toggle = page.getByRole("button", { name: theme === "dark" ? "Switch to dark mode" : "Switch to light mode" });
  if (await toggle.count()) await toggle.click();

  // Home page (editor with blocks)
  await page.getByRole("treeitem", { name: "🏠 Home" }).click();
  await shot(`walk-home-${theme}`);

  // Editor showcase page
  const projChev = page.getByRole("button", { name: "Expand Projects" });
  if (await projChev.count()) await projChev.click();
  await page.getByRole("treeitem", { name: /Home Lab Rebuild/ }).click();
  await shot(`walk-editor-${theme}`);

  // Slash menu open
  await page.locator(".block-text").last().click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");
  await page.getByRole("listbox").waitFor();
  await shot(`walk-slashmenu-${theme}`);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");

  // Reading List table
  await page.getByRole("treeitem", { name: /Reading List/ }).click();
  await page.getByRole("columnheader", { name: "Author" }).waitFor();
  await shot(`walk-table-${theme}`);

  // Row page
  await page.getByLabel("Title for row Dune").hover();
  await page.getByRole("button", { name: "Open Dune" }).click();
  await page.locator(".row-breadcrumb").waitFor();
  await shot(`walk-rowpage-${theme}`);

  // Trip Planner board
  await openTrip();
  await page.getByRole("tab", { name: "Board" }).click();
  await page.getByTestId("board").waitFor();
  await shot(`walk-board-${theme}`);

  // List view with its filter
  await page.getByRole("tab", { name: "List" }).click();
  await shot(`walk-list-${theme}`);
  await page.getByRole("tab", { name: "Table" }).click();

  // Filter panel open
  await page.getByRole("button", { name: /Filter/ }).click();
  await shot(`walk-filters-${theme}`);
  await page.keyboard.press("Escape");
  await page.locator(".menu-overlay").click({ position: { x: 5, y: 5 } }).catch(() => {});

  // Search modal
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("dialog", { name: "Quick find" }).waitFor();
  await page.keyboard.type("japan");
  await page.getByRole("option").first().waitFor();
  await shot(`walk-search-${theme}`);
  await page.keyboard.press("Escape");
}

console.log("console errors during walkthrough:", consoleErrors.length === 0 ? "none" : consoleErrors);
await browser.close();
