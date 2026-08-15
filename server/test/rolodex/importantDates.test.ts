import { describe, it, expect } from "vitest";
import {
  nextOccurrence,
  upcomingDates,
  datesInMonth,
  currentAge,
  effectiveDay,
  isLeapYear,
} from "../../src/rolodex/importantDates.js";

const T = "2026-08-14";
const mk = (
  month: number,
  day: number,
  year: number | null,
  name = "Test Person",
) => ({
  id: 1,
  person_id: 1,
  type: "birthday" as const,
  label: null,
  month,
  day,
  year,
  created_at: "",
  person_name: name,
});

describe("recurring date arithmetic", () => {
  it("finds the next occurrence later this year", () => {
    expect(nextOccurrence({ month: 9, day: 3, year: null }, T).date).toBe(
      "2026-09-03",
    );
  });

  it("rolls over into next calendar year once passed", () => {
    expect(nextOccurrence({ month: 1, day: 23, year: null }, T).date).toBe(
      "2027-01-23",
    );
  });

  it("handles today as the next occurrence", () => {
    const occ = nextOccurrence({ month: 8, day: 14, year: null }, T);
    expect(occ.date).toBe("2026-08-14");
  });

  it("computes age turning and flags milestones", () => {
    const occ = nextOccurrence({ month: 11, day: 12, year: 1986 }, T); // Sam turns 40 on 2026-11-12
    expect(occ.date).toBe("2026-11-12");
    expect(occ.ageTurning).toBe(40);
    expect(occ.milestone).toBe(true);
    const notMilestone = nextOccurrence({ month: 6, day: 21, year: 1989 }, T); // turns 37
    expect(notMilestone.milestone).toBe(false);
  });

  it("returns no age when the year is unknown", () => {
    const occ = nextOccurrence({ month: 9, day: 3, year: null }, T);
    expect(occ.ageTurning).toBeNull();
    expect(occ.milestone).toBe(false);
  });

  describe("29 February birthdays", () => {
    it("celebrates on 28 February in a non-leap year", () => {
      // 2027 is not a leap year
      expect(
        nextOccurrence({ month: 2, day: 29, year: 1996 }, "2026-09-01").date,
      ).toBe("2027-02-28");
    });

    it("celebrates on 29 February in a leap year", () => {
      expect(
        nextOccurrence({ month: 2, day: 29, year: 1996 }, "2028-01-01").date,
      ).toBe("2028-02-29");
    });

    it("uses 29 Feb itself when today is in a leap year and before the day", () => {
      expect(
        nextOccurrence({ month: 2, day: 29, year: 1996 }, "2028-03-01").date,
      ).toBe("2029-02-28");
    });

    it("does not crash or disappear in datesInMonth", () => {
      const events = datesInMonth([mk(2, 29, 1996)], 2027, 2);
      expect(events).toHaveLength(1);
      expect(events[0].date).toBe("2027-02-28");
    });

    it("effectiveDay and isLeapYear behave", () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2027)).toBe(false);
      expect(isLeapYear(1900)).toBe(false);
      expect(isLeapYear(2000)).toBe(true);
      expect(effectiveDay(2, 29, 2027)).toBe(28);
      expect(effectiveDay(2, 29, 2028)).toBe(29);
      expect(effectiveDay(3, 15, 2027)).toBe(15);
    });
  });
});

describe("upcoming dates window", () => {
  it("includes dates within the window, sorted soonest first", () => {
    const dates = [
      mk(8, 20, null, "A"),
      mk(9, 10, null, "B"),
      mk(12, 25, null, "C"),
    ];
    const up = upcomingDates(dates, 30, T);
    expect(up.map((d) => d.person_name)).toEqual(["A", "B"]);
    expect(up[0].days_away).toBe(6);
  });

  it("includes a date exactly on the horizon", () => {
    expect(upcomingDates([mk(9, 13, null)], 30, T)).toHaveLength(1);
  });

  it("excludes dates beyond the window", () => {
    expect(upcomingDates([mk(9, 14, null)], 30, T)).toHaveLength(0);
  });
});

describe("calendar month grid", () => {
  it("lists dates in a given month with the right days", () => {
    const dates = [mk(8, 14, 1979, "Byrne"), mk(8, 30, 1994, "Elena")];
    const events = datesInMonth(dates, 2026, 8);
    expect(events.map((e) => e.day)).toEqual([14, 30]);
    expect(events[0].age_turning).toBe(47);
  });

  it("returns nothing for other months", () => {
    expect(datesInMonth([mk(8, 14, 1979)], 2026, 9)).toHaveLength(0);
  });

  it("works across a year boundary", () => {
    const dec = datesInMonth([mk(12, 31, null, "NYE")], 2026, 12);
    const jan = datesInMonth([mk(1, 1, null, "New Year")], 2027, 1);
    expect(dec[0].date).toBe("2026-12-31");
    expect(jan[0].date).toBe("2027-01-01");
  });
});

describe("current age", () => {
  it("is one less before the birthday, exact on it, after it stays", () => {
    const d = { month: 8, day: 14, year: 1979 };
    expect(currentAge(d, "2026-08-13")).toBe(46);
    expect(currentAge(d, "2026-08-14")).toBe(47);
    expect(currentAge(d, "2026-08-15")).toBe(47);
  });

  it("handles year boundaries", () => {
    expect(currentAge({ month: 1, day: 1, year: 1990 }, "2026-06-01")).toBe(36);
    expect(currentAge({ month: 12, day: 31, year: 1990 }, "2026-06-01")).toBe(
      35,
    );
  });

  it("returns null without a year", () => {
    expect(currentAge({ month: 8, day: 14, year: null }, T)).toBeNull();
  });
});
