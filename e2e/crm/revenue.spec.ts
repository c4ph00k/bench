/**
 * Moving a deal along the pipeline re-bases its probability, so both the total and the expected
 * revenue must move with it - on the pipeline itself and on the dashboard.
 */
import { test, expect } from "../fixtures";
import { json, type Deal } from "../api";
import type { Page } from "@playwright/test";

/** Parse "$119,450" into 119450 so figures can be compared as numbers. */
async function money(page: Page, testId: string): Promise<number> {
  const text = await page.getByTestId(testId).innerText();
  return Number(text.replace(/[^0-9.-]/g, ""));
}

/** The figures render as $0 until the deals fetch resolves, so wait for real data first. */
async function loadedMoney(page: Page, testId: string): Promise<number> {
  await expect
    .poll(() => money(page, testId), { timeout: 5000 })
    .toBeGreaterThan(0);
  return money(page, testId);
}

/** A card being on screen proves the pipeline has its data. */
async function waitForCard(page: Page, name: string) {
  await expect(
    page.getByRole("button", { name: new RegExp(`^${name}`) }),
  ).toBeVisible();
}

async function dragToNextStage(page: Page, name: string) {
  await page.getByRole("button", { name: new RegExp(`^${name}`) }).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
}

/**
 * Guarantee a deal sits in the given stage, moving one there if an earlier test in this worker
 * already used it up. Call this before loading the page under test, not after.
 */
async function dealInStage(
  page: Page,
  baseURL: string,
  stage: string,
): Promise<Deal> {
  const deals = await json<Deal[]>(
    await page.request.get(`${baseURL}/api/crm/deals`),
  );
  const found = deals.find((d) => d.stage === stage);
  if (found) return found;

  const candidate = deals.find((d) => d.stage !== stage)!;
  await page.request.patch(`${baseURL}/api/crm/deals/${candidate.id}/stage`, {
    data: { stage },
  });
  return { ...candidate, stage };
}

test("stage defaults set each deal's probability", async ({
  page,
  baseURL,
}) => {
  const deals = await json<Deal[]>(
    await page.request.get(`${baseURL}/api/crm/deals`),
  );
  const expected: Record<string, number> = {
    New: 10,
    Qualified: 25,
    Proposal: 50,
    Negotiation: 75,
    Won: 100,
    Lost: 0,
  };
  for (const deal of deals) {
    expect(deal.probability, `${deal.name} in ${deal.stage}`).toBe(
      expected[deal.stage],
    );
  }
});

test("moving a card raises expected revenue while total pipeline holds", async ({
  page,
  baseURL,
}) => {
  const deal = await dealInStage(page, baseURL!, "New");
  await page.goto("/crm/pipeline");
  await waitForCard(page, deal.name);

  const totalBefore = await money(page, "pipeline-total");
  const expectedBefore = await money(page, "pipeline-expected");

  await dragToNextStage(page, deal.name);

  // New (10%) -> Qualified (25%) on the same value: expected rises, total is unchanged.
  await expect
    .poll(() => money(page, "pipeline-expected"), { timeout: 5000 })
    .toBeGreaterThan(expectedBefore);
  expect(await money(page, "pipeline-total")).toBe(totalBefore);

  const rise = (await money(page, "pipeline-expected")) - expectedBefore;
  expect(rise).toBeCloseTo(deal.value * 0.15, 0);
});

test("the stage column totals follow the card", async ({ page, baseURL }) => {
  const deal = await dealInStage(page, baseURL!, "New");
  await page.goto("/crm/pipeline");
  await waitForCard(page, deal.name);

  const newTotalBefore = await money(page, "stage-total-New");
  const qualifiedTotalBefore = await money(page, "stage-total-Qualified");

  await dragToNextStage(page, deal.name);

  await expect
    .poll(() => money(page, "stage-total-New"), { timeout: 5000 })
    .toBe(newTotalBefore - deal.value);
  expect(await money(page, "stage-total-Qualified")).toBe(
    qualifiedTotalBefore + deal.value,
  );
  expect(await money(page, "stage-expected-Qualified")).toBeCloseTo(
    (qualifiedTotalBefore + deal.value) * 0.25,
    0,
  );
});

test("the dashboard reflects a pipeline move", async ({ page, baseURL }) => {
  const deal = await dealInStage(page, baseURL!, "New");

  await page.goto("/crm/");
  const dashTotalBefore = await loadedMoney(page, "dash-total");
  const dashExpectedBefore = await loadedMoney(page, "dash-expected");

  await page.goto("/crm/pipeline");
  await waitForCard(page, deal.name);
  await dragToNextStage(page, deal.name);
  await expect
    .poll(() => money(page, "pipeline-expected"), { timeout: 5000 })
    .not.toBe(dashExpectedBefore);

  await page.goto("/crm/");
  // The deal stays open, so the total holds while the weighting improves.
  await expect
    .poll(() => money(page, "dash-expected"), { timeout: 5000 })
    .toBeGreaterThan(dashExpectedBefore);
  expect(await loadedMoney(page, "dash-total")).toBe(dashTotalBefore);
});

test("winning a deal moves its value out of the pipeline and into revenue", async ({
  page,
  baseURL,
}) => {
  const deal = await dealInStage(page, baseURL!, "Negotiation");
  await page.goto("/crm/pipeline");
  await waitForCard(page, deal.name);
  const totalBefore = await money(page, "pipeline-total");

  // Negotiation -> Won leaves the open pipeline entirely.
  await dragToNextStage(page, deal.name);

  await expect
    .poll(() => money(page, "pipeline-total"), { timeout: 5000 })
    .toBe(totalBefore - deal.value);
  const updated = await json<Deal[]>(
    await page.request.get(`${baseURL}/api/crm/deals`),
  );
  expect(updated.find((d) => d.id === deal.id)!.probability).toBe(100);
});

test("the deals table shows probability and expected value per row", async ({
  page,
  baseURL,
}) => {
  const deal = await dealInStage(page, baseURL!, "Qualified");
  await page.goto("/crm/deals");

  const row = page.getByRole("row", { name: new RegExp(deal.name) });
  await expect(row).toContainText("25%");
  await expect(row).toContainText(
    `$${(deal.value * 0.25).toLocaleString("en-US")}`,
  );
});
