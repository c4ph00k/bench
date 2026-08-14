import type { Params } from "../types";
import { chordIntervals, mtof } from "../music";
import { saturationCurve } from "./master";

export interface VoiceCtx {
  ctx: AudioContext;
  dest: AudioNode;
}

const pulseCache = new Map<string, PeriodicWave>();

/** Band-limited pulse wave for a given duty cycle. */
function pulseWave(ctx: AudioContext, duty: number): PeriodicWave {
  const key = duty.toFixed(2);
  const cached = pulseCache.get(key);
  if (cached) return cached;
  const n = 48;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let h = 1; h < n; h++) {
    imag[h] = (2 / (h * Math.PI)) * Math.sin(h * Math.PI * duty);
  }
  const wave = ctx.createPeriodicWave(real, imag, {
    disableNormalization: false,
  });
  pulseCache.set(key, wave);
  return wave;
}

/** Two cascaded lowpass stages give a steeper, more analog-sounding slope. */
function ladder(ctx: AudioContext, reso: number) {
  const a = ctx.createBiquadFilter();
  a.type = "lowpass";
  a.Q.value = 0.6 + reso * 17;
  const b = ctx.createBiquadFilter();
  b.type = "lowpass";
  b.Q.value = 0.5;
  a.connect(b);
  return { input: a, output: b, freqs: [a.frequency, b.frequency] };
}

function sweep(
  freqs: AudioParam[],
  t: number,
  from: number,
  to: number,
  time: number,
) {
  for (const f of freqs) {
    f.setValueAtTime(from, t);
    f.exponentialRampToValueAtTime(to, t + time);
  }
}

const cutoffHz = (v: number) => 80 * Math.pow(2, v * 7);

export class MonoSynth {
  private last: number | null = null;

  constructor(private readonly flavour: "bass" | "lead") {}

  reset() {
    this.last = null;
  }

  trigger(
    c: VoiceCtx,
    t: number,
    note: number,
    dur: number,
    vel: number,
    p: Params,
  ) {
    const { ctx } = c;
    const freq = mtof(note);
    const glide = p.glide * 0.22;
    const wave = Math.round(p.wave);
    const accent =
      this.flavour === "bass" ? 1 + (vel - 0.7) * p.accent * 1.6 : 1;
    const level = vel * (this.flavour === "bass" ? 0.55 : 0.4);
    const decay = 0.07 + p.decay * 1.5;
    const sustain = this.flavour === "lead" ? p.sustain : 0;
    const len = Math.min(dur * 1.9, decay + sustain * dur * 1.6);

    const filt = ladder(ctx, p.reso);
    const base = cutoffHz(p.cutoff) * Math.max(0.4, accent);
    const peak = Math.min(15000, base * Math.pow(2, p.env * 5.5 * accent));
    sweep(filt.freqs, t, peak, Math.max(70, base), 0.015 + p.decay * 0.55);

    if (this.flavour === "bass" && p.lfo > 0.001) {
      const lfo = ctx.createOscillator();
      lfo.type = "triangle";
      lfo.frequency.value = 0.4 + p.lfoRate * 11;
      const depth = ctx.createGain();
      depth.gain.value = base * p.lfo * 1.6;
      lfo.connect(depth);
      for (const f of filt.freqs) depth.connect(f);
      lfo.start(t);
      lfo.stop(t + len + 0.3);
    }

    const amp = ctx.createGain();
    const peakGain = Math.max(0.001, level * accent * (1 - p.reso * 0.35));
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(peakGain, t + 0.006);
    if (sustain > 0.02) {
      amp.gain.exponentialRampToValueAtTime(
        peakGain * (0.25 + sustain * 0.7),
        t + 0.006 + decay * 0.5,
      );
    }
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.006 + len);

    const shaper = ctx.createWaveShaper();
    shaper.curve = saturationCurve(0.05 + p.drive * 0.85);
    shaper.oversample = "2x";

    filt.output.connect(shaper);
    shaper.connect(amp);
    amp.connect(c.dest);

    const stop = t + len + 0.14;
    const oscs: OscillatorNode[] = [];

    let vibratoDepth: GainNode | null = null;
    if (this.flavour === "lead" && p.vibrato > 0.001) {
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 1.5 + p.vibRate * 8;
      vibratoDepth = ctx.createGain();
      vibratoDepth.gain.setValueAtTime(0, t);
      vibratoDepth.gain.linearRampToValueAtTime(
        p.vibrato * 55,
        t + 0.08 + p.decay * 0.3,
      );
      lfo.connect(vibratoDepth);
      lfo.start(t);
      lfo.stop(stop);
    }

