import { test, expect, login } from "../fixtures";

test.beforeEach(async ({ page }) => {
  await login(page);
});
import type { Page } from "@playwright/test";

/** Create a page (root or nested), waiting out the navigation race, and title it. */
async function createPage(page: Page, title: string, parentLabel?: string) {
  if (parentLabel) {
    await page.getByRole("treeitem", { name: new RegExp(parentLabel) }).hover();
    await page
      .getByRole("button", { name: `Add page inside ${parentLabel}` })
      .click();
  } else {
    await page.getByRole("button", { name: "New page" }).click();
  }
  const input = page.getByPlaceholder("Untitled");
  await expect(input).toHaveValue("");
  await input.fill(title);
  await expect(
    page.getByRole("treeitem", { name: new RegExp(title) }),
  ).toBeVisible();
}

async function deletePage(page: Page, label: string) {
  await page.getByRole("treeitem", { name: new RegExp(label) }).hover();
  await page.getByRole("button", { name: `Page options for ${label}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(
    page.getByRole("treeitem", { name: new RegExp(label) }),
  ).toHaveCount(0);
}

test("seeded workspace loads with sidebar tree and icons", async ({ page }) => {
  await page.goto("/space/");
  await expect(page.locator(".brand-name")).toHaveText("Personal Space");
  await expect(page.getByRole("treeitem", { name: /Projects/ })).toBeVisible();
  await expect(page.getByRole("treeitem", { name: /Travel/ })).toBeVisible();
  await expect(page.getByText("🗂️")).toBeVisible();

  await page.getByRole("button", { name: "Expand Projects" }).click();
  await expect(
    page.getByRole("treeitem", { name: /Home Lab Rebuild/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Expand Home Lab Rebuild" }).click();
  await expect(
    page.getByRole("treeitem", { name: /Parts Inventory/ }),
  ).toBeVisible();
});

test("create a page, title it, and survive a refresh", async ({ page }) => {
  const name = `Test Page ${Date.now()}`;
  await page.goto("/space/");
  await createPage(page, name);

  await page.reload();
  await expect(
    page.getByRole("treeitem", { name: new RegExp(name) }),
  ).toBeVisible();
  await expect(page.getByPlaceholder("Untitled")).toHaveValue(name);
  await deletePage(page, name);
});

test("create a nested page, delete the parent, confirm cascade", async ({
  page,
}) => {
  const parent = `Cascade Parent ${Date.now()}`;
  const child = `Cascade Child ${Date.now()}`;
  await page.goto("/space/");
  await createPage(page, parent);
  await createPage(page, child, parent);

  await page.getByRole("treeitem", { name: new RegExp(parent) }).hover();
  await page
    .getByRole("button", { name: `Page options for ${parent}` })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "everything nested inside it",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete" })
    .click();

  await expect(
    page.getByRole("treeitem", { name: new RegExp(parent) }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("treeitem", { name: new RegExp(child) }),
  ).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("treeitem", { name: /Projects/ })).toBeVisible();
  await expect(
    page.getByRole("treeitem", { name: new RegExp(parent) }),
  ).toHaveCount(0);
});

test("rename from the sidebar options menu", async ({ page }) => {
  const before = `Rename Me ${Date.now()}`;
  const after = `Renamed ${Date.now()}`;
  await page.goto("/space/");
  await createPage(page, before);

  await page.getByRole("treeitem", { name: new RegExp(before) }).hover();
  await page
    .getByRole("button", { name: `Page options for ${before}` })
    .click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await page.getByRole("textbox", { name: "Rename page" }).fill(after);
  await page.getByRole("textbox", { name: "Rename page" }).press("Enter");
  await expect(
    page.getByRole("treeitem", { name: new RegExp(after) }),
  ).toBeVisible();
  await deletePage(page, after);
});
