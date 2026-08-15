import { describe, it, expect } from "vitest";
import {
  cadenceDays,
  computeStatus,
  CIRCLE_META,
} from "../../src/rolodex/cadence.js";
import type { Circle } from "../../src/rolodex/types.js";

const base = {
  circle: "close" as Circle,
  cadence_override_days: null,
  checkins_off: false,
  snoozed_until: null,
};
const T = "2026-06-15";

describe("cadence defaults", () => {
  it("maps circles to default cadences", () => {
    expect(cadenceDays({ ...base, circle: "inner" })).toBe(
      CIRCLE_META.inner.cadenceDays,
    );
    expect(CIRCLE_META.inner.cadenceDays).toBeLessThanOrEqual(31);
    expect(CIRCLE_META.close.cadenceDays).toBeGreaterThan(85);
    expect(CIRCLE_META.close.cadenceDays).toBeLessThan(95);
    expect(CIRCLE_META.wider.cadenceDays).toBeGreaterThan(170);
    expect(CIRCLE_META.wider.cadenceDays).toBeLessThan(195);
    expect(CIRCLE_META.distant.cadenceDays).toBeGreaterThan(360);
    expect(CIRCLE_META.distant.cadenceDays).toBeLessThan(370);
  });

  it("honours an individual override", () => {
    expect(cadenceDays({ ...base, cadence_override_days: 60 })).toBe(60);
  });

  it("returns null when check-ins are off", () => {
    expect(cadenceDays({ ...base, checkins_off: true })).toBeNull();
    expect(
      cadenceDays({ ...base, checkins_off: true, cadence_override_days: 30 }),
    ).toBeNull();
  });
});

describe("check-in status", () => {
  it("is in touch well inside the window", () => {
    const s = computeStatus({ ...base, circle: "inner" }, "2026-06-10", T);
    expect(s.status).toBe("in_touch");
    expect(s.nextDue).toBe("2026-07-10");
  });

  it("is due soon within the final week", () => {
    const s = computeStatus({ ...base, circle: "inner" }, "2026-05-18", T); // due 2026-06-17
    expect(s.status).toBe("due_soon");
    expect(s.nextDue).toBe("2026-06-17");
  });

  it("is due soon on the due date itself", () => {
    const s = computeStatus({ ...base, circle: "inner" }, "2026-05-16", T); // due exactly today
    expect(s.status).toBe("due_soon");
  });

  it("is overdue past the due date, and reports days overdue", () => {
    const s = computeStatus({ ...base, circle: "inner" }, "2026-04-15", T); // due 2026-05-15
    expect(s.status).toBe("overdue");
    expect(s.daysOverdue).toBe(31);
  });

  it("uses the override cadence instead of the circle default", () => {
    // close = 91 days, overridden to 10
    const dueSoon = computeStatus(
      { ...base, cadence_override_days: 10 },
      "2026-06-08",
      T,
    ); // due 2026-06-18, 3 days away
    expect(dueSoon.status).toBe("due_soon");
    const overdue = computeStatus(
      { ...base, cadence_override_days: 10 },
      "2026-06-01",
      T,
    ); // due 2026-06-11
    expect(overdue.status).toBe("overdue");
    // without the override both would be comfortably in touch (91-day cadence)
    expect(computeStatus({ ...base }, "2026-06-01", T).status).toBe("in_touch");
  });

  it("treats never-contacted people as due from today", () => {
    const s = computeStatus({ ...base }, null, T);
    expect(s.status).toBe("due_soon"); // due today, inside the week window
    expect(s.nextDue).toBe(T);
  });

  it("is off when check-ins are disabled", () => {
    const s = computeStatus({ ...base, checkins_off: true }, "2024-01-01", T);
    expect(s.status).toBe("off");
    expect(s.nextDue).toBeNull();
  });

  it("is snoozed until the snooze date, including the day itself", () => {
    const s = computeStatus(
      { ...base, snoozed_until: "2026-08-01" },
      "2026-01-01",
      T,
    );
    expect(s.status).toBe("snoozed");
    const onDay = computeStatus({ ...base, snoozed_until: T }, "2026-01-01", T);
    expect(onDay.status).toBe("snoozed");
  });

  it("stops being snoozed the day after the snooze date", () => {
    const s = computeStatus(
      { ...base, snoozed_until: "2026-06-14" },
      "2026-01-01",
      T,
    );
    expect(s.status).toBe("overdue"); // due 2026-04-02 (91 days), long past
  });

  it("an expired snooze on an otherwise in-touch person falls back to in_touch", () => {
    const s = computeStatus(
      { ...base, snoozed_until: "2026-06-14" },
      "2026-06-10",
      T,
    );
    expect(s.status).toBe("in_touch");
  });

  it("logging an interaction resets the clock", () => {
    const before = computeStatus({ ...base, circle: "inner" }, "2026-04-01", T);
    expect(before.status).toBe("overdue");
    const after = computeStatus({ ...base, circle: "inner" }, "2026-06-15", T);
    expect(after.status).toBe("in_touch");
  });
});
