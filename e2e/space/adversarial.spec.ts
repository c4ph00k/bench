import { test, expect } from "../fixtures";
import type { Page } from "@playwright/test";

async function freshPage(page: Page, title: string) {
  await page.goto("/space/");
  await page.getByRole("button", { name: "New page" }).click();
  const input = page.getByPlaceholder("Untitled");
  await expect(input).toHaveValue("");
  await input.fill(title);
  await page.locator(".block-text").first().click();
}

async function deletePage(page: Page, label: string | RegExp) {
  await page.getByRole("treeitem", { name: label }).hover();
  await page
    .getByRole("button", { name: /Page options for/ })
    .last()
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete" })
    .click();
}

test("script-looking titles and block text render inert", async ({ page }) => {
  let alertFired = false;
  page.on("dialog", async (d) => {
    alertFired = true;
    await d.dismiss();
  });
  const name = `<img src=x onerror=alert(1)> ${Date.now()}`;
  await freshPage(page, name);
  await page.keyboard.type('<script>alert("xss")</script> & <b>not bold</b>');
  await page.waitForTimeout(700);
  await page.reload();

  await expect(page.locator(".block-text").first()).toHaveText(
    '<script>alert("xss")</script> & <b>not bold</b>',
  );
  await expect(page.locator(".block-text b")).toHaveCount(0);
  await expect(page.getByRole("treeitem", { name: /onerror/ })).toBeVisible();
  expect(alertFired).toBe(false);
  await deletePage(page, /onerror/);
});

test("pasting rich HTML lands as plain text", async ({ page }) => {
  await freshPage(page, `Paste Test ${Date.now()}`);
  await page.locator(".block-text").first().click();
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData("text/html", "<b>bold</b><script>alert(1)</script>");
    dt.setData("text/plain", "just plain text");
    document.activeElement?.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(page.locator(".block-text").first()).toHaveText(
    "just plain text",
  );
  await expect(page.locator(".block-text b")).toHaveCount(0);
  await deletePage(page, /Paste Test/);
});

test("hammering Enter keeps block order intact after reload", async ({
  page,
}) => {
  await freshPage(page, `Enter Storm ${Date.now()}`);
  for (let i = 1; i <= 12; i++) {
    await page.keyboard.type(`line${i}`);
    await page.keyboard.press("Enter");
  }
  await page.keyboard.type("last");
  await page.waitForTimeout(900);
  await page.reload();
  const texts = await page.locator(".block-text").allTextContents();
  expect(texts).toEqual([
    ...Array.from({ length: 12 }, (_, i) => `line${i + 1}`),
    "last",
  ]);
  await deletePage(page, /Enter Storm/);
});

test("deleting a filtered property leaves the other rows visible", async ({
  page,
}) => {
  const name = `Filter Orphan ${Date.now()}`;
  await page.goto("/space/");
  await page.getByRole("button", { name: "New database" }).click();
  await page.getByPlaceholder("Untitled").fill(name);
  await page.getByRole("button", { name: "Add property" }).click();
  await page.getByPlaceholder("Property name").fill("Doomed");
  await page.getByRole("button", { name: "Create property" }).click();
  await page.getByRole("button", { name: "New row" }).click();
  await page.getByLabel(/Title for row/).fill("Survivor");

  await page.getByRole("button", { name: /Filter/ }).click();
  await page.getByRole("button", { name: "+ Add filter" }).click();
  await page.getByLabel("Filter property").selectOption({ label: "Doomed" });
  await page.getByLabel("Filter value").fill("nothing matches this");
  await page.locator(".menu-overlay").click({ position: { x: 5, y: 5 } });
  await expect(page.getByLabel(/Title for row/)).toHaveCount(0);

  await page.getByRole("button", { name: "Doomed" }).click();
  await page.getByRole("button", { name: "Delete property" }).click();
  await expect(page.getByLabel("Title for row Survivor")).toBeVisible();
  await deletePage(page, /Filter Orphan/);
});

test("absurdly long titles do not break the sidebar or crash anything", async ({
  page,
}) => {
  const long = "L" + "o".repeat(500) + "ng";
  await freshPage(page, long);
  await expect(page.getByRole("treeitem", { name: /Loo/ })).toBeVisible();
  await page.reload();
  await expect(page.getByPlaceholder("Untitled")).toHaveValue(long);
  await deletePage(page, /Loo/);
});

test("backspace-spamming the only block never removes it or crashes", async ({
  page,
}) => {
  await freshPage(page, `Backspace Storm ${Date.now()}`);
  for (let i = 0; i < 15; i++) await page.keyboard.press("Backspace");
  await expect(page.locator(".block-row")).toHaveCount(1);
  await page.keyboard.type("still alive");
  await expect(page.locator(".block-text").first()).toHaveText("still alive");
  await deletePage(page, /Backspace Storm/);
});

test("visiting a deleted page shows a friendly missing state", async ({
  page,
}) => {
  const name = `Ghost ${Date.now()}`;
  await freshPage(page, name);
  const url = page.url();
  await deletePage(page, /Ghost/);
  await page.goto(url);
  await expect(
    page.getByText("This page does not exist anymore."),
  ).toBeVisible();
});
