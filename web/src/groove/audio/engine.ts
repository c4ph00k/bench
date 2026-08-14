import type { MelodicStep, Patch, UnitId } from '../types'
import { DRUM_LANES, STEPS, SWEEP_BARS, UNIT_IDS } from '../types'
import { Master } from './master'
import { triggerDrum } from './drums'
import { MonoSynth, PadSynth } from './synths'

export interface EngineState {
  patch: Patch
  mutes: Record<UnitId, boolean>
  volume: number
}

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.12

/** Steps until the next active step, wrapping the loop. Used for note length. */
function gapToNext(steps: MelodicStep[], from: number): number {
  for (let i = 1; i <= STEPS; i++) {
    if (steps[(from + i) % STEPS].on) return i
  }
  return STEPS
}

/** Sweep shapes: rise, fall, triangle, sine. 0 is fully closed, 1 fully open. */
function sweepValue(phase: number, shape: number): number {
  switch (Math.round(shape)) {
    case 1:
      return 1 - phase
    case 2:
      return phase < 0.5 ? phase * 2 : 2 - phase * 2
    case 3:
      return 0.5 - Math.cos(phase * Math.PI * 2) / 2
    default:
      return phase
  }
}

export class Engine {
  readonly ctx: AudioContext
  private master: Master
  private bass = new MonoSynth('bass')
  private lead = new MonoSynth('lead')
  private pads = new PadSynth()

  private timer: number | null = null
  private raf: number | null = null
  private nextGridTime = 0
  private step = 0
  /** never wraps, so multi-bar sweeps stay in phase */
  private absStep = 0
  private queue: { step: number; time: number; filter: number; phase: number }[] = []

  playing = false
  onStep: (step: number) => void = () => {}
  /** last scheduled filter macro and sweep phase, read by the scope */
  filterMacro = 0.5
  sweepPhase = 0

  constructor(private getState: () => EngineState) {
    this.ctx = new AudioContext({ latencyHint: 'interactive' })
    this.master = new Master(this.ctx)
    this.applyParams(getState())
  }

  get analyser() {
    return this.master.analyser
  }

  async resume() {
    if (this.ctx.state !== 'running') await this.ctx.resume()
  }

  start() {
    if (this.playing) return
    this.playing = true
    this.step = 0
    this.absStep = 0
    this.queue = []
    this.bass.reset()
    this.lead.reset()
    this.nextGridTime = this.ctx.currentTime + 0.06
    this.timer = window.setInterval(this.tick, LOOKAHEAD_MS)
    this.tick()
    this.raf = requestAnimationFrame(this.draw)
  }

  stop() {
    if (!this.playing) return
    this.playing = false
    if (this.timer !== null) clearInterval(this.timer)
    if (this.raf !== null) cancelAnimationFrame(this.raf)
    this.timer = null
    this.raf = null
    this.queue = []
    this.step = 0
    this.sweepPhase = 0
    this.onStep(-1)
    this.master.resetDynamics()
    this.applyParams(this.getState())
  }

  /** Pushes live control changes into the audio graph. */
  applyParams(s: EngineState) {
    const { patch } = s
    const m = patch.master
    const t = this.ctx.currentTime
    this.master.setVolume(s.volume)
    this.master.setReverbSize(m.reverbSize)
    const secPerStep = 15 / patch.bpm
    this.master.setDelay(m.delaySteps * secPerStep, m.delayFeedback, m.delayTone)
    this.master.setMasterDrive(0.04 + m.drive * 0.2)
    this.master.setDrumTone(patch.drums.params.crush, patch.drums.params.drive)
    this.master.setPumpIdle(m.pump)
    for (const id of UNIT_IDS) {
      const p = patch[id].params
      const ch = this.master.channels[id]
      ch.level.gain.setTargetAtTime(p.level ?? 0.8, t, 0.02)
      ch.reverbSend.gain.setTargetAtTime((p.space ?? 0) * 0.55, t, 0.02)
      ch.delaySend.gain.setTargetAtTime((p.echo ?? 0) * 0.6, t, 0.02)
      this.master.setMute(id, s.mutes[id])
    }
    if (!this.playing) {
      this.filterMacro = m.filter
      this.master.setFilter(m.filter, m.filterReso, m.filterDrive)
    }
  }

