import { describe, expect, it } from "vitest";
import {
  CHORD_SHAPES,
  NOTE_MAX,
  NOTE_MIN,
  VOICINGS,
  chordIntervals,
  clampIndex,
  clampNote,
  mtof,
  noteName,
} from "./music";

describe("noteName", () => {
  it("names the octave the way a keyboard does", () => {
    expect(noteName(60)).toBe("C4");
    expect(noteName(69)).toBe("A4");
    expect(noteName(61)).toBe("C#4");
    expect(noteName(24)).toBe("C1");
  });

  it("wraps negative numbers rather than indexing off the front", () => {
    expect(noteName(-1)).toBe("B-2");
  });
});

describe("mtof", () => {
  it("puts A4 at 440Hz and doubles an octave up", () => {
    expect(mtof(69)).toBeCloseTo(440, 6);
    expect(mtof(81)).toBeCloseTo(880, 6);
    expect(mtof(57)).toBeCloseTo(220, 6);
  });
});

describe("clampIndex", () => {
  it("rounds and holds the ends", () => {
    expect(clampIndex(2.4, 5)).toBe(2);
    expect(clampIndex(2.6, 5)).toBe(3);
    expect(clampIndex(-3, 5)).toBe(0);
    expect(clampIndex(99, 5)).toBe(4);
  });
});

describe("clampNote", () => {
  it("holds the playable range", () => {
    expect(clampNote(0)).toBe(NOTE_MIN);
    expect(clampNote(200)).toBe(NOTE_MAX);
    expect(clampNote(60)).toBe(60);
  });
});

describe("chordIntervals", () => {
  const minor = CHORD_SHAPES[0];

  it("is the bare triad at the lowest voicing", () => {
    expect(chordIntervals(0, 0)).toEqual(minor.intervals);
  });

  it("adds the seventh, then the ninth, as the voicing opens", () => {
    expect(chordIntervals(0, 1)).toEqual([...minor.intervals, minor.seventh]);
    expect(chordIntervals(0, 2)).toEqual([
      ...minor.intervals,
      minor.seventh,
      14,
    ]);
  });

  it("spreads the triad an octave for OPEN and stacks both for LUSH", () => {
    expect(chordIntervals(0, 3)).toEqual([
      ...minor.intervals,
      12,
      12 + minor.intervals[1],
    ]);
    expect(chordIntervals(0, 4)).toEqual([
      ...minor.intervals,
      minor.seventh,
      12,
      14,
    ]);
  });

  it("clamps a shape or voicing that is out of range", () => {
    expect(chordIntervals(99, 0)).toEqual(
      CHORD_SHAPES[CHORD_SHAPES.length - 1].intervals,
    );
    expect(chordIntervals(0, VOICINGS.length + 5)).toEqual(
      chordIntervals(0, VOICINGS.length - 1),
    );
  });

  it("keeps every shape in key: the first interval is always the root", () => {
    for (let i = 0; i < CHORD_SHAPES.length; i++) {
      expect(chordIntervals(i, 4)[0]).toBe(0);
    }
  });
});
