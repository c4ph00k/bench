/**
 * Groove is a Web Audio instrument, so these tests are deliberately shallow: they prove the
 * sequencer runs and the controls respond, never that it sounds right. Audio quality is a
 * manual check - see e2e/EXPLORATORY.md.
 *
 * The playhead LED is the honest proxy for "the clock is running": it is driven by the same
 * transport that schedules the audio, without reaching into the audio graph.
 */
import { test, expect } from "../fixtures";
import type { Page } from "@playwright/test";

const UNITS = ["RHYTHM", "BASS", "PADS", "LEAD"];

/** Index of the lit step in the master LED strip, or -1 when the transport is stopped. */
function playhead(page: Page): Promise<number> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll(".master-leds .led")).findIndex((el) =>
      el.className.includes("on"),
    ),
  );
}

const transport = (page: Page) =>
  page.getByRole("button", { name: /(PLAY|STOP)/ });

test("the instrument boots with all four units", async ({ page }) => {
  await page.goto("/groove/");
  for (const unit of UNITS) {
    await expect(page.getByRole("region", { name: unit })).toBeVisible();
  }
  await expect(transport(page)).toContainText("PLAY");
});

test("the transport starts and stops, and the playhead follows it", async ({
  page,
}) => {
  await page.goto("/groove/");
  expect(await playhead(page)).toBe(-1);

  await transport(page).click();
  await expect(transport(page)).toContainText("STOP");

  // The clock is running if a step lights at all, then moves on.
  await expect
    .poll(() => playhead(page), { timeout: 5000 })
    .toBeGreaterThanOrEqual(0);
  const first = await playhead(page);
  await expect.poll(() => playhead(page), { timeout: 5000 }).not.toBe(first);

  await transport(page).click();
  await expect(transport(page)).toContainText("PLAY");
  await expect.poll(() => playhead(page), { timeout: 3000 }).toBe(-1);
});

test("drum steps are individually addressable and toggle through their states", async ({
  page,
}) => {
  await page.goto("/groove/");
  const step = page.getByRole("button", { name: "KICK step 3", exact: true });
  await expect(step).toBeVisible();

  const before = await step.getAttribute("aria-pressed");
  await step.click();
  await expect(step).not.toHaveAttribute("aria-pressed", before!);
});

test("melodic steps carry their unit name so the four grids stay distinguishable", async ({
  page,
}) => {
  await page.goto("/groove/");
  for (const unit of ["BASS", "PADS", "LEAD"]) {
    await expect(
      page.getByRole("button", { name: `${unit} step 1`, exact: true }),
    ).toHaveCount(1);
  }
});

test("switching patches changes the tempo", async ({ page }) => {
  await page.goto("/groove/");
  const bpm = () =>
    page.evaluate(() => /(\d+)BPM/.exec(document.body.textContent)?.[1]);

  const first = await bpm();
  await page.getByRole("button", { name: /BASALT/ }).click();
  await expect.poll(bpm, { timeout: 3000 }).not.toBe(first);
});

test("a unit can be muted and unmuted", async ({ page }) => {
  await page.goto("/groove/");
  const rhythm = page.getByRole("region", { name: "RHYTHM" });
  await rhythm.getByRole("button", { name: "MUTE" }).click();
  await expect(rhythm).toHaveClass(/muted/);
  await rhythm.getByRole("button", { name: "MUTE" }).click();
  await expect(rhythm).not.toHaveClass(/muted/);
});

test("running the sequencer logs no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/groove/");
  await transport(page).click();
  await page.waitForTimeout(2000);
  await transport(page).click();

  expect(errors).toEqual([]);
});