  auditionDrum(lane: (typeof DRUM_LANES)[number], accent: boolean) {
    const s = this.getState()
    if (s.mutes.drums) return
    void this.resume()
    triggerDrum(this.drumCtx(), lane, this.ctx.currentTime + 0.01, s.patch.drums.params, accent)
  }

  auditionNote(unit: 'bass' | 'lead' | 'pads', step: MelodicStep) {
    const s = this.getState()
    if (s.mutes[unit]) return
    void this.resume()
    const t = this.ctx.currentTime + 0.01
    const p = s.patch[unit].params
    const dest = this.master.channels[unit].input
    if (unit === 'pads') this.pads.trigger({ ctx: this.ctx, dest }, t, step.note, step.chord, 0.6, step.vel, p)
    else if (unit === 'bass') this.bass.trigger({ ctx: this.ctx, dest }, t, step.note, 0.4, step.vel, p)
    else this.lead.trigger({ ctx: this.ctx, dest }, t, step.note, 0.4, step.vel, p)
  }

  private drumCtx() {
    return { ctx: this.ctx, dest: this.master.channels.drums.input, noise: this.master.noise }
  }

  /** Effective filter position at a given absolute step, including the sweep. */
  private filterAt(absStep: number, m: Patch['master']) {
    const bars = SWEEP_BARS[Math.round(m.sweepBars)] ?? 0
    if (!bars || m.sweepDepth <= 0.001) return { macro: m.filter, phase: 0 }
    const phase = (absStep % (bars * STEPS)) / (bars * STEPS)
    const open = sweepValue(phase, m.sweepShape)
    const macro = Math.max(0, Math.min(1, m.filter - m.sweepDepth * (1 - open)))
    return { macro, phase }
  }

  private tick = () => {
    const s = this.getState()
    this.applyParams(s)
    const secPerStep = 15 / s.patch.bpm
    const swing = s.patch.swing * 0.66
    const m = s.patch.master

    while (this.nextGridTime < this.ctx.currentTime + SCHEDULE_AHEAD) {
      const time = this.nextGridTime + (this.step % 2 === 1 ? swing * secPerStep : 0)
      const { macro, phase } = this.filterAt(this.absStep, m)
      this.master.setFilter(macro, m.filterReso, m.filterDrive, this.nextGridTime, secPerStep)
      this.scheduleStep(this.step, time, secPerStep, s)
      this.queue.push({ step: this.step, time, filter: macro, phase })
      this.nextGridTime += secPerStep
      this.step = (this.step + 1) % STEPS
      this.absStep++
    }
  }

  private scheduleStep(step: number, time: number, secPerStep: number, s: EngineState) {
    const { patch, mutes } = s
    const drums = patch.drums

    if (drums.steps.kick[step] && patch.master.pump > 0.001) {
      this.master.duck(time, patch.master.pump * 0.92, 0.04 + patch.master.pumpTime * 0.5)
    }

    if (!mutes.drums) {
      for (const lane of DRUM_LANES) {
        const v = drums.steps[lane][step]
        if (v) triggerDrum(this.drumCtx(), lane, time, drums.params, v === 2)
      }
    }

    for (const unit of ['bass', 'lead'] as const) {
      if (mutes[unit]) continue
      const cell = patch[unit].steps[step]
      if (!cell.on) continue
      const dur = gapToNext(patch[unit].steps, step) * secPerStep
      const dest = this.master.channels[unit].input
      const synth = unit === 'bass' ? this.bass : this.lead
      synth.trigger({ ctx: this.ctx, dest }, time, cell.note, dur, cell.vel, patch[unit].params)
    }

    if (!mutes.pads) {
      const cell = patch.pads.steps[step]
      if (cell.on) {
        const gate = gapToNext(patch.pads.steps, step) * secPerStep
        this.pads.trigger(
          { ctx: this.ctx, dest: this.master.channels.pads.input },
          time,
          cell.note,
          cell.chord,
          gate,
          cell.vel,
          patch.pads.params,
        )
      }
    }
  }

  private draw = () => {
    const now = this.ctx.currentTime
    let current = -1
    while (this.queue.length && this.queue[0].time <= now) {
      const item = this.queue.shift()!
      current = item.step
      this.filterMacro = item.filter
      this.sweepPhase = item.phase
    }
    if (current >= 0) this.onStep(current)
    this.raf = requestAnimationFrame(this.draw)
  }
}
