/** Cards can be reordered inside a kanban column, and the order sticks. */
import { test, expect } from "../fixtures";
import type { Page } from "@playwright/test";

async function openBoard(page: Page) {
  await page.goto("/space/");
  await page.getByRole("button", { name: "Expand Travel" }).click();
  await page.getByRole("treeitem", { name: /Trip Planner/ }).click();
  await page.getByRole("tab", { name: "Board" }).click();
  await page.getByTestId("board").waitFor();
}

const titles = (page: Page, column: string) =>
  page
    .getByTestId("board")
    .locator(`.board-col[data-column="${column}"] .board-card-title`)
    .allInnerTexts();

test("the board fits without a horizontal scrollbar", async ({ page }) => {
  await openBoard(page);
  const overflows = await page
    .getByTestId("board")
    .evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(overflows).toBe(false);
});

test("a card can be dragged above another in the same column and the order persists", async ({
  page,
}) => {
  await openBoard(page);
  const column = "Dreaming";
  const before = await titles(page, column);
  expect(
    before.length,
    "seed data should stack two cards in Dreaming",
  ).toBeGreaterThan(1);

  const cards = page
    .getByTestId("board")
    .locator(`.board-col[data-column="${column}"] .board-card`);
  const from = (await cards.nth(0).boundingBox())!;
  const to = (await cards.nth(1).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 4, {
    steps: 20,
  });
  await page.mouse.up();

  const swapped = [before[1], before[0]];
  await expect
    .poll(() => titles(page, column), { timeout: 5000 })
    .toEqual(swapped);

  await page.reload();
  await page.getByRole("tab", { name: "Board" }).click();
  await page.getByTestId("board").waitFor();
  await expect
    .poll(() => titles(page, column), { timeout: 5000 })
    .toEqual(swapped);
});

test("dragging a card to another column still changes its value", async ({
  page,
}) => {
  await openBoard(page);
  const board = page.getByTestId("board");
  const source = board.locator('.board-col[data-column="Dreaming"]');
  const target = board.locator('.board-col[data-column="Planning"]');
  const moving = (await titles(page, "Dreaming"))[0];

  const from = (await source.locator(".board-card").first().boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 20 });
  await page.mouse.up();

  await expect
    .poll(() => titles(page, "Planning"), { timeout: 5000 })
    .toContain(moving);
});
