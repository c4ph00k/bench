# Exploratory testing charter

What the automated suite deliberately does **not** cover, and how to check it by hand or with an
agent. Run this when you change something the assertions cannot see: audio, visual design,
animation, feel.

The automated suite lives beside this file. Prefer adding a spec over adding a line here - this
document is for what genuinely cannot be asserted.

## Running the apps

```bash
npm run dev     # Vite :8101 (+ API :8100) - the usual choice
npm start       # everything from :8100 - the production path
```

**Check both when you touch routing.** Deep-link fallback is implemented twice - `server/src/app.ts`
for production, the `appFallback` plugin in `web/vite.config.ts` for the dev server. They have
already disagreed once: prod served the right app while dev served the launcher.

With `agent-browser`: `agent-browser --session bench open http://localhost:8101/crm/`, then
`snapshot -i` to list interactive elements. Two traps worth knowing - `fill @ref ""` does **not**
clear a field (reload instead), and refs go stale after navigation, so re-snapshot before clicking.

## Groove - the big one

**Nothing about how it sounds is tested.** The suite proves the transport runs, the playhead
advances, steps toggle and patches load. Every judgement below is yours:

- Do the drums sound like their names - is the kick punchy, the snare snappy, the hats crisp?
- Does the master filter sweep smoothly across its range, and does resonance self-oscillate near
  the top without an ugly jump?
- Does the sidechain pump in time, ducking bass/pads/lead while the kick stays clear?
- Do the four patches each have a distinct character?
- Tempo and swing: does the groove still feel right at 90 and at 160 BPM?
- Any clicks, pops, or dropouts when toggling steps or switching patches **while playing**?
- Does audio stop cleanly on stop, with no ringing tail or stuck voice?

**Headless tests never open an audio device, so the suite cannot hear a regression here.** Note
that driving Groove with a visible browser plays sound out loud - stop the transport before walking
away.

## CRM

Covered by specs: CRUD for organizations, contacts and deals, search, status filter, keyboard drag
on the pipeline, delete confirmation, deep links. Left to judgement:

- Dashboard charts: are the axes, currency formatting and month ordering actually right? The specs
  only check the charts render.
- Mouse dragging on the pipeline. The specs drag with the keyboard, which is what
  `@hello-pangea/dnd` supports natively and what makes them stable - so the mouse path is
  **untested**. Drag a card with the mouse after touching the pipeline.
- Chart readability: do the funnel proportions, the stacked won-versus-expected bars and the
  probability meters actually communicate at a glance? Only their presence and figures are asserted.
- The forward half of "Revenue and deal volume" only fills if open deals carry future close dates.
  A database seeded weeks ago has a pipeline that has all gone past due, so the months ahead read
  empty - correctly, but it does not look like much. Delete `data/crm.sqlite*` to reseed against
  today before judging that chart.
- Long values: very long organization names, huge deal values, empty descriptions.
- Does the pipeline stay usable with many deals in one stage?

## Space

The best-covered app - pages, editor, databases, all three views, search, themes, plus an
adversarial suite. Left to judgement:

- Editor feel: caret placement after slash-menu inserts, selection across blocks, paste of odd
  content.
- Dark mode on every surface, including modals, menus and the board.
- Board drag with the mouse at narrow widths. The board needs a desktop-width window; below roughly
  1400px its columns plus the sidebar overflow, and a card can sit outside the viewport. This is
  why the suite pins 1440x900.

## Cross-app

- The launcher, then into each app and back. Because the apps are separate documents, back is a
  full page load, not a router transition.
- Each app should keep its own look: CRM light with an amber top rule, Space light/dark, Groove
  dark. Any styling bleeding between them means the multi-page split has been broken.
- Refresh on a deep link in **both** dev and prod.
