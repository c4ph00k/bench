import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatMoney } from "./format";

describe("formatMoney", () => {
  it("shows whole dollars", () => {
    expect(formatMoney(1234)).toBe("$1,234");
    expect(formatMoney(0)).toBe("$0");
  });

  it("rounds rather than showing cents", () => {
    expect(formatMoney(1234.56)).toBe("$1,235");
  });

  it("keeps the sign on a negative", () => {
    expect(formatMoney(-500)).toBe("-$500");
  });
});

describe("formatDate", () => {
  it("shows an em dash for nothing at all", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
  });

  it("reads a plain date in local time, not shifted by a timezone", () => {
    expect(formatDate("2026-03-04")).toBe("Mar 4, 2026");
  });

  it("accepts a SQLite timestamp and an ISO one alike", () => {
    expect(formatDate("2026-03-04 18:30:00")).toBe("Mar 4, 2026");
    expect(formatDate("2026-03-04T18:30:00")).toBe("Mar 4, 2026");
  });
});

describe("formatDateTime", () => {
  // The stored timestamp is UTC and this renders it locally, so the date can legitimately differ
  // by a day depending on where the machine is. The shape is what matters here.
  it("includes the time of day alongside the date", () => {
    expect(formatDateTime("2026-03-04 18:30:00")).toMatch(
      /^\w{3} \d{1,2}, 2026, \d{1,2}:\d{2} [AP]M$/,
    );
  });
});
