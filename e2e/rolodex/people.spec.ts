/** The rolodex end to end: finding someone, logging a call, and the check-in clock that follows. */
import { test, expect, login } from "../fixtures";

test.beforeEach(async ({ page }) => {
  await login(page);
});
import type { Page } from "@playwright/test";

const openPerson = async (page: Page, name: string) => {
  await page.goto("/rolodex/people");
  await page.getByPlaceholder(/Search by name/).fill(name);
  await page.getByRole("row").filter({ hasText: name }).first().click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
};

test("the people table searches and filters", async ({ page }) => {
  await page.goto("/rolodex/people");
  const rows = page.getByRole("row");
  // The table fills from the store, so wait for a row before counting them.
  await expect(rows.nth(1)).toBeVisible();
  const all = (await rows.count()) - 1;
  expect(all).toBeGreaterThan(10);

  await page.getByPlaceholder(/Search by name/).fill("maya");
  await expect(rows).toHaveCount(2); // the header, and Maya
  await expect(page.getByRole("cell", { name: /Maya Chen/ })).toBeVisible();

  await page.getByPlaceholder(/Search by name/).fill("");
  await page.getByLabel("Circle").selectOption("inner");
  const inner = (await rows.count()) - 1;
  expect(inner).toBeGreaterThan(0);
  expect(inner).toBeLessThan(all);
});

test("logging a call resets that person's check-in clock", async ({ page }) => {
  await page.goto("/rolodex/people");
  // Whoever the seed says is most overdue is the one to fix.
  await page.goto("/rolodex/");
  const firstRow = page.locator(".hero-row").first();
  const name = await firstRow.locator(".name").innerText();

  await firstRow.getByRole("button", { name: "Log contact" }).click();
  await page.getByRole("button", { name: "Met up" }).click();
  await page
    .getByRole("textbox", { name: /What did you talk about/ })
    .fill("Coffee near the office");
  await page.getByRole("button", { name: "Save interaction" }).click();

  await openPerson(page, name);
  await expect(page.getByText("In touch")).toBeVisible();
  await expect(page.getByText("Coffee near the office")).toBeVisible();
});

test("a person's page adds a fact and keeps it after a reload", async ({
  page,
}) => {
  await openPerson(page, "Maya Chen");
  await page.getByRole("button", { name: "Add fact" }).click();
  await page
    .getByRole("textbox", { name: "Fact" })
    .fill("Keeps bees on the roof");
  await page.getByRole("button", { name: "Save fact" }).click();

  // The modal still holds the same text in its textarea until it unmounts, so wait for it to
  // go before looking for the fact on the page.
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("Keeps bees on the roof")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Keeps bees on the roof")).toBeVisible();
});

test("adding a person puts them in the table and in the circles board", async ({
  page,
}) => {
  await page.goto("/rolodex/people");
  await page.getByRole("button", { name: "Add person" }).click();
  // Scoped to the modal: the page behind it has its own controls of the same name.
  const form = page.getByRole("dialog");
  await form.getByRole("textbox", { name: "Name *" }).fill("Zoë Winterbourne");
  await form.getByRole("textbox", { name: "Email" }).fill("zoe@example.com");
  await form.getByRole("button", { name: "Wider" }).click();
  await form.getByRole("button", { name: "Add person" }).click();

  await expect(
    page.getByRole("cell", { name: /Zoë Winterbourne/ }),
  ).toBeVisible();

  await page.goto("/rolodex/circles");
  const wider = page.locator('.board-col:has-text("Wider")');
  await expect(wider.getByText("Zoë Winterbourne")).toBeVisible();
});

test("the timeline filters down to one person", async ({ page }) => {
  await page.goto("/rolodex/timeline");
  await expect(page.getByText(/entries across everyone/)).toBeVisible();
  const all = await page.locator(".feed-item").count();

  await page.getByLabel("Person").selectOption({ label: "Maya Chen" });
  await expect(page.locator(".feed-item").first()).toBeVisible();
  const forMaya = await page.locator(".feed-item").count();
  expect(forMaya).toBeLessThan(all);
  await expect(page.locator(".feed-person").first()).toHaveText("Maya Chen");
});

test("the calendar shows a month of dates and walks to the next one", async ({
  page,
}) => {
  await page.goto("/rolodex/calendar");
  await expect(page.getByText("Coming up — next 30 days")).toBeVisible();
  const month = page.locator(".react-calendar__navigation__label");
  const first = await month.innerText();
  await page.locator(".react-calendar__navigation__next-button").click();
  await expect(month).not.toHaveText(first);
});
