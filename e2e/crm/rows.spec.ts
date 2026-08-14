/** Per-row edit and delete icons, and the richer table chrome around them. */
import { test, expect } from "../fixtures";

test("the edit icon on a row opens that record's form", async ({ page }) => {
  await page.goto("/crm/organizations");
  const name = (
    await page.locator("tbody tr").first().locator("td").first().innerText()
  ).trim();

  await page.getByRole("button", { name: `Edit ${name}` }).click();

  const dialog = page.getByRole("dialog", { name: "Edit organization" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Name")).toHaveValue(name);

  await dialog.getByLabel("Industry").fill("Edited via row icon");
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText(
    "Edited via row icon",
  );
});

test("the delete icon asks first and removes the row on confirm", async ({
  page,
}) => {
  await page.goto("/crm/contacts");
  const before = await page.locator("tbody tr").count();
  const name = (
    await page.locator("tbody tr").first().locator("td").first().innerText()
  ).trim();

  await page.getByRole("button", { name: `Delete ${name}` }).click();
  await expect(
    page.getByRole("dialog", { name: "Delete contact" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete" })
    .click();

  await expect(page.locator("tbody tr")).toHaveCount(before - 1);
  await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(
    0,
  );
});

test("cancelling the row delete keeps the record", async ({ page }) => {
  await page.goto("/crm/contacts");
  const before = await page.locator("tbody tr").count();
  const name = (
    await page.locator("tbody tr").first().locator("td").first().innerText()
  ).trim();

  await page.getByRole("button", { name: `Delete ${name}` }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel" })
    .click();

  await expect(page.locator("tbody tr")).toHaveCount(before);
});

test("row action clicks do not navigate to the detail page", async ({
  page,
}) => {
  await page.goto("/crm/organizations");
  const name = (
    await page.locator("tbody tr").first().locator("td").first().innerText()
  ).trim();

  await page.getByRole("button", { name: `Edit ${name}` }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/crm/organizations");
});

test("tables summarise their contents in a footer", async ({ page }) => {
  await page.goto("/crm/organizations");
  await expect(page.getByText(/\d+ organizations/)).toBeVisible();
  await expect(page.getByText(/Open pipeline \$/)).toBeVisible();

  await page.goto("/crm/deals");
  await expect(page.getByText(/Total \$.*Expected \$/)).toBeVisible();
});

test("organization rows count their contacts and open deals", async ({
  page,
  baseURL,
}) => {
  const orgs = await (
    await page.request.get(`${baseURL}/api/crm/organizations`)
  ).json();
  const contacts = await (
    await page.request.get(`${baseURL}/api/crm/contacts`)
  ).json();
  const target = orgs.find((o: { id: number }) =>
    contacts.some(
      (c: { organization_id: number }) => c.organization_id === o.id,
    ),
  );
  const count = contacts.filter(
    (c: { organization_id: number }) => c.organization_id === target.id,
  ).length;

  await page.goto("/crm/organizations");
  const row = page.getByRole("row", {
    name: new RegExp(target.name.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&")),
  });
  await expect(row.locator("td").nth(3)).toHaveText(String(count));
});

test("sorting a column reorders the rows", async ({ page }) => {
  await page.goto("/crm/deals");
  const firstBefore = await page.locator("tbody tr").first().innerText();

  await page.getByRole("columnheader", { name: /Value/ }).click();
  await expect
    .poll(async () => page.locator("tbody tr").first().innerText())
    .not.toBe(firstBefore);
});
