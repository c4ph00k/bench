# Novhora (Bench) - project overview

Three local-first apps, merged from four separate repos into one project with **one frontend
server and one backend server**, branded for Novhora. Everything runs on your own machine: one
login at the door, no cloud, no external services, no secrets. Data lives in local SQLite files.

| App         | Path       | What it is                                                                                                                      | Backend                  |
| ----------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **CRM**     | `/crm`     | Personal sales CRM: organizations, contacts, deals, drag-and-drop pipeline, activities, dashboard                               | `data/crm.sqlite`        |
| **Space**   | `/space`   | Personal knowledge manager, a single-user Notion: pages and blocks, databases with table/board/list views, search               | `data/personal-space.db` |
| **Rolodex** | `/rolodex` | Personal CRM for your own people: check-in cadences, circles, birthdays, a timeline of every conversation, CSV and vCard import | `data/rolodex.sqlite`    |

A launcher at `/` links to all three, and every page carries the same navigation strip: the
Novhora mark, then Home, CRM, Space and Rolodex, each with the icon that identifies it inside its
own app too, one theme toggle and one sign-out button on the right.

A login gate sits in front of all of it: one seeded user (`marco` / `bench`, printed on first
run), scrypt-hashed in `data/auth.sqlite` with server-side sessions in the same file. Every page
without a session redirects to the login document at `/login`, every `/api` route except
`/api/auth` answers 401, and the three app api helpers in `web/src/*/api.ts` send the browser to
`/login` when they see that 401. Sign out from the strip ends the session server-side.

## Detailed app documentation

One directory per app. Read these on demand - they are not loaded into context by default. Open the
app you are working in before changing its behaviour.

| App     | Implementation                                           | Requirements                                         | Also |
| ------- | -------------------------------------------------------- | ---------------------------------------------------- | ---- |
| CRM     | [crm/IMPLEMENTATION.md](./crm/IMPLEMENTATION.md)         | [crm/REQUIREMENTS.md](./crm/REQUIREMENTS.md)         |      |
| Space   | [space/IMPLEMENTATION.md](./space/IMPLEMENTATION.md)     | [space/REQUIREMENTS.md](./space/REQUIREMENTS.md)     |      |
| Rolodex | [rolodex/IMPLEMENTATION.md](./rolodex/IMPLEMENTATION.md) | [rolodex/REQUIREMENTS.md](./rolodex/REQUIREMENTS.md) |      |

**IMPLEMENTATION.md** is how the app is built now: structure, domain rules, and the traps.
**REQUIREMENTS.md** is the original product brief, kept for intent and scope; their phased plans
are complete, not outstanding work. Where the two disagree, the code is the truth - but the gap is
worth understanding before you close it.

## Layout

```
package.json        npm workspaces: web, server. All commands run from the root.
web/                ONE Vite project, multi-page (MPA)
  public/novhora.svg  the brand favicon, drawn from the company logo
  index.html          launcher            -> src/home/
  login/index.html    the login document  -> src/login/main.tsx
  crm/index.html      -> src/crm/main.tsx
  space/index.html    -> src/space/main.tsx
  rolodex/index.html  -> src/rolodex/main.tsx
  src/shared/         the brand, the navigation strip, the theme and the session sign-out - the
                      code all five documents share
server/             ONE Express app
  src/index.ts        opens the four DBs, listens on :8100
  src/app.ts          mounts routers, gates pages and API behind the session, serves web/dist
                      with per-prefix SPA fallback
  src/auth/           login/logout/whoami routes + users and sessions db
  src/crm/            crm routes + db + seed
  src/space/          space routes + db + seed
  src/rolodex/        rolodex routes + db + seed
  test/{auth,crm,space,rolodex}/   vitest suites
data/                 auth.sqlite, crm.sqlite, personal-space.db, rolodex.sqlite (gitignored,
                      seeded on first run)
docs/                 this documentation; docs/<app>/ per app
e2e/                  Playwright specs; auth.spec.ts is the only one that never signs in
scripts/              check-secrets.mjs, the repo-specific half of the secrets check
                      stop-lint.mjs, the Claude Code Stop hook
eslint.config.js      one flat config covering web, server and e2e
knip.json             entry points, so knip can see what is reachable
lefthook.yml          pre-commit: format the staged files, then lint the tree
.github/workflows/    ci.yml - npm run check and npm run e2e, the only gate
.claude/settings.json the Stop hook registration (settings.local.json is not committed)
.vscode/              settings.json and extensions.json only, both shared deliberately
```

## Run

