import { describe, expect, it } from "vitest";
import {
  FILTER_OPEN,
  filterGainAt,
  filterLabel,
  highpassHz,
  lowpassHz,
} from "./filter";

describe("lowpassHz", () => {
  it("is wide open at and above the midpoint", () => {
    expect(lowpassHz(FILTER_OPEN)).toBe(21000);
    expect(lowpassHz(1)).toBe(21000);
  });

  it("closes as the macro sweeps down", () => {
    expect(lowpassHz(0)).toBeCloseTo(80, 6);
    expect(lowpassHz(0.25)).toBeGreaterThan(80);
    expect(lowpassHz(0.25)).toBeLessThan(21000);
    expect(lowpassHz(0.1)).toBeLessThan(lowpassHz(0.4));
  });
});

describe("highpassHz", () => {
  it("is out of the way at and below the midpoint", () => {
    expect(highpassHz(FILTER_OPEN)).toBe(20);
    expect(highpassHz(0)).toBe(20);
  });

  it("opens as the macro sweeps up", () => {
    expect(highpassHz(1)).toBeCloseTo(13000, 6);
    expect(highpassHz(0.6)).toBeLessThan(highpassHz(0.9));
  });
});

describe("filterLabel", () => {
  it("reads OPEN through the detent either side of the midpoint", () => {
    expect(filterLabel(0.5)).toBe("OPEN");
    expect(filterLabel(0.49)).toBe("OPEN");
    expect(filterLabel(0.51)).toBe("OPEN");
  });

  it("names the side and the frequency once past the detent", () => {
    expect(filterLabel(0.2)).toMatch(/^LP /);
    expect(filterLabel(0.8)).toMatch(/^HP /);
  });

  it("switches to kHz above a thousand, losing the decimal past ten", () => {
    expect(filterLabel(0)).toBe("LP 80");
    expect(filterLabel(0.37)).toMatch(/^LP \d\.\dk$/);
    expect(filterLabel(0.48)).toMatch(/^LP \d{2}k$/);
    expect(filterLabel(1)).toBe("HP 13k");
  });
});

describe("filterGainAt", () => {
  it("passes everything through when the filter is open", () => {
    expect(filterGainAt(FILTER_OPEN, 0, 1000)).toBeCloseTo(1, 6);
  });

  it("cuts above the lowpass corner and leaves the low end alone", () => {
    const corner = lowpassHz(0.2);
    expect(filterGainAt(0.2, 0, corner * 8)).toBeLessThan(0.2);
    expect(filterGainAt(0.2, 0, corner / 8)).toBeCloseTo(1, 2);
  });

  it("cuts below the highpass corner", () => {
    const corner = highpassHz(0.8);
    expect(filterGainAt(0.8, 0, corner / 8)).toBeLessThan(0.2);
    expect(filterGainAt(0.8, 0, corner * 8)).toBeCloseTo(1, 2);
  });

  it("resonance lifts the gain around the corner", () => {
    const corner = lowpassHz(0.3);
    expect(filterGainAt(0.3, 1, corner)).toBeGreaterThan(
      filterGainAt(0.3, 0, corner),
    );
  });
});
