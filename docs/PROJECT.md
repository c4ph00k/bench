# Bench - project overview

Three local-first apps, merged from three separate repos into one project with **one frontend
server and one backend server**. Everything runs on your own machine: no login, no cloud, no
external services, no secrets. Data lives in local SQLite files.

| App        | Path      | What it is                                                                                                                               | Backend                        |
| ---------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **CRM**    | `/crm`    | Personal sales CRM: organizations, contacts, deals, drag-and-drop pipeline, activities, dashboard                                        | `data/crm.sqlite`              |
| **Space**  | `/space`  | Personal knowledge manager, a single-user Notion: pages and blocks, databases with table/board/list views, search, light and dark themes | `data/personal-space.db`       |
| **Groove** | `/groove` | Browser groovebox instrument: four synth units, one transport, a master DJ filter                                                        | none - pure Web Audio, no data |

A launcher at `/` links to all three.

## Detailed app documentation

One directory per app. Read these on demand - they are not loaded into context by default. Open the
app you are working in before changing its behaviour.

| App    | Implementation                                         | Requirements                                       | Also                                                            |
| ------ | ------------------------------------------------------ | -------------------------------------------------- | --------------------------------------------------------------- |
| CRM    | [crm/IMPLEMENTATION.md](./crm/IMPLEMENTATION.md)       | [crm/REQUIREMENTS.md](./crm/REQUIREMENTS.md)       |                                                                 |
| Space  | [space/IMPLEMENTATION.md](./space/IMPLEMENTATION.md)   | [space/REQUIREMENTS.md](./space/REQUIREMENTS.md)   |                                                                 |
| Groove | [groove/IMPLEMENTATION.md](./groove/IMPLEMENTATION.md) | [groove/REQUIREMENTS.md](./groove/REQUIREMENTS.md) | [groove/INSTRUMENT.md](./groove/INSTRUMENT.md) - player's guide |

**IMPLEMENTATION.md** is how the app is built now: structure, domain rules, and the traps.
**REQUIREMENTS.md** is the original product brief, kept for intent and scope; their phased plans
are complete, not outstanding work. Where the two disagree, the code is the truth - but the gap is
worth understanding before you close it.

## Layout

```
package.json        npm workspaces: web, server. All commands run from the root.
web/                ONE Vite project, multi-page (MPA)
  index.html          launcher            -> src/home/
  crm/index.html      -> src/crm/main.tsx
  space/index.html    -> src/space/main.tsx
  groove/index.html   -> src/groove/main.tsx
server/             ONE Express app
  src/index.ts        opens both DBs, listens on :8100
  src/app.ts          mounts routers, serves web/dist with per-prefix SPA fallback
  src/crm/            crm routes + db + seed
  src/space/          space routes + db + seed
  test/{crm,space}/   vitest suites
data/                 crm.sqlite, personal-space.db (gitignored, seeded on first run)
docs/                 this documentation; docs/<app>/ per app
e2e/                  Playwright specs
scripts/              check-secrets.mjs, the repo-specific half of the secrets check
eslint.config.js      one flat config covering web, server and e2e
knip.json             entry points, so knip can see what is reachable
```

## Run

```bash
npm install     # once, at the root
npm run dev     # API :8100 + Vite :8101 -> open http://localhost:8101
npm start       # build, then serve everything from :8100
```

`npm run build` (typecheck + bundle), `npm test` (vitest, server + web), `npm run e2e` (Playwright),
`npm run check` (everything: typecheck, lint, formatting, secrets, dead code, coverage).
Commands run from the root; `-w web` / `-w server` targets one workspace.

Under `npm run dev` use **8101**. Port 8100 serves the last build, not your live edits.

## Architectural decisions

These are settled. Changing one is a project-level decision, not an implementation detail.

- **Multi-page, not one SPA.** The three apps keep their own global `styles.css`, and those files
  genuinely collide: `.app`, `.sidebar`, `.btn`, `.chip`, `.board`, `.brand`, `:root` variables, and
  groove's `* { margin: 0 }`. Separate HTML entry points give one Vite server and one build while
  the stylesheets and routers never meet. Do **not** merge these into a single bundle without
  scoping the CSS first.
- **Router basenames.** crm and space each mount at `/` inside their own document, via
  `<BrowserRouter basename="/crm">` / `basename="/space"`. groove has no router.
- **API namespaces.** `/api/crm/*` and `/api/space/*`. The underlying route names were already
  disjoint; the prefixes keep ownership obvious.
- **Two SQLite files, one process.** The schemas are unrelated - do not merge them. Each is opened
  separately and seeded if empty. They run in WAL mode, so recent writes live in the `-wal` sidecar
  rather than the main file: copy or move the whole set together, or checkpoint first
  (`sqlite3 f.sqlite "PRAGMA wal_checkpoint(TRUNCATE);"`). Deleting a `-wal` as a stray artifact
  discards data - a 4KB `.sqlite` beside a 3MB `-wal` is a full database, not an empty one.
- **Ports:** 8100 API, 8101 Vite, 8150+ e2e (one per Playwright worker).
- **Deep-link fallback lives in two places.** `server/src/app.ts` handles production; the
  `appFallback` plugin in `web/vite.config.ts` does the same for the dev server. Without it a
  refresh on `/crm/contacts` serves the launcher. Both carry the same `APPS` list, and they have
  disagreed before - check both when you touch routing.
- **One dependency set per workspace.** All three UIs live in `web/`, so they share one set of
  versions: TypeScript 7, Vite 8, vitest 4, react-router 8, React 19.
- **Two TypeScripts, for now.** The workspaces compile with 7; the repo root pins 5.9 purely as
  ESLint's analysis engine, because TypeScript 7's native build no longer exposes the compiler API
  that type-aware linting needs. The root `optionalDependencies` block carrying every
  `@typescript/typescript-*` platform package keeps the nested 7 working and is load-bearing, not
  stray. **This arrangement is worth revisiting**: TypeScript 6.0.3 still has the compiler API and
  would let one version serve both, or an alias would keep 7 for builds without the
  `optionalDependencies` workaround. See [CONTROLS.md](./CONTROLS.md).

## Adding a fourth app

A new `web/<name>/index.html`, a new `web/src/<name>/`, an entry in `vite.config.ts`
`rollupOptions.input`, the prefix in the `APPS` list in **both** `server/src/app.ts` and
`web/vite.config.ts`, and a card on the launcher in `web/src/home/App.tsx`.

## Design

Palette: amber `#ecad0a`, blue `#209dd7`, purple `#753991` over grays. Flat, sharp, modern.
See [STANDARDS.md](./STANDARDS.md) for the rules, including what to avoid.

## Related documents

- [PROCESS.md](./PROCESS.md) - how to implement a change and how to keep the test suite honest
- [STANDARDS.md](./STANDARDS.md) - coding standards
- [CONTROLS.md](./CONTROLS.md) - lint, static analysis, coverage and how each is enforced
- [e2e/EXPLORATORY.md](../e2e/EXPLORATORY.md) - what the automated suite deliberately does not cover
- [README.md](../README.md) - the short public-facing readme
