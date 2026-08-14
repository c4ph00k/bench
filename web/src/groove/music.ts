const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

export const NOTE_MIN = 24;
export const NOTE_MAX = 96;

/** MIDI number to a display name such as "F#2". */
export function noteName(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

export function mtof(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export interface ChordShape {
  name: string;
  intervals: number[];
  seventh: number;
}

export const CHORD_SHAPES: ChordShape[] = [
  { name: "min", intervals: [0, 3, 7], seventh: 10 },
  { name: "maj", intervals: [0, 4, 7], seventh: 11 },
  { name: "sus", intervals: [0, 5, 7], seventh: 10 },
  { name: "dim", intervals: [0, 3, 6], seventh: 9 },
  { name: "aug", intervals: [0, 4, 8], seventh: 11 },
];

export const VOICINGS = ["TRIAD", "SEVENTH", "NINTH", "OPEN", "LUSH"];

/**
 * Builds the interval set for a chord, colouring the patch-defined shape with
 * the unit's global voicing knob so every setting stays in key.
 */
export function chordIntervals(shapeIndex: number, voicing: number): number[] {
  const shape = CHORD_SHAPES[clampIndex(shapeIndex, CHORD_SHAPES.length)];
  const base = shape.intervals;
  switch (clampIndex(voicing, VOICINGS.length)) {
    case 1:
      return [...base, shape.seventh];
    case 2:
      return [...base, shape.seventh, 14];
    case 3:
      return [...base, 12, 12 + base[1]];
    case 4:
      return [...base, shape.seventh, 12, 14];
    default:
      return base;
  }
}

export function clampIndex(v: number, length: number): number {
  return Math.max(0, Math.min(length - 1, Math.round(v)));
}

export function clampNote(n: number): number {
  return Math.max(NOTE_MIN, Math.min(NOTE_MAX, n));
}
