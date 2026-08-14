import { test, expect } from "../fixtures";

test("create a database, add properties, rows, edit cells, and reopen after refresh", async ({ page }) => {
  const name = `Tasks DB ${Date.now()}`;
  await page.goto("/space/");
  await page.getByRole("button", { name: "New database" }).click();
  const title = page.getByPlaceholder("Untitled");
  await expect(title).toHaveValue("");
  await title.fill(name);
  await expect(page.getByRole("treeitem", { name: new RegExp(name) })).toBeVisible();

  // add a text property and a select property
  await page.getByRole("button", { name: "Add property" }).click();
  await page.getByPlaceholder("Property name").fill("Owner");
  await page.getByRole("button", { name: "Create property" }).click();
  await expect(page.getByRole("columnheader", { name: "Owner" })).toBeVisible();

  await page.getByRole("button", { name: "Add property" }).click();
  await page.getByPlaceholder("Property name").fill("Stage");
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("button", { name: "Create property" }).click();
  await expect(page.getByRole("columnheader", { name: "Stage" })).toBeVisible();

  // add two rows and edit cells
  await page.getByRole("button", { name: "New row" }).click();
  await page.getByRole("button", { name: "New row" }).click();
  const titles = page.getByLabel(/Title for row/);
  await expect(titles).toHaveCount(2);
  await titles.nth(0).fill("Write the report");
  await titles.nth(1).fill("Review the report");

  await page.getByLabel("Owner for Write the report").fill("Ed");
  await page.getByLabel("Owner for Write the report").press("Enter");

  // create a select option on row 1, reuse it on row 2
  await page.getByLabel("Stage for Write the report").click();
  await page.getByPlaceholder("Select or create…").fill("Drafting");
  await page.getByRole("button", { name: "Create “Drafting”" }).click();
  await expect(page.getByLabel("Stage for Write the report").getByText("Drafting")).toBeVisible();

  await page.getByLabel("Stage for Review the report").click();
  await expect(page.getByRole("dialog").getByText("Drafting")).toBeVisible();
  await page.getByRole("dialog").getByText("Drafting").click();
  await expect(page.getByLabel("Stage for Review the report").getByText("Drafting")).toBeVisible();

  // everything survives a refresh
  await page.reload();
  await expect(page.getByRole("columnheader", { name: "Owner" })).toBeVisible();
  await expect(page.getByLabel("Title for row Write the report")).toHaveValue("Write the report");
  await expect(page.getByLabel("Owner for Write the report")).toHaveValue("Ed");
  await expect(page.getByLabel("Stage for Review the report").getByText("Drafting")).toBeVisible();
});

test("seeded Reading List: edit cells in place, values persist", async ({ page }) => {
  await page.goto("/space/");
  await page.getByRole("treeitem", { name: /Reading List/ }).click();
  await expect(page.getByRole("columnheader", { name: "Author" })).toBeVisible();

  const rating = page.getByLabel("Rating for Piranesi");
  await rating.fill("4");
  await rating.press("Enter");
  const owned = page.getByLabel("Owned for Piranesi");
  await owned.check();

  await page.reload();
  await expect(page.getByLabel("Rating for Piranesi")).toHaveValue("4");
  await expect(page.getByLabel("Owned for Piranesi")).toBeChecked();

  // put it back
  await page.getByLabel("Rating for Piranesi").fill("");
  await page.getByLabel("Rating for Piranesi").press("Enter");
  await page.getByLabel("Owned for Piranesi").uncheck();
});

test("a row opens as a page with properties on top and editable blocks below", async ({ page }) => {
  await page.goto("/space/");
  await page.getByRole("treeitem", { name: /Reading List/ }).click();
  const duneTitle = page.getByLabel("Title for row Dune");
  await duneTitle.hover();
  await page.getByRole("button", { name: "Open Dune" }).click();

  await expect(page.locator(".row-breadcrumb")).toHaveText(/Reading List/);
  await expect(page.getByLabel("Author for Dune")).toHaveValue("Frank Herbert");
  await expect(page.locator(".b-quote-text")).toHaveText("Fear is the mind-killer.");

  // edit a property and a block, both persist
  await page.getByLabel("Author for Dune").fill("F. Herbert");
  await page.getByLabel("Author for Dune").press("Enter");
  const saved = page.waitForResponse((r) => r.url().includes("/api/space/blocks/") && r.request().method() === "PATCH");
  const para = page.locator(".block-text").last();
  await para.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Still true.");
  await saved;

  await page.reload();
  await expect(page.getByLabel("Author for Dune")).toHaveValue("F. Herbert");
  await expect(page.locator(".block-text").last()).toContainText("Still true.");

  // restore
  await page.getByLabel("Author for Dune").fill("Frank Herbert");
  await page.getByLabel("Author for Dune").press("Enter");
});

test("date and checkbox editors fit their types", async ({ page }) => {
  await page.goto("/space/");
  await page.getByRole("treeitem", { name: /Reading List/ }).click();
  const date = page.getByLabel("Finished on for Dune");
  await expect(date).toHaveAttribute("type", "date");
  await expect(page.getByLabel("Owned for Dune")).toHaveAttribute("type", "checkbox");
});
