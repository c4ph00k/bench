> The original product brief for Groove, kept for intent and scope. The phased plan below
> describes a build that is **complete** - history, not outstanding work. For how Groove is
> built, read [IMPLEMENTATION.md](./IMPLEMENTATION.md); for how to play it, read
> [INSTRUMENT.md](./INSTRUMENT.md).

# Groovebox

Build a groovebox web app in TypeScript: 4 hardware-style units — drums, bass, pads
and lead — arranged on screen like gear on a desk, with pads, LEDs, displays, knobs
and sliders.

Each unit has its own voice with editable sound controls and its own 16-step
sequencer that the user programs by clicking steps. All four lock to a shared
transport with global tempo, play/stop and per-unit mute, looping continuously.

There should be 4 default preset patches that the user can switch between. A patch stores
everything: every unit's sound settings, all four 16-step patterns, and the tempo.
Switching a patch instantly changes all of it. The app opens with the first patch
already loaded, so the very first press of play makes music. The patches demonstrate
the best of what the instrument can do. They should be creative, original and
inspiring. Name the patches - could be after genres, could be a track name, could be
an inspiration - it's up to you.

Ensure there is a lot of detail - many effects that can be tweaked. Add dials, 
sliders and other controls to further sculpt the sound.
For at least one of the preset patches, ensure that the sound can have a deadmau5 style filter effect.
Consider application of filter, echo, swing, and selecting the waveform type.

Make the user interface stunning. Use your agent-browser skill if its helpful.
Consider including some settings that apply to a sequence of measures. Consider a spectrum analyzer.

## Process

Evaluate the performance of your product, including the UI and the musical quality,
and keep iterating until the quality is exceptional.

## Success criteria

1. The app can be brought up in a browser. The web interface is stunning, fills the
   browser at any size, optimized for 16:9 landscape orientation. Desktop only;
   mobile is not required.
2. Each of the 3 default patches can be switched between, including during playback.
   The LEDs show the sequencer position as it plays.
3. The sound of each patch is professional and original work rather than a
   recreation of an existing song; the four patches are completely different from
   each other and at least one is inspired by deadmau5 sounds.
4. The groovebox units can be tweaked live to experiment with the sound; easy to
   use, amazing sounds.