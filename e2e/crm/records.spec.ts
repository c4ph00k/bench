/** Organizations, contacts and deals: the CRUD journeys, search and filtering. */
import { test, expect } from "../fixtures";
import type { Page } from "@playwright/test";

async function openSection(page: Page, name: string) {
  await page.goto("/crm/");
  await page.getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

test("the dashboard summarises seeded data", async ({ page }) => {
  await page.goto("/crm/");
  await expect(
    page.getByRole("heading", { name: "Dashboard", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Open deals")).toBeVisible();
  for (const chart of [
    "Revenue and deal volume",
    "Revenue funnel",
    "Win rate",
    "Top organizations",
  ]) {
    await expect(page.getByRole("heading", { name: chart })).toBeVisible();
  }
  await expect(
    page.getByRole("heading", { name: "Recent activity" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible();
  // Follow-ups are seeded, and each is a checkbox you can tick off.
  await expect(page.getByRole("checkbox").first()).toBeVisible();
});

test("create an organization, see it listed, then delete it", async ({
  page,
}) => {
  await openSection(page, "Organizations");
  const before = await page.locator("tbody tr").count();

  await page.getByRole("button", { name: "Add organization" }).click();
  const dialog = page.getByRole("dialog", { name: "Add organization" });
  await dialog.getByLabel("Name").fill("Test Industries Ltd");
  await dialog.getByLabel("Website").fill("testind.example");
  await dialog.getByLabel("Industry").fill("Manufacturing");
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(
    page.getByRole("row", { name: /Test Industries Ltd/ }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(before + 1);

  await page.getByRole("row", { name: /Test Industries Ltd/ }).click();
  await expect(
    page.getByRole("heading", { name: "Test Industries Ltd", level: 1 }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toMatch(/^\/crm\/organizations\/\d+$/);

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page).toHaveURL(/\/crm\/organizations$/);
  await expect(
    page.getByRole("row", { name: /Test Industries Ltd/ }),
  ).toHaveCount(0);
});

test("cancelling a delete keeps the record", async ({ page }) => {
  await openSection(page, "Organizations");
  const row = page.locator("tbody tr").first();
  const name = (await row.locator("td").first().textContent())!.trim();

  await row.click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel" })
    .click();

  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await openSection(page, "Organizations");
  await expect(
    page.getByRole("row", {
      name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    }),
  ).toBeVisible();
});

test("editing an organization persists across a reload", async ({ page }) => {
  await openSection(page, "Organizations");
  await page.locator("tbody tr").first().click();
  // Wait for the detail page: until it loads, the list's per-row "Edit <name>" buttons all match
  // this substring and the click is ambiguous.
  await expect(page).toHaveURL(/\/crm\/organizations\/\d+/);
  await page.getByRole("button", { name: "Edit", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Industry").fill("Rewritten Industry");
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Rewritten Industry").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Rewritten Industry").first()).toBeVisible();
});

test("search narrows the contact list and clearing restores it", async ({
  page,
}) => {
  await openSection(page, "Contacts");
  const all = await page.locator("tbody tr").count();
  expect(all).toBeGreaterThan(1);

  await page.getByPlaceholder("Search contacts…").fill("zhou");
  await expect(page.locator("tbody tr")).toHaveCount(1);

  await page.getByPlaceholder("Search contacts…").clear();
  await expect(page.locator("tbody tr")).toHaveCount(all);
});

test("the status filter shows only matching contacts", async ({ page }) => {
  await openSection(page, "Contacts");
  await page.getByLabel("Filter by status").selectOption("lead");

  const rows = page.locator("tbody tr");
  await expect(rows).not.toHaveCount(0);
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText("lead");
  }
});

test("a search with no matches leaves an empty table rather than stale rows", async ({
  page,
}) => {
  await openSection(page, "Contacts");
  await page.getByPlaceholder("Search contacts…").fill("zzzznotarealcontact");
  await expect(page.locator("tbody tr")).toHaveCount(0);
});

test("create a contact against an organization and open it from the detail page", async ({
  page,
}) => {
  await openSection(page, "Contacts");
  await page.getByRole("button", { name: "Add contact" }).click();

  const dialog = page.getByRole("dialog", { name: "Add contact" });
  await dialog.getByLabel("Name").fill("Test Person");
  await dialog.getByLabel("Email").fill("test.person@example.com");
  await dialog.getByLabel("Organization").selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("row", { name: /Test Person/ })).toBeVisible();
  await page.getByRole("row", { name: /Test Person/ }).click();
  await expect(
    page.getByRole("heading", { name: "Test Person", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("test.person@example.com")).toBeVisible();
});

test("a deal detail page lists its activities and accepts a new note", async ({
  page,
}) => {
  await openSection(page, "Deals");
  await page.locator("tbody tr").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const note = `Exploratory note ${Date.now()}`;
  await page.getByRole("button", { name: "Log activity" }).click();
  const dialog = page.getByRole("dialog", { name: "Log activity" });
  await dialog.getByLabel("Description").fill(note);
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText(note)).toBeVisible();
  await page.reload();
  await expect(page.getByText(note)).toBeVisible();
});
