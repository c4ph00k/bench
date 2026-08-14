import { test, expect } from "../fixtures";

test("quick-find opens by shortcut and control, narrows live, and jumps to a result", async ({
  page,
}) => {
  await page.goto("/space/");

  // keyboard shortcut
  await page.keyboard.press("ControlOrMeta+k");
  const dialog = page.getByRole("dialog", { name: "Quick find" });
  await expect(dialog).toBeVisible();

  await page.keyboard.type("read");
  await expect(
    page.getByRole("option", { name: /Reading List/ }),
  ).toBeVisible();

  // narrows live across rows too
  await page.getByRole("textbox", { name: "Search" }).fill("dune");
  await expect(page.getByRole("option", { name: /Dune/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Reading List/ })).toHaveCount(
    1,
  ); // Dune shows its parent

  // choosing a result navigates to it
  await page.getByRole("option", { name: /Dune/ }).click();
  await expect(page.getByLabel("Author for Dune")).toHaveValue("Frank Herbert");

  // visible control opens it too
  await page.getByRole("button", { name: /Search/ }).click();
  await expect(page.getByRole("dialog", { name: "Quick find" })).toBeVisible();
  await page.getByRole("textbox", { name: "Search" }).fill("balcony");
  await page.getByRole("option", { name: /Balcony Garden/ }).click();
  await expect(page.getByPlaceholder("Untitled")).toHaveValue("Balcony Garden");
});

test("keyboard-only quick-find: arrows plus Enter jump to the selection", async ({
  page,
}) => {
  await page.goto("/space/");
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type("japan");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Quick find" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/p\//);
});

test("theme toggle switches the whole app and survives a reload", async ({
  page,
}) => {
  await page.goto("/space/");
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Switch to light mode" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(html).not.toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(html).not.toHaveAttribute("data-theme", "dark");
});
