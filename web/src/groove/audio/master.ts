import type { UnitId } from "../types";
import { UNIT_IDS } from "../types";
import { highpassHz, lowpassHz } from "../filter";

export interface UnitChannel {
  /** voices connect here */
  input: GainNode;
  level: GainNode;
  mute: GainNode;
  reverbSend: GainNode;
  delaySend: GainNode;
}

/** Soft saturation curve; drive 0 is close to linear, 1 is heavily folded. */
export function saturationCurve(drive: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(n);
  // A low floor keeps drive 0 transparent; tanh normalisation preserves the
  // peak, so the partial makeup below stops it turning into a loudness knob.
  const k = 0.3 + drive * 14;
  const norm = Math.tanh(k);
  const makeup = 1 / (1 + drive * 1.6);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = (Math.tanh(x * k) / norm) * makeup;
  }
  return curve;
}

/** Amplitude quantisation. amount 0 is transparent, 1 crushes to ~3 bits. */
function crushCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 8192;
  const curve = new Float32Array(n);
  const bits = 16 - amount * 13;
  const levels = Math.pow(2, bits) / 2;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.round(x * levels) / levels;
  }
  return curve;
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** Exponentially decaying stereo noise burst, used as the reverb impulse. */
function impulseResponse(ctx: AudioContext, size: number): AudioBuffer {
  const seconds = 0.6 + size * 3.4;
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  const decay = 2.2 + size * 2.5;
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const attack = Math.min(1, i / (ctx.sampleRate * 0.012));
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * attack;
    }
  }
  return buf;
}

export class Master {
  readonly ctx: AudioContext;
  readonly channels: Record<UnitId, UnitChannel>;
  readonly noise: AudioBuffer;
  readonly out: GainNode;
  readonly analyser: AnalyserNode;

  private convolver: ConvolverNode;
  private reverbIn: GainNode;
  private delayL: DelayNode;
  private delayR: DelayNode;
  private feedback: GainNode;
  private feedbackTone: BiquadFilterNode;
  private shaper: WaveShaperNode;
  private drumCrush: WaveShaperNode;
  private drumDrive: WaveShaperNode;
  private drumMakeup: GainNode;
  /** everything except the drums, so the kick punches through the duck */
  private pump: GainNode;
  private lp1: BiquadFilterNode;
  private lp2: BiquadFilterNode;
  private hp1: BiquadFilterNode;
  private hp2: BiquadFilterNode;
  private filterBite: WaveShaperNode;

  private reverbSize = -1;
  private drive = -1;
  private crush = -1;
  private dcrush = -1;
  private bite = -1;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.noise = noiseBuffer(ctx);

    this.out = ctx.createGain();
    this.out.gain.value = 0.8;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.72;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 18;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.006;
    comp.release.value = 0.18;

    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = saturationCurve(0.12);
    this.shaper.oversample = "4x";

    // Master DJ filter: two lowpass and two highpass stages for a steep,
    // singing slope. Both sit across the whole mix, sends included.
    this.lp1 = ctx.createBiquadFilter();
    this.lp1.type = "lowpass";
    this.lp2 = ctx.createBiquadFilter();
    this.lp2.type = "lowpass";
    this.hp1 = ctx.createBiquadFilter();
    this.hp1.type = "highpass";
    this.hp2 = ctx.createBiquadFilter();
    this.hp2.type = "highpass";
    this.filterBite = ctx.createWaveShaper();
    this.filterBite.curve = saturationCurve(0.05);
    this.filterBite.oversample = "2x";

    const sum = ctx.createGain();
    // headroom: the filter, saturator and bus compressor all sit downstream
    sum.gain.value = 0.8;
    sum.connect(this.lp1);
    this.lp1.connect(this.lp2);
    this.lp2.connect(this.hp1);
    this.hp1.connect(this.hp2);
    this.hp2.connect(this.filterBite);
    this.filterBite.connect(this.shaper);
    this.shaper.connect(comp);
    comp.connect(this.out);
    this.out.connect(this.analyser);
    this.out.connect(ctx.destination);
    this.setFilter(0.5, 0, 0);

    // Reverb return
    this.reverbIn = ctx.createGain();
    this.convolver = ctx.createConvolver();
    const reverbDamp = ctx.createBiquadFilter();
    reverbDamp.type = "highpass";
    reverbDamp.frequency.value = 220;
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 0.9;
    this.reverbIn.connect(this.convolver);
    this.convolver.connect(reverbDamp);
    reverbDamp.connect(reverbReturn);
    reverbReturn.connect(sum);
    this.setReverbSize(0.5);

    // Ping-pong delay return
    const delayIn = ctx.createGain();
    this.delayL = ctx.createDelay(2);
    this.delayR = ctx.createDelay(2);
    this.feedback = ctx.createGain();
    this.feedbackTone = ctx.createBiquadFilter();
    this.feedbackTone.type = "lowpass";
    this.feedbackTone.frequency.value = 2600;
    const panL = ctx.createStereoPanner();
    panL.pan.value = -0.75;
    const panR = ctx.createStereoPanner();
    panR.pan.value = 0.75;
    delayIn.connect(this.delayL);
    this.delayL.connect(panL);
    this.delayL.connect(this.delayR);
    this.delayR.connect(panR);
    this.delayR.connect(this.feedbackTone);
    this.feedbackTone.connect(this.feedback);
    this.feedback.connect(this.delayL);
    panL.connect(sum);
    panR.connect(sum);
    this.setDelay(0.28, 0.34, 0.5);

