# Bench

Four local-first apps behind one server. No login, no cloud - everything runs on your machine and
your data lives in local SQLite files. Light and dark, one toggle for all four.

|             |            |                                                                                                                     |
| ----------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| **CRM**     | `/crm`     | Personal sales CRM: organizations, contacts, deals, a drag-and-drop pipeline, activities and a dashboard.           |
| **Space**   | `/space`   | Personal knowledge manager: pages and blocks, databases with table / board / list views, quick find.                |
| **Rolodex** | `/rolodex` | Personal CRM for the people in your life: who to contact, circles, birthdays, and a timeline of every conversation. |
| **Groove**  | `/groove`  | Browser groovebox: four synth units, one transport, a master DJ filter. All Web Audio, no samples.                  |

## Run it

Requires [Node.js](https://nodejs.org) 24 or newer.

```bash
npm install
npm start
```

Then open **http://localhost:8100**. The first run builds the frontend and seeds all three
databases with sample data.

## Development

- `npm run dev` - API on :8100 plus the Vite dev server with hot reload on :8101. Use **:8101**.
- `npm run build` - typecheck and bundle the frontend.
- `npm test` - unit tests, backend and frontend.
- `npm run check` - everything at once: typecheck, lint, formatting, secrets, dead code and
  coverage. Needs [gitleaks](https://gitleaks.io) (`brew install gitleaks`).
- `npm run e2e` - Playwright end-to-end suite across all four apps
  (`npx playwright install chromium` once, first). Each worker runs its own server and database,
  so specs never share state.
- [e2e/EXPLORATORY.md](./e2e/EXPLORATORY.md) - the manual checks automation cannot make, Groove's
  audio above all.

## Layout

One npm workspace root with two workspaces, so a single `npm install` and a single set of versions.

- `web/` - one Vite project with an HTML entry point per app: `index.html` (launcher), `crm/`,
  `space/`, `rolodex/`, `groove/`. Sources live in `web/src/<app>/`, with the shared navigation
  strip and theme in `web/src/shared/`. Separate documents mean each app keeps its own global
  stylesheet without collisions.
- `server/` - one Express app. `/api/crm/*`, `/api/space/*` and `/api/rolodex/*`, plus the built
  frontend with deep-link fallback. Groove has no backend.
- `data/` - `crm.sqlite`, `personal-space.db` and `rolodex.sqlite`, created and seeded on first run.
- `e2e/` - Playwright specs.
- `docs/` - working documentation: [PROJECT.md](./docs/PROJECT.md) (purpose and architecture),
  [PROCESS.md](./docs/PROCESS.md) (implementing and testing a change),
  [STANDARDS.md](./docs/STANDARDS.md) (coding standards),
  [CONTROLS.md](./docs/CONTROLS.md) (lint, static analysis, coverage and how each is enforced),
  plus a directory per app -
  `docs/crm/`, `docs/space/`, `docs/rolodex/`, `docs/groove/` - each with its implementation notes
  and its original requirements.
