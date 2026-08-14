/**
 * The consolidation seams: four HTML entry points, two router basenames, two API namespaces and
 * deep-link fallback. These are what the merge introduced, so they are what regresses.
 */
import { test, expect } from "./fixtures";
import { json, type Organization, type TreeNode } from "./api";
import type { Locator, Page } from "@playwright/test";

/**
 * `ready` is something each app only renders once it has actually mounted and fetched, which is
 * what the console-error check needs to wait for. A load state would pass before any of that.
 */
const APPS: {
  path: string;
  title: string;
  ready: (page: Page) => Locator;
}[] = [
  {
    path: "/",
    title: "Bench",
    ready: (p) => p.getByRole("link", { name: /^CRM/i }),
  },
  {
    path: "/crm/",
    title: "Personal CRM",
    ready: (p) => p.getByTestId("dash-total"),
  },
  {
    path: "/space/",
    title: "Personal Space",
    ready: (p) => p.getByRole("treeitem").first(),
  },
  {
    path: "/groove/",
    title: "GROOVEBOX GX-4",
    ready: (p) => p.getByRole("region", { name: "RHYTHM" }),
  },
];

/** Collect console and page errors for the lifetime of a page. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test("every app serves its own document from its own entry point", async ({
  page,
}) => {
  for (const app of APPS) {
    await page.goto(app.path);
    await expect(page).toHaveTitle(app.title);
  }
});

test("deep links load the owning app, not the launcher", async ({ page }) => {
  // Without per-prefix fallback these serve the launcher and the app never boots.
  for (const [path, title] of [
    ["/crm/contacts", "Personal CRM"],
    ["/crm/pipeline", "Personal CRM"],
    ["/space/p/does-not-exist", "Personal Space"],
    ["/groove/anything", "GROOVEBOX GX-4"],
  ]) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
  }
});

test("a refreshed deep link keeps the app mounted under its basename", async ({
  page,
}) => {
  await page.goto("/crm/contacts");
  await expect(
    page.getByRole("heading", { name: /Contacts/i }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Contacts/i }).first(),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/crm/contacts");
});

test("both API namespaces answer and stay separate", async ({
  page,
  baseURL,
}) => {
  const orgs = await page.request.get(`${baseURL}/api/crm/organizations`);
  expect(orgs.ok()).toBeTruthy();
  expect((await json<Organization[]>(orgs)).length).toBeGreaterThan(0);

  const tree = await page.request.get(`${baseURL}/api/space/tree`);
  expect(tree.ok()).toBeTruthy();
  expect((await json<TreeNode[]>(tree)).length).toBeGreaterThan(0);

  // The pre-merge, un-namespaced paths must not resolve.
  expect(
    (await page.request.get(`${baseURL}/api/organizations`)).status(),
  ).toBe(404);
  expect((await page.request.get(`${baseURL}/api/tree`)).status()).toBe(404);
});

test("the launcher links into each app and the back button returns", async ({
  page,
}) => {
  await page.goto("/");
  // Names are matched case-insensitively: the cards are uppercased by CSS, which the accessible
  // name computation does not apply.
  for (const name of ["CRM", "Space", "Groove"]) {
    await page.getByRole("link", { name: new RegExp(`^${name}`, "i") }).click();
    await expect(page).not.toHaveTitle("Bench");
    await page.goBack();
    await expect(page).toHaveTitle("Bench");
  }
});

test("each app boots without console errors", async ({ page }) => {
  for (const app of APPS) {
    const errors = watchErrors(page);
    await page.goto(app.path);
    await expect(app.ready(page)).toBeVisible();
    expect(errors, `${app.path} logged errors`).toEqual([]);
  }
});

test("every app has a Home link back to the launcher", async ({ page }) => {
  for (const path of ["/crm/", "/space/", "/groove/"]) {
    await page.goto(path);
    const home = page.getByRole("link", { name: "Home" });
    await expect(home, `${path} should offer a Home link`).toBeVisible();
    await home.click();
    await expect(page).toHaveTitle("Bench");
  }
});

test("each app keeps its own stylesheet", async ({ page }) => {
  // One bundle per document; if the apps ever share one, these backgrounds collide.
  await page.goto("/crm/");
  const crmSidebar = await page
    .locator(".sidebar")
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.goto("/groove/");
  const grooveBody = await page
    .locator("body")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(crmSidebar).not.toBe(grooveBody);
});
