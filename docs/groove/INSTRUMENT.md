> Adapted from the original `groove-opus/README.md`. This is the player's guide - what the
> controls do and how to perform with them. Run it as part of this project: see
> [../PROJECT.md](../PROJECT.md). Desktop browsers, optimised for 16:9.

# Groovebox GX-4

A four-unit hardware-style groovebox in the browser, with a sweepable master DJ filter and
sidechain pump. Everything you hear is synthesised live with the Web Audio API — no samples,
no audio libraries.

## The instrument

Four units share one transport, one tempo and one 16-step loop:

| Unit             | Voice                                                               | Sculpting                                                                                 |
| ---------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **RHYTHM DR-16** | six synthesised drums — kick, snare, clap, closed/open hat, FM perc | tune/decay/punch per voice, kick sub, bit crush, bus drive, six level faders              |
| **BASS MB-1**    | mono saw/square/pulse + sub oscillator                              | pulse width, resonant filter with envelope, accent depth, filter wobble LFO, glide, drive |
| **PADS PX-4**    | polyphonic detuned-saw chords                                       | voicing, detune, stereo width, filter motion LFO, octave shimmer, sub, drive              |
| **LEAD LX-2**    | mono saw/pulse/triangle/FM                                          | shape, detune, filter envelope, sustain, vibrato + rate, glide, drive                     |

## Master section

The bottom panel is the performance strip.

- **FILTER** — the hero control. One knob sweeps the whole mix: left of centre closes a
  resonant lowpass, right of centre opens a highpass, centre is wide open. **RESO** takes it
  to the edge of self-oscillation; **BITE** drives the filter output.
- **SWEEP** — tempo-synced automation of that filter over 1, 2, 4, 8 or 16 bars, with rise,
  fall, triangle or sine shapes. This is the long deadmau5-style filter build: set a depth,
  pick eight bars, and the mix breathes open and shut on its own. The segmented meter shows
  where you are in the phrase.
- **SIDECHAIN** — ducks bass, pads and lead on every kick, with adjustable depth and release.
  The drums stay untouched so the kick punches through the pump.
- **SEND FX** — tempo-synced ping-pong delay (length in 16ths, repeats, tone), reverb size and
  master glue saturation.
- **Scope** — live spectrum with the filter's actual response curve drawn over it, so you can
  see the sweep move.

## Patches

Four factory patches, each a complete snapshot — every sound setting, all four patterns,
tempo, swing, filter, sweep, pump and FX. Switching is instant and works during playback.
Patch A is loaded at startup, so the first press of play makes music.

- **A · NEON RIVIERA** — synthwave, F minor, 112 BPM. Gated clap, wide ninth pads, delayed hook.
- **B · BASALT** — dark techno, A phrygian, 130 BPM. Acid bass, FM stabs, a slow breathing filter.
- **C · SUNROOM** — lo-fi soul, C minor, 94 BPM, heavy swing. Bit-crushed drums, lush chords.
- **D · LATE ORBIT** — filter house, F# minor, 126 BPM. Built around the master filter: an
  eight-bar triangle sweep closes the whole mix to a resonant hum and opens it back up over a
  hard sidechain pump, under a rolling offbeat bass and a 16-step arp.

## Playing it

- **Space** plays/stops, **1 / 2 / 3 / 4** select patches.
- Drum pads cycle rest → hit → accent; drag across the grid to paint.
- Melodic steps toggle on click; drag up/down or scroll to change pitch. On the pads unit,
  shift-click cycles the chord shape (min / maj / sus / dim / aug).
- The **VELOCITY** lane under each melodic sequencer draws per-step dynamics.
- Every knob and fader is drag up/down; hold shift for fine control. The panel display shows
  what you are moving.
- **REVERT** restores the current patch to its factory state after live tweaking.

## Layout

```
web/src/groove/
  audio/    master.ts (bus, DJ filter, pump, FX)  drums.ts  synths.ts  engine.ts (scheduler)
  filter.ts       filter macro mapping, shared by the audio graph, readout and scope
  components/     Transport, Unit, Master, Scope, Knob, Fader, DrumGrid, NoteGrid, VelocityLane
  patches.ts      the four factory patches
  params.ts       control definitions that drive both the UI and the synths
```

The scheduler uses the standard Web Audio lookahead pattern: a 25 ms timer queues steps
0.12 s ahead on the audio clock, so timing does not drift with the UI. The filter sweep is
ramped step by step on the same clock, which keeps long sweeps smooth and perfectly in phase
with the bar. LED position and the scope read from that queue via requestAnimationFrame.
