# Process - how to implement a change

Work in small increments and validate each one before moving on. A change is finished when the
typecheck, the unit tests and the e2e suite all pass, and you have seen the feature working in a
real browser.

## 1. Understand before changing

- Read the app's docs first: [crm/](./crm/), [space/](./space/), [groove/](./groove/). Each holds
  an IMPLEMENTATION.md with the domain rules and the traps, and a REQUIREMENTS.md with the original
  brief.
- For a bug, **prove the root cause before fixing it.** Reproduce it, measure it, show the evidence.
  Do not apply a workaround to a symptom you have not explained. If a fix depends on a guess, the
  guess is the thing to test first.
- Check whether the behaviour is already covered by a test. If it is, the test is your reproduction.

## 2. Build it in increments

Work from the data outwards, because each layer can be validated on its own:

1. **Schema and data layer** (`server/src/<app>/db.ts`). Existing databases are migrated in place -
   see the migration in `server/src/crm/db.ts` for the pattern: check `PRAGMA table_info`, add the
   column, backfill.
2. **API routes** (`server/src/<app>/routes*.ts`), under `/api/crm` or `/api/space`.
3. **Types and helpers** (`web/src/<app>/types.ts`). Derived values belong in one place that both
   the tables and the charts read from.
4. **UI**.

Typecheck as you go: `npm run typecheck`. It is fast and catches most breakage.

## 3. Test

Three layers, each with a different job. Add to whichever ones the change touches.

### Unit tests - `npm test`

vitest, server and web. Server suites live in `server/test/{crm,space}/`; web suites are Space-only
today, which is why coverage thresholds are scoped to `src/space/**`.

Use these for logic with edges: calculations, filtering, sorting, migrations, data transforms. A
new derived value or a new column default should get one.

### End-to-end tests - `npm run e2e`

Playwright, in `e2e/`. Layout: `smoke.spec.ts` (the seams between the apps), then `crm/`, `space/`,
`groove/`. 74 tests in 13 files. `e2e/tools/screenshots.mjs` is not part of the suite - it drives a
running app and captures every screen in both themes, for reviewing a visual change in one pass.

Rules that keep this suite reliable:

- **Import `test` and `expect` from `../fixtures`**, never from `@playwright/test` directly, or the
  spec gets no server and no `baseURL`.
- **Each worker runs its own server and database.** `e2e/fixtures.ts` spawns the API on
  `8150 + workerIndex` with its own `DATA_DIR` under `e2e/.tmp/w<n>`; `e2e/global-setup.ts` builds
  `web/dist` once. There is no `webServer` block in `playwright.config.ts` - do not add one back.
- **Tests within a worker share a database, and retries re-run against it.** Set up your own state
  at the start of a test rather than depending on the seed or on another test's leftovers. See
  `dealInStage` in `e2e/crm/revenue.spec.ts`.
- **Wait for data before asserting on it.** Figures render as `$0` until the fetch resolves; assert
  on a card being visible, or poll, before capturing a "before" value.
- **Run at 1440x900** (already set). At Playwright's 1280 default a board card sits partly outside
  the viewport and dnd-kit drags never activate.
- **Drag with the keyboard where the library supports it.** CRM's pipeline uses
  `@hello-pangea/dnd`: Space to lift, arrows to move, Space to drop - deterministic, no coordinates.
  Space's board uses dnd-kit, which has no keyboard sensor here, so its drags stay mouse-driven.
- `getByRole` name matching is substring-based: `{ name: "BASS step 1" }` also matches steps 10-16.
  Pass `exact: true` for numbered labels.

Run one file while iterating: `npx playwright test e2e/crm/revenue.spec.ts --retries=0`.

**A new API route can 404 against a stale dev server.** `tsx watch` does not always pick up a new
route, and an old process can still hold the port. If a route you just added 404s, restart before
you debug the routing: `pkill -f concurrently; pkill -f vite; pkill -f tsx` then `npm run dev`.

### Browser testing with Agent Browser

Automated tests confirm what you already thought to assert. Driving the real app finds what you did
not. Do this **before** writing specs for new UI, so the specs encode what actually matters, and
again afterwards to confirm the feature feels right.

Invoke the `agent-browser` skill, then:

```bash
agent-browser --session bench open http://localhost:8101/crm/
agent-browser --session bench snapshot -i          # interactive elements with @eN refs
agent-browser --session bench click @e12
agent-browser --session bench screenshot /tmp/x.png
agent-browser --session bench errors               # console and page errors
agent-browser --session bench close
```

Traps worth knowing:

- `fill @ref ""` does **not** clear a field. Reload the page instead.
- Refs go stale after navigation - re-snapshot before clicking.
- `snapshot -i` lists only interactive elements; a container with a role may not appear, which is
  not evidence that it is missing. Confirm against the source before reporting it as a defect.
- Driving Groove with a visible browser **plays sound out loud**. Stop the transport when done.

Record anything that automation cannot assert in [e2e/EXPLORATORY.md](../e2e/EXPLORATORY.md).

### Verifying visually

Screenshot the whole area you changed, not just the element - alignment work in particular disturbs
neighbours. When checking spacing or alignment, measure rather than eyeball:
`getBoundingClientRect()` through `page.evaluate` gives numbers you can compare against the
elements around it, above and below included.

## 4. Maintaining the test suite

- **A bug fix gets a test that fails without it.** That is what stops it coming back.
- **Fix flakiness at the root.** Every failure so far has been shared state, an unmet wait, or a
  viewport too small - not chance. Prove the cause before adding a retry or a timeout.
- **Prefer accessible selectors** - roles, labels, names - over CSS classes, then keep the markup
  accessible enough to support them. Reach for `data-testid` only for figures with no natural name,
  as the pipeline and dashboard totals do.
- **Delete tests that no longer describe intended behaviour.** A test kept alive by workarounds is
  worse than no test.
- **Keep counts honest.** If a doc states how many tests exist, update it when that changes.
- When you deliberately leave something uncovered, say so in `e2e/EXPLORATORY.md` rather than
  letting a green suite imply coverage it does not have. Groove's audio is the standing example.

## 5. Finishing

1. `npm run typecheck`
2. `npm test`
3. `npm run e2e`
4. Look at it in a browser.
5. Update the docs the change invalidates - the app doc for behaviour, `PROJECT.md` for structure,
   `EXPLORATORY.md` for coverage gaps.
6. **Do not commit** - see [STANDARDS.md](./STANDARDS.md). Report what changed, offer a commit
   message, and say honestly which parts are incomplete or unverified.

## Related documents

- [PROJECT.md](./PROJECT.md) - purpose, layout, architectural decisions
- [STANDARDS.md](./STANDARDS.md) - coding standards