```bash
npm ci          # once, at the root
npm run dev     # API :8100 + Vite :8101 -> open http://localhost:8101
npm start       # build, then serve everything from :8100
```

**`npm ci`, not `npm install`.** npm drops optional platform packages often enough that a fresh
`npm install` here leaves `@rolldown/binding-darwin-arm64` uninstalled on Apple Silicon, and the
build dies with "Cannot find native binding" - reproduced on two clean clones out of two, while
`npm ci` succeeded. The lockfile names the binding correctly; `npm install`'s reconciliation is
what skips it ([npm/cli#4828](https://github.com/npm/cli/issues/4828)). `npm ci` also matches what
CI runs. Use `npm install <pkg>` only when adding a dependency, since `npm ci` will not update the
lockfile - and see [CONTROLS.md](./CONTROLS.md) for the same bug biting mid-project.

`npm run build` (typecheck + bundle), `npm test` (vitest, server + web), `npm run e2e` (Playwright),
`npm run check` (everything: typecheck, lint, formatting, secrets, dead code, coverage).
Commands run from the root; `-w web` / `-w server` targets one workspace.

Under `npm run dev` use **8101**. Port 8100 serves the last build, not your live edits.

## Architectural decisions

These are settled. Changing one is a project-level decision, not an implementation detail.

- **Branding lives in one module.** `web/src/shared/brand.ts` names the company, its mark
  component and its favicon (`web/public/novhora.svg`, drawn from the company logo in `jpg/`);
  the nav strip, the launcher, the login card and every document title read from it. Rebranding
  the suite for another company means changing that module and the SVG, nothing else.
- **Multi-page, not one SPA.** The three apps keep their own global `styles.css`, and those files
  genuinely collide: `.app`, `.sidebar`, `.btn`, `.chip`, `.board`, `.brand`, `.card`, `.page`,
  `:root` variables. Rolodex and Space both style `.board-col`,
  and differently. Separate HTML entry points give one Vite server and one build while the
  stylesheets and routers never meet. Do **not** merge these into a single bundle without scoping
  the CSS first.
- **Router basenames.** crm and space each mount at `/` inside their own document, via
  `<BrowserRouter basename="/crm">` / `basename="/space"`. rolodex has no router.
- **API namespaces.** `/api/crm/*`, `/api/space/*` and `/api/rolodex/*`. The underlying route
  names were already disjoint; the prefixes keep ownership obvious.
- **`/api` answers `Cache-Control: no-store`.** Express attaches an ETag to every JSON reply, so a
  browser that revalidates one gets **304 with an empty body** - which the client then parses as
  JSON and fails on, with a message that names neither the request nor the status. Nothing is
  saved by caching a list that changes whenever you touch it, on a machine talking to itself.
- **Three app SQLite files plus one auth file, one process.** The app schemas are unrelated - do
  not merge them. Each is opened separately and seeded if empty; `auth.sqlite` holds the one user
  and the sessions, and belongs to Bench rather than to any app. They run in WAL mode, so recent
  writes live in the `-wal` sidecar rather than the main file: copy or move the whole set
  together, or checkpoint first (`sqlite3 f.sqlite "PRAGMA wal_checkpoint(TRUNCATE);"`). Deleting
  a `-wal` as a stray artifact discards data - a 4KB `.sqlite` beside a 3MB `-wal` is a full
  database, not an empty one.
- **The login gate is server-side and total.** Pages redirect to `/login` and every `/api` route
  except `/api/auth` answers 401 without a session, both in `server/src/app.ts`. Two prefixes
  stay open on purpose: `/login` (the document itself) and `/assets` (build output, code not
  data - the login document cannot boot without its bundle). An auth database with no users
  gates nothing; that is what lets the per-app server suites run unauthenticated against
  in-memory dbs. The client half is thin: the three app api helpers redirect on a 401, and the
  launcher probes `/api/auth/me` once, which covers `npm run dev` where pages come from Vite
  rather than through the gate.
- **Ports:** 8100 API, 8101 Vite, 8150+ e2e (one per Playwright worker).
- **Deep-link fallback lives in two places.** `server/src/app.ts` handles production; the
  `appFallback` plugin in `web/vite.config.ts` does the same for the dev server. Without it a
  refresh on `/crm/contacts` serves the launcher. The lists differ by one on purpose: dev needs
  `login` in its `APPS` so `/login` resolves without the server gate in the way, while production
  serves `/login/` straight from static. They have disagreed before - check both when you touch
  routing.
- **One shared module: `web/src/shared/`.** The brand, the navigation strip, the theme and the
  session helpers are the only code the five documents have in common, and the
  `no-restricted-imports` rule allows it because that
  rule is a denylist of the sibling apps, not an allowlist. **Its CSS has to be self-contained.**
  It loads into four stylesheets that collide on `.brand` and `:root`, each app redefines its own
  palette under `[data-theme]` -
  so every class in `nav.css` is `bench-nav`-prefixed and every value is a literal, never a
  variable. The strip looks the same over all of them, which is the point: it is chrome above the
  app, not part of it.
- **One theme, chosen once.** `web/src/shared/theme.ts` writes `data-theme` on the document
  element and remembers the choice in `localStorage` under `bench.theme`; each entry point calls
  `initTheme()` **before it renders**, because setting it after the first paint flashes the wrong
  theme on every navigation between apps. The first visit follows the operating system. Every app
  defines its palette twice - once on `:root`, once under `[data-theme="dark"]` - and sets
  `color-scheme` so native controls follow.
- **Colour means state, not identity.** In the strip and on the launcher, amber marks the app you
  are in and nothing else; the apps are told apart by their glyph. That is what keeps a fourth app
  from needing a fourth brand colour. Inside an app, its own accents are its own business.
- **One dependency set per workspace.** All three UIs live in `web/`, so they share one set of
  versions: TypeScript 6, Vite 8, vitest 4, react-router 8, React 19.
- **TypeScript 6.0.3, pinned exactly, everywhere.** Root and both workspaces, one hoisted copy.
  6.0.3 is the last release carrying the JS compiler API that type-aware linting needs, so one
  compiler serves both `tsc --noEmit` and ESLint; TypeScript 7 is the native Go build and exposes no
  such API until 7.1. The pin is exact rather than `^6.0.3` because 6.1.0 would fall outside
  typescript-eslint's supported range. The cost is roughly three seconds a typecheck against 7.
  **Revisit when typescript-eslint supports the native compiler.** See
  [CONTROLS.md](./CONTROLS.md).
- **better-sqlite3 stays on 12.** `npm ci` prints one deprecation warning for its
  `prebuild-install` dependency; that is accepted, not an oversight. v13 ships `binding.gyp`
  inside the tarball next to its prebuilt binaries and relies on `gypfile: false` to stop npm
  compiling - but the lockfile and the registry's install metadata do not carry that field, so
  `npm ci` injects `node-gyp rebuild` and every install compiles from source. That succeeds
  silently on machines with Python and a C++ toolchain and fails hard on a stock Windows machine;
  the prebuilds inside the tarball are only read at require time, never at install. v12 downloads
  a prebuilt binary instead, which needs no toolchain. Revisit if npm starts carrying `gypfile`
  through the lockfile, or upstream stops shipping `binding.gyp` in the tarball.

## Adding a fourth app

A new `web/<name>/index.html`, a new `web/src/<name>/`, an entry in `vite.config.ts`
`rollupOptions.input`, the prefix in the `APPS` list in **both** `server/src/app.ts` and
`web/vite.config.ts`, and a card on the launcher in `web/src/home/App.tsx`. A backend, if it has
one, is a `server/src/<name>/` with its own database file opened in `server/src/index.ts` and its
router mounted at `/api/<name>` - and a `no-restricted-imports` entry in `eslint.config.js` so it
stays separate from its siblings.

Then the navigation: an icon in `web/src/shared/AppIcons.tsx`, an entry in the `APPS` list in
`web/src/shared/BenchNav.tsx`, the new key in that file's `AppKey` union, and
`<BenchNav active="<name>" />` above the app's own shell. No colour to pick - the strip's only
accent is amber, for wherever you are. Two things to get right in the app's own stylesheet: a
`[data-theme="dark"]` palette and `color-scheme`, and the height chain - the app's root element has
to leave room for a 47px strip; see how each of the three does it. The document's `<title>` ends
in `- Novhora` and its favicon is `/novhora.svg`, like the other entry points.

## Design

Palette: amber `#ecad0a`, blue `#209dd7`, purple `#753991` over grays, light and dark. Flat,
sharp, modern. See [STANDARDS.md](./STANDARDS.md) for the rules, including what to avoid.

## Related documents

- [PROCESS.md](./PROCESS.md) - how to implement a change and how to keep the test suite honest
- [STANDARDS.md](./STANDARDS.md) - coding standards
- [CONTROLS.md](./CONTROLS.md) - lint, static analysis, coverage and how each is enforced
- [e2e/EXPLORATORY.md](../e2e/EXPLORATORY.md) - what the automated suite deliberately does not cover
- [README.md](../README.md) - the short public-facing readme
