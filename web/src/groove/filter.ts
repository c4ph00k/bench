/**
 * DJ-style filter macro: 0.5 is wide open, sweeping down closes a resonant
 * lowpass, sweeping up opens a highpass. Shared by the audio graph, the knob
 * readout and the scope overlay so they always agree.
 */

const LP_MIN = 80
const LP_MAX = 21000
const HP_MIN = 20
const HP_MAX = 13000

export const FILTER_OPEN = 0.5

export function lowpassHz(macro: number): number {
  if (macro >= FILTER_OPEN) return LP_MAX
  return LP_MIN * Math.pow(LP_MAX / LP_MIN, macro / FILTER_OPEN)
}

export function highpassHz(macro: number): number {
  if (macro <= FILTER_OPEN) return HP_MIN
  return HP_MIN * Math.pow(HP_MAX / HP_MIN, (macro - FILTER_OPEN) / FILTER_OPEN)
}

function hz(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${Math.round(v)}`
}

export function filterLabel(macro: number): string {
  if (macro < 0.485) return `LP ${hz(lowpassHz(macro))}`
  if (macro > 0.515) return `HP ${hz(highpassHz(macro))}`
  return 'OPEN'
}

/** Normalised gain of the current filter at a given frequency, for the scope curve. */
export function filterGainAt(macro: number, reso: number, freq: number): number {
  const lp = lowpassHz(macro)
  const hp = highpassHz(macro)
  const q = 0.7 + reso * 14
  let g = 1
  if (lp < LP_MAX) {
    const r = freq / lp
    g *= 1 / Math.sqrt(1 + Math.pow(r, 8))
    if (r > 0.55 && r < 1.7) g *= 1 + (q / 14) * 1.6 * Math.exp(-Math.pow((r - 1) * 3.4, 2))
  }
  if (hp > HP_MIN) {
    const r = hp / freq
    g *= 1 / Math.sqrt(1 + Math.pow(r, 8))
    if (r > 0.55 && r < 1.7) g *= 1 + (q / 14) * 1.6 * Math.exp(-Math.pow((r - 1) * 3.4, 2))
  }
  return g
}
