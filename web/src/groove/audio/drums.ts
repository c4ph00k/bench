import type { DrumLane, Params } from '../types'
import { saturationCurve } from './master'

interface Ctx {
  ctx: AudioContext
  dest: AudioNode
  noise: AudioBuffer
}

function env(ctx: AudioContext, t: number, peak: number, attack: number, decay: number): GainNode {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  return g
}

function noiseSource(c: Ctx, t: number, dur: number): AudioBufferSourceNode {
  const src = c.ctx.createBufferSource()
  src.buffer = c.noise
  src.loop = true
  // A random read position keeps repeated hits from sounding stamped out.
  src.start(t, Math.random() * 1.5, dur)
  src.stop(t + dur + 0.02)
  return src
}

function kick(c: Ctx, t: number, p: Params, gain: number) {
  const { ctx } = c
  const base = 36 + p.kickTune * 32
  const punch = p.kickPunch
  const decay = 0.1 + p.kickDecay * 0.8

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(base * (2.4 + punch * 9), t)
  osc.frequency.exponentialRampToValueAtTime(base, t + 0.012 + punch * 0.05)

  const shaper = ctx.createWaveShaper()
  shaper.curve = saturationCurve(0.25)
  shaper.oversample = '2x'

  const amp = env(ctx, t, gain * 1.15, 0.003, decay)
  osc.connect(shaper)
  shaper.connect(amp)
  amp.connect(c.dest)
  osc.start(t)
  osc.stop(t + decay + 0.1)

  if (p.kickSub > 0.001) {
    // a clean sine tail under the click, tuned to the kick's landing pitch
    const sub = ctx.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = base
    const subDecay = decay * 1.7
    const subAmp = env(ctx, t, gain * p.kickSub * 0.8, 0.008, subDecay)
    sub.connect(subAmp)
    subAmp.connect(c.dest)
    sub.start(t)
    sub.stop(t + subDecay + 0.1)
  }

  const click = noiseSource(c, t, 0.02)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 1400
  const clickAmp = env(ctx, t, gain * (0.1 + punch * 0.35), 0.001, 0.016)
  click.connect(hp)
  hp.connect(clickAmp)
  clickAmp.connect(c.dest)
}

function snare(c: Ctx, t: number, p: Params, gain: number) {
  const { ctx } = c
  const f1 = 148 + p.snareTune * 150
  const bodyDecay = 0.03 + p.snareDecay * 0.1
  const noiseDecay = 0.05 + p.snareDecay * 0.34
  const snap = p.snareSnap

  for (const [ratio, amt] of [
    [1, 0.6],
    [1.593, 0.4],
  ] as const) {
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(f1 * ratio * 1.35, t)
    osc.frequency.exponentialRampToValueAtTime(f1 * ratio, t + 0.02)
    const amp = env(ctx, t, gain * amt * (0.7 - snap * 0.35), 0.002, bodyDecay)
    osc.connect(amp)
    amp.connect(c.dest)
    osc.start(t)
    osc.stop(t + bodyDecay + 0.05)
  }

  const src = noiseSource(c, t, noiseDecay + 0.05)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1500 + snap * 2600
  bp.Q.value = 0.65
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 700 + snap * 700
  const amp = env(ctx, t, gain * (0.35 + snap * 0.5), 0.002, noiseDecay)
  src.connect(bp)
  bp.connect(hp)
  hp.connect(amp)
  amp.connect(c.dest)
}

function clap(c: Ctx, t: number, p: Params, gain: number) {
  const { ctx } = c
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1000 + p.snareSnap * 1500
  bp.Q.value = 1.4
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 600
  bp.connect(hp)
  hp.connect(c.dest)

  // three quick slaps then the room tail
  for (const [offset, dur, amt] of [
    [0, 0.014, 0.7],
    [0.011, 0.014, 0.85],
    [0.023, 0.016, 1],
  ] as const) {
    const src = noiseSource(c, t + offset, dur + 0.01)
    const amp = env(ctx, t + offset, gain * amt * 0.75, 0.001, dur)
    src.connect(amp)
    amp.connect(bp)
  }
  const tailDecay = 0.09 + p.snareDecay * 0.3
  const tail = noiseSource(c, t + 0.034, tailDecay + 0.05)
  const tailAmp = env(ctx, t + 0.034, gain * 0.55, 0.003, tailDecay)
  tail.connect(tailAmp)
  tailAmp.connect(bp)
}

const METAL_RATIOS = [2, 3, 4.16, 5.43, 6.79, 8.21]

function hat(c: Ctx, t: number, p: Params, gain: number, open: boolean) {
  const { ctx } = c
  const base = 40 * (0.72 + p.hatTone * 0.85)
  const decay = open ? 0.12 + p.hatDecay * 0.55 : 0.018 + p.hatDecay * 0.1

  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 9000 + p.hatTone * 2500
  bp.Q.value = 0.8
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 6200 + p.hatTone * 3200

  const amp = env(ctx, t, gain * 0.42, 0.001, decay)
  bp.connect(hp)
  hp.connect(amp)
  amp.connect(c.dest)

  for (const ratio of METAL_RATIOS) {
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = base * ratio
    osc.connect(bp)
    osc.start(t)
    osc.stop(t + decay + 0.05)
  }
}

function perc(c: Ctx, t: number, p: Params, gain: number) {
  const { ctx } = c
  const f = 260 + p.percTune * 1100
  const decay = 0.04 + p.percDecay * 0.5

  const carrier = ctx.createOscillator()
  carrier.type = 'sine'
  carrier.frequency.value = f

  const mod = ctx.createOscillator()
  mod.type = 'sine'
  mod.frequency.value = f * 1.71
  const modGain = ctx.createGain()
  modGain.gain.setValueAtTime(f * 3.5, t)
  modGain.gain.exponentialRampToValueAtTime(f * 0.05, t + decay * 0.6)
  mod.connect(modGain)
  modGain.connect(carrier.frequency)

  const amp = env(ctx, t, gain * 0.6, 0.002, decay)
  carrier.connect(amp)
  amp.connect(c.dest)
  carrier.start(t)
  mod.start(t)
  carrier.stop(t + decay + 0.08)
  mod.stop(t + decay + 0.08)
}

const LANE_LEVEL: Record<DrumLane, string> = {
  kick: 'lvKick',
  snare: 'lvSnare',
  clap: 'lvClap',
  hat: 'lvHat',
  ohat: 'lvOhat',
  perc: 'lvPerc',
}

export function triggerDrum(c: Ctx, lane: DrumLane, t: number, p: Params, accent: boolean) {
  const gain = (p[LANE_LEVEL[lane]] ?? 0.8) * (accent ? 1.35 : 0.85)
  if (gain <= 0.001) return
  switch (lane) {
    case 'kick':
      return kick(c, t, p, gain)
    case 'snare':
      return snare(c, t, p, gain)
    case 'clap':
      return clap(c, t, p, gain)
    case 'hat':
      return hat(c, t, p, gain, false)
    case 'ohat':
      return hat(c, t, p, gain, true)
    case 'perc':
      return perc(c, t, p, gain)
  }
}
