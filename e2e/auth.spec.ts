/**
 * The gate around everything: pages redirect to the login document, API routes answer 401,
 * the form signs in and out. This spec never signs in up front - it is the only one that
 * sees the app from the outside.
 */
import { test, expect, login } from "./fixtures";

test("a page without a session lands on the login document", async ({
  page,
}) => {
  await page.goto("/crm/contacts");
  await expect(page).toHaveTitle("Sign in - Novhora");
  expect(new URL(page.url()).pathname).toBe("/login/");
});

test("an API route without a session answers 401", async ({ request }) => {
  const res = await request.get("/api/crm/organizations");
  expect(res.status()).toBe(401);
});

test("a wrong password is refused, with one message either way", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("marco");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toHaveText("Wrong username or password");
  expect(new URL(page.url()).pathname).toBe("/login/");

  await page.getByLabel("Username").fill("not-the-user");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(alert).toHaveText("Wrong username or password");
});

test("signing in lands on the launcher and opens the apps", async ({
  page,
}) => {
  await login(page);
  await expect(page).toHaveTitle("Novhora");
  await page.getByRole("link", { name: "CRM" }).first().click();
  await expect(page).toHaveTitle("Personal CRM - Novhora");
});

test("the session holds across reloads", async ({ page }) => {
  await login(page);
  await page.reload();
  await expect(page).toHaveTitle("Novhora");
});

test("signing out from the strip closes the door again", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveTitle("Sign in - Novhora");
  const res = await page.request.get("/api/crm/organizations");
  expect(res.status()).toBe(401);
});
