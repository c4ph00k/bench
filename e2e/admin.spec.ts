/**
 * The admin panel and the forced password change: an admin adds and manages users, and a user
 * created with a temporary password is held at the change page until it is replaced.
 */
import { test, expect, login } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("the panel is in the admin's nav and lists the seeded user", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link", { name: "Admin" })).toBeVisible();

  await page.goto("/admin/");
  await expect(page).toHaveTitle("Admin - Novhora");
  await expect(page.getByText("marco")).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
});

test("a fresh user must change the temporary password before the apps open", async ({
  page,
}) => {
  await page.goto("/admin/");
  await page.getByLabel("Username").fill("luca");
  await page.getByLabel("Temporary password").fill("lemons");
  await page.getByLabel("Role", { exact: true }).selectOption("user");
  await page.getByRole("button", { name: "Add user" }).click();
  await expect(page.getByText("Temporary password")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveTitle("Sign in - Novhora");
  await page.getByLabel("Username").fill("luca");
  await page.getByLabel("Password").fill("lemons");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveTitle("Set your password - Novhora");

  // The gate holds every page until the replacement is set.
  await page.goto("/");
  await expect(page).toHaveTitle("Set your password - Novhora");

  await page.getByLabel("New password").fill("plums");
  await page.getByLabel("Repeat password").fill("plums");
  await page.getByRole("button", { name: "Set password" }).click();
  await expect(page).toHaveTitle("Novhora");

  // A plain user never reaches the panel.
  await page.goto("/admin/");
  await expect(page).toHaveTitle("Novhora");

  // And the next sign-in is a normal one.
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Username").fill("luca");
  await page.getByLabel("Password").fill("plums");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveTitle("Novhora");
});
