import { test, expect } from "../fixtures";
import type { Page } from "@playwright/test";

async function openTripPlanner(page: Page) {
  await page.goto("/space/");
  await page.getByRole("button", { name: "Expand Travel" }).click();
  await page.getByRole("treeitem", { name: /Trip Planner/ }).click();
  await expect(page.getByRole("tab", { name: "Table" })).toBeVisible();
}

/** Drag a board card into a column, retrying until the card lands there. */
async function dragCard(
  page: Page,
  cardText: string,
  fromCol: ReturnType<Page["locator"]>,
  toCol: ReturnType<Page["locator"]>,
) {
  await expect(async () => {
    if ((await toCol.locator(".board-card", { hasText: cardText }).count()) > 0)
      return;
    const card = fromCol.locator(".board-card", { hasText: cardText });
    const from = (await card.boundingBox())!;
    const to = (await toCol.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 15 });
    await page.mouse.up();
    await expect(
      toCol.locator(".board-card", { hasText: cardText }),
    ).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 20000 });
}

test("switches between table, board and list over the same rows", async ({
  page,
}) => {
  await openTripPlanner(page);
  await expect(
    page.getByLabel("Title for row Lisbon long weekend"),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Board" }).click();
  const board = page.getByTestId("board");
  await expect(board).toBeVisible();
  await expect(board.getByText("Lisbon long weekend")).toBeVisible();

  await page.getByRole("tab", { name: "List" }).click();
  await expect(
    page.locator(".list-row", { hasText: "Lisbon long weekend" }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Table" }).click();
  await expect(
    page.getByLabel("Title for row Lisbon long weekend"),
  ).toBeVisible();
});

test("board groups by Status and dragging a card changes the value everywhere", async ({
  page,
}) => {
  // reset Lisbon to Planning via the API so retries start from a known state
  const tree = await (await page.request.get("/api/space/tree")).json();
  const travel = tree.find((n: any) => n.title === "Travel");
  const dbId = travel.children.find((n: any) => n.title === "Trip Planner").id;
  const db = await (
    await page.request.get(`/api/space/databases/${dbId}`)
  ).json();
  const status = db.properties.find((p: any) => p.name === "Status");
  const planningOpt = status.options.find((o: any) => o.name === "Planning").id;
  const lisbon = db.rows.find((r: any) => r.title === "Lisbon long weekend");
  await page.request.patch(`/api/space/rows/${lisbon.id}/values`, {
    data: { propertyId: status.id, value: planningOpt },
  });

  await openTripPlanner(page);
  await page.getByRole("tab", { name: "Board" }).click();

  const board = page.getByTestId("board");
  const planning = board.locator('.board-col[data-column="Planning"]');
  const booked = board.locator('.board-col[data-column="Booked"]');
  await expect(planning.getByText("Lisbon long weekend")).toBeVisible();
  await expect(booked.getByText("Japan, ten days")).toBeVisible();

  // drag Lisbon from Planning to Booked, waiting for the value PATCH to land
  const patched = page.waitForResponse(
    (r) => r.url().includes("/values") && r.request().method() === "PATCH",
  );
  await dragCard(page, "Lisbon long weekend", planning, booked);
  await patched;

  // the change shows in the table view too (dnd-kit may swallow the first click after a drag)
  await expect(async () => {
    await page.getByRole("tab", { name: "Table" }).click();
    await expect(page.getByRole("tab", { name: "Table" })).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 500 },
    );
  }).toPass();
  await expect(
    page.getByLabel("Status for Lisbon long weekend").getByText("Booked"),
  ).toBeVisible();

  // and survives a refresh
  await page.reload();
  await page.getByRole("tab", { name: "Board" }).click();
  await expect(
    page
      .getByTestId("board")
      .locator('.board-col[data-column="Booked"]')
      .getByText("Lisbon long weekend"),
  ).toBeVisible();

  // drag it back to Planning to restore the seed state
  await dragCard(
    page,
    "Lisbon long weekend",
    page.getByTestId("board").locator('.board-col[data-column="Booked"]'),
    page.getByTestId("board").locator('.board-col[data-column="Planning"]'),
  );
});

test("filters narrow rows, sorts order them, and both persist per view", async ({
  page,
}) => {
  await openTripPlanner(page);

  // checkbox filter: only trips with flights booked
  await page.getByRole("button", { name: /Filter/ }).click();
  await page.getByRole("button", { name: "+ Add filter" }).click();
  await page
    .getByLabel("Filter property")
    .selectOption({ label: "Flights booked" });
  await page
    .getByLabel("Filter operator")
    .selectOption({ label: "is checked" });
  await page.keyboard.press("Escape");
  await page.locator(".menu-overlay").click({ position: { x: 5, y: 5 } });

  await expect(page.getByLabel("Title for row Japan, ten days")).toBeVisible();
  await expect(page.getByLabel(/Title for row Lisbon/)).toHaveCount(0);

  await page.reload();
  await expect(page.getByLabel("Title for row Japan, ten days")).toBeVisible();
  await expect(page.getByLabel(/Title for row Lisbon/)).toHaveCount(0);

  // remove the filter
  await page.getByRole("button", { name: /Filter \(1\)/ }).click();
  await page.getByRole("button", { name: "Remove filter" }).click();
  await page.locator(".menu-overlay").click({ position: { x: 5, y: 5 } });
  await expect(page.getByLabel(/Title for row Lisbon/)).toHaveCount(1);

  // sort by Budget descending, persists after refresh
  await page.getByRole("button", { name: "Sort" }).click();
  await page.getByLabel("Sort property").selectOption({ label: "Budget" });
  await page.getByLabel("Sort direction").selectOption("desc");
  await page.locator(".menu-overlay").click({ position: { x: 5, y: 5 } });

  const titles = () =>
    page
      .getByLabel(/Title for row/)
      .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  await expect
    .poll(titles)
    .toEqual([
      "Japan, ten days",
      "Mexico City",
      "Dolomites hut to hut",
      "Lisbon long weekend",
      "Scottish Highlands",
    ]);

  await page.reload();
  await expect
    .poll(titles)
    .toEqual([
      "Japan, ten days",
      "Mexico City",
      "Dolomites hut to hut",
      "Lisbon long weekend",
      "Scottish Highlands",
    ]);

  // restore the seeded sort (Depart ascending)
  await page.getByRole("button", { name: "Sort" }).click();
  await page.getByLabel("Sort property").selectOption({ label: "Depart" });
  await page.getByLabel("Sort direction").selectOption("asc");
});

test("list view shows title plus properties and the chosen view is remembered", async ({
  page,
}) => {
  await openTripPlanner(page);
  await page.getByRole("tab", { name: "List" }).click();
  const row = page.locator(".list-row", { hasText: "Scottish Highlands" });
  await expect(row.getByText("Done")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("tab", { name: "List" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: "Table" }).click();
});