    const addOsc = (
      setup: (o: OscillatorNode) => void,
      gain: number,
      detuneCents = 0,
    ) => {
      const o = ctx.createOscillator();
      setup(o);
      o.detune.value = detuneCents;
      if (vibratoDepth) vibratoDepth.connect(o.detune);
      const start = this.last !== null && glide > 0.001 ? this.last : freq;
      o.frequency.setValueAtTime(start, t);
      if (start !== freq)
        o.frequency.exponentialRampToValueAtTime(freq, t + glide);
      else o.frequency.setValueAtTime(freq, t);
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g);
      g.connect(filt.input);
      oscs.push(o);
      return o;
    };

    if (this.flavour === "bass") {
      const duty = 0.5 - p.pw * 0.38;
      if (wave === 0) addOsc((o) => (o.type = "sawtooth"), 0.85);
      else if (wave === 1)
        addOsc(
          (o) => o.setPeriodicWave(pulseWave(ctx, Math.max(0.06, duty))),
          0.72,
        );
      else
        addOsc(
          (o) => o.setPeriodicWave(pulseWave(ctx, Math.max(0.05, duty * 0.45))),
          0.78,
        );

      if (p.sub > 0.001) {
        const sub = ctx.createOscillator();
        sub.type = "sine";
        const start =
          this.last !== null && glide > 0.001 ? this.last / 2 : freq / 2;
        sub.frequency.setValueAtTime(start, t);
        if (start !== freq / 2)
          sub.frequency.exponentialRampToValueAtTime(freq / 2, t + glide);
        const sg = ctx.createGain();
        sg.gain.value = p.sub * 0.9;
        sub.connect(sg);
        // the sub bypasses the filter so the low end stays solid
        sg.connect(amp);
        sub.start(t);
        sub.stop(stop);
      }
    } else {
      const shape = p.tone;
      const spread = 4 + p.detune * 26;
      if (wave === 0) {
        addOsc((o) => (o.type = "sawtooth"), 0.6);
        if (p.detune > 0.01) addOsc((o) => (o.type = "sawtooth"), 0.5, spread);
      } else if (wave === 1) {
        addOsc(
          (o) => o.setPeriodicWave(pulseWave(ctx, 0.12 + shape * 0.36)),
          0.62,
        );
        if (p.detune > 0.01) {
          addOsc(
            (o) => o.setPeriodicWave(pulseWave(ctx, 0.12 + shape * 0.36)),
            0.44,
            -spread,
          );
        }
      } else if (wave === 2) {
        addOsc((o) => (o.type = "triangle"), 0.85);
        if (shape > 0.01)
          addOsc((o) => (o.type = "sawtooth"), shape * 0.35, spread * 0.4);
      } else {
        const carrier = addOsc((o) => (o.type = "sine"), 0.9);
        const mod = ctx.createOscillator();
        mod.type = "sine";
        mod.frequency.value = freq * (2.005 + p.detune * 1.5);
        const modGain = ctx.createGain();
        modGain.gain.setValueAtTime(freq * (0.5 + shape * 7), t);
        modGain.gain.exponentialRampToValueAtTime(
          freq * 0.05,
          t + 0.05 + p.decay * 0.5,
        );
        mod.connect(modGain);
        modGain.connect(carrier.frequency);
        mod.start(t);
        mod.stop(stop);
      }
    }

    for (const o of oscs) {
      o.start(t);
      o.stop(stop);
    }
    this.last = freq;
  }
}

export class PadSynth {
  trigger(
    c: VoiceCtx,
    t: number,
    root: number,
    chord: number,
    gate: number,
    vel: number,
    p: Params,
  ) {
    const { ctx } = c;
    const intervals = chordIntervals(chord, p.voicing);
    const attack = 0.012 + p.attack * 1.4;
    const release = 0.12 + p.release * 2.6;

    const filt = ladder(ctx, p.reso * 0.55);
    const base = cutoffHz(p.cutoff * 0.85);
    for (const f of filt.freqs) f.value = base;

    if (p.motion > 0.001) {
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.04 + p.rate * 2.4;
      const depth = ctx.createGain();
      depth.gain.value = base * p.motion * 0.85;
      lfo.connect(depth);
      for (const f of filt.freqs) depth.connect(f);
      lfo.start(t);
      lfo.stop(t + gate + release + 0.2);
    }

    const amp = ctx.createGain();
    const peak = (vel * 0.3) / Math.sqrt(intervals.length);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(peak, t + attack);
    amp.gain.setValueAtTime(peak, t + Math.max(attack, gate));
    amp.gain.exponentialRampToValueAtTime(
      0.0001,
      t + Math.max(attack, gate) + release,
    );

    const shaper = ctx.createWaveShaper();
    shaper.curve = saturationCurve(0.04 + p.drive * 0.6);
    shaper.oversample = "2x";
    filt.output.connect(shaper);
    shaper.connect(amp);
    amp.connect(c.dest);

    const stop = t + Math.max(attack, gate) + release + 0.1;
    const detune = 4 + p.detune * 26;

    intervals.forEach((interval, i) => {
      const freq = mtof(root + interval);
      const pan = ctx.createStereoPanner();
      const spread = (i + 1) * 0.19 * p.width;
      pan.pan.value = (i % 2 === 0 ? -1 : 1) * Math.min(0.92, spread);
      pan.connect(filt.input);
      for (const sign of [-1, 1]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = freq;
        o.detune.value = sign * detune;
        const g = ctx.createGain();
        g.gain.value = 0.5;
        o.connect(g);
        g.connect(pan);
        o.start(t);
        o.stop(stop);
      }
      if (p.shimmer > 0.001) {
        const o = ctx.createOscillator();
        o.type = "triangle";
        o.frequency.value = freq * 2;
        const g = ctx.createGain();
        g.gain.value = p.shimmer * 0.34;
        o.connect(g);
        g.connect(pan);
        o.start(t);
        o.stop(stop);
      }
    });

    if (p.sub > 0.001) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = mtof(root - 12);
      const g = ctx.createGain();
      g.gain.value = p.sub * 0.55;
      o.connect(g);
      // straight to the amp so the low end is not thinned by the pad filter
      g.connect(amp);
      o.start(t);
      o.stop(stop);
    }
  }
}
