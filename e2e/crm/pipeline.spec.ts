/**
 * The pipeline board. Dragging is driven by the keyboard, which @hello-pangea/dnd supports
 * natively: focus a card, Space to lift, arrows to move, Space to drop. That avoids the
 * coordinate and viewport fragility that mouse-simulated drags suffer from.
 */
import { test, expect } from "../fixtures";
import { json, type Deal } from "../api";
import type { Page } from "@playwright/test";

const STAGES = ["New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];

/** Read a deal's stage straight from the API, so assertions do not trust the UI alone. */
async function stageOf(
  page: Page,
  baseURL: string,
  name: string,
): Promise<string> {
  const deals = await json<Deal[]>(
    await page.request.get(`${baseURL}/api/crm/deals`),
  );
  return deals.find((d) => d.name === name)!.stage;
}

function card(page: Page, name: string) {
  return page.getByRole("button", { name: new RegExp(`^${name}`) });
}

test("the board shows every stage as a column", async ({ page }) => {
  await page.goto("/crm/pipeline");
  for (const stage of STAGES) {
    await expect(page.getByText(stage, { exact: true }).first()).toBeVisible();
  }
});

test("keyboard-dragging a card moves the deal to the next stage", async ({
  page,
  baseURL,
}) => {
  await page.goto("/crm/pipeline");
  const deals = await json<Deal[]>(
    await page.request.get(`${baseURL}/api/crm/deals`),
  );
  const deal = deals.find((d) => d.stage === "New");
  expect(deal, "seed data should contain a deal in New").toBeTruthy();

  await card(page, deal!.name).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");

  await expect
    .poll(() => stageOf(page, baseURL!, deal!.name), { timeout: 5000 })
    .toBe("Qualified");
});

test("a stage change survives a reload and shows on the deals list", async ({
  page,
  baseURL,
}) => {
  await page.goto("/crm/pipeline");
  const deals = await json<Deal[]>(
    await page.request.get(`${baseURL}/api/crm/deals`),
  );
  const deal = deals.find((d) => d.stage === "New")!;

  await card(page, deal.name).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await expect
    .poll(() => stageOf(page, baseURL!, deal.name), { timeout: 5000 })
    .toBe("Qualified");

  await page.reload();
  await expect(card(page, deal.name)).toBeVisible();

  await page.goto("/crm/deals");
  await expect(
    page.getByRole("row", { name: new RegExp(deal.name) }),
  ).toContainText("Qualified");
});

test("dropping a card back returns it to the original stage", async ({
  page,
  baseURL,
}) => {
  await page.goto("/crm/pipeline");
  const deals = await json<Deal[]>(
    await page.request.get(`${baseURL}/api/crm/deals`),
  );
  const deal = deals.find((d) => d.stage === "Qualified")!;

  await card(page, deal.name).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Space");

  await expect
    .poll(() => stageOf(page, baseURL!, deal.name), { timeout: 5000 })
    .toBe("New");
});

test("escape cancels a lift and leaves the deal where it was", async ({
  page,
  baseURL,
}) => {
  await page.goto("/crm/pipeline");
  const deals = await json<Deal[]>(
    await page.request.get(`${baseURL}/api/crm/deals`),
  );
  const deal = deals.find((d) => d.stage === "New")!;

  // A cancelled lift must send no stage change at all. Watching for the request and finding none
  // says that directly; a fixed wait only hopes one would have arrived by then.
  const stagePatch = page
    .waitForRequest(
      (r) => r.url().includes("/stage") && r.method() === "PATCH",
      { timeout: 1500 },
    )
    .catch(() => null);

  await card(page, deal.name).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");

  expect(await stagePatch).toBeNull();
  expect(await stageOf(page, baseURL!, deal.name)).toBe("New");
});

test("opening a deal from its card keeps the /crm basename", async ({
  page,
}) => {
  await page.goto("/crm/pipeline");
  await page.locator(".deal-card, [data-rbd-draggable-id]").first().click();
  await expect(page).toHaveURL(/\/crm\/deals\/\d+/);
});