    this.pump = ctx.createGain();
    this.pump.connect(sum);

    this.drumCrush = ctx.createWaveShaper();
    this.drumCrush.curve = crushCurve(0);
    this.drumDrive = ctx.createWaveShaper();
    this.drumDrive.curve = saturationCurve(0.1);
    this.drumDrive.oversample = "2x";
    this.drumMakeup = ctx.createGain();
    this.drumCrush.connect(this.drumDrive);
    this.drumDrive.connect(this.drumMakeup);

    this.channels = {} as Record<UnitId, UnitChannel>;
    for (const id of UNIT_IDS) {
      const input = ctx.createGain();
      const level = ctx.createGain();
      const mute = ctx.createGain();
      const reverbSend = ctx.createGain();
      const delaySend = ctx.createGain();
      reverbSend.gain.value = 0;
      delaySend.gain.value = 0;
      if (id === "drums") {
        input.connect(this.drumCrush);
        this.drumMakeup.connect(level);
      } else {
        input.connect(level);
      }
      level.connect(mute);
      mute.connect(id === "drums" ? sum : this.pump);
      // sends are taken pre-pump so tails stay smooth through the duck
      mute.connect(reverbSend);
      mute.connect(delaySend);
      reverbSend.connect(this.reverbIn);
      delaySend.connect(delayIn);
      this.channels[id] = { input, level, mute, reverbSend, delaySend };
    }
  }

  setReverbSize(size: number) {
    const rounded = Math.round(size * 20) / 20;
    if (rounded === this.reverbSize) return;
    this.reverbSize = rounded;
    this.convolver.buffer = impulseResponse(this.ctx, rounded);
  }

  setDelay(timeSec: number, feedback: number, tone: number) {
    const t = this.ctx.currentTime;
    this.delayL.delayTime.setTargetAtTime(timeSec, t, 0.05);
    this.delayR.delayTime.setTargetAtTime(timeSec, t, 0.05);
    this.feedback.gain.setTargetAtTime(Math.min(0.85, feedback), t, 0.02);
    this.feedbackTone.frequency.setTargetAtTime(600 + tone * 6400, t, 0.02);
  }

  /**
   * Moves the DJ filter. Pass a time and duration to ramp along with the
   * sequencer so long sweeps stay smooth; omit them to follow a knob.
   */
  setFilter(macro: number, reso: number, bite: number, at?: number, ramp = 0) {
    const lp = lowpassHz(macro);
    const hp = highpassHz(macro);
    const q = 0.7 + reso * 14;
    const t = at ?? this.ctx.currentTime;
    for (const [f, hzValue, resonant] of [
      [this.lp1, lp, true],
      [this.lp2, lp, false],
      [this.hp1, hp, true],
      [this.hp2, hp, false],
    ] as const) {
      if (ramp > 0) {
        f.frequency.linearRampToValueAtTime(hzValue, t + ramp);
      } else {
        f.frequency.cancelScheduledValues(t);
        f.frequency.setTargetAtTime(hzValue, t, 0.01);
      }
      f.Q.setTargetAtTime(resonant ? q : 0.6, t, 0.02);
    }
    const rounded = Math.round(bite * 30) / 30;
    if (rounded !== this.bite) {
      this.bite = rounded;
      this.filterBite.curve = saturationCurve(0.05 + rounded * 0.7);
    }
  }

  /** Ducks everything but the drums, the classic four-to-the-floor pump. */
  duck(at: number, depth: number, release: number) {
    const g = this.pump.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(Math.max(0.02, 1 - depth), at);
    g.linearRampToValueAtTime(1, at + release);
  }

  setPumpIdle(depth: number) {
    if (depth <= 0.001)
      this.pump.gain.setTargetAtTime(1, this.ctx.currentTime, 0.02);
  }

  /** Drops any automation still queued past the transport stopping. */
  resetDynamics() {
    const t = this.ctx.currentTime;
    this.pump.gain.cancelScheduledValues(t);
    this.pump.gain.setTargetAtTime(1, t, 0.02);
    for (const f of [this.lp1, this.lp2, this.hp1, this.hp2])
      f.frequency.cancelScheduledValues(t);
  }

  setDrumTone(crush: number, drive: number) {
    const c = Math.round(crush * 25) / 25;
    if (c !== this.crush) {
      this.crush = c;
      this.drumCrush.curve = crushCurve(c);
    }
    const d = Math.round(drive * 25) / 25;
    if (d !== this.dcrush) {
      this.dcrush = d;
      this.drumDrive.curve = saturationCurve(0.05 + d * 0.45);
      // saturation lifts average level hard; trim it back so DRIVE changes
      // character rather than loudness
      this.drumMakeup.gain.setTargetAtTime(
        1 / (1 + d * 0.5),
        this.ctx.currentTime,
        0.02,
      );
    }
  }

  setMasterDrive(drive: number) {
    const rounded = Math.round(drive * 50) / 50;
    if (rounded === this.drive) return;
    this.drive = rounded;
    this.shaper.curve = saturationCurve(rounded);
  }

  setVolume(v: number) {
    this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  setMute(id: UnitId, muted: boolean) {
    const g = this.channels[id].mute.gain;
    g.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.012);
  }
}
