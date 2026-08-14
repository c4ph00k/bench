# Space

A personal knowledge manager at `/space` - a single-user Notion. Pages and blocks, databases with
table, board and list views, quick-find search, light and dark themes. Backed by
`data/personal-space.db`.

- Frontend: `web/src/space/` - `components/`, `editor/`, `database/`, `api.ts`, `theme.ts`
- Backend: `server/src/space/` - `db.ts`, `routes/`, `seed.ts`
- Tests: `server/test/space/`, `web/src/space/**/*.test.tsx`, `e2e/space/`

This is the best-covered app in the repo: server suites, jsdom component tests, and an e2e suite
including an adversarial spec.

## Data model

Six tables in `server/src/space/db.ts`:

- `pages` - the tree. A row's `type` is `page`, `database` or `row`; `parent_id` self-references,
  and `position` orders siblings. Database rows are pages of type `row` whose parent is the
  database, which is why they have titles, icons and blocks of their own.
- `blocks` - ordered content within a page, `content` held as JSON.
- `properties` and `property_options` - database columns and their select options.
- `row_values` - a row's value per property.
- `views` - persisted per-database, per-kind view config (filters, sort, grouping).

Ids are UUID strings, not integers.

## The seeded workspace

`server/src/space/seed.ts` fills an empty database with a worked example rather than a stub: nine
top-level sections (Home, Projects, Travel, Notes, Reading List, Health & Habits, Work, Learning,
Archive), three levels deep in places, and **five databases** - Reading List, Trip Planner, Project
Tracker, Tasks and Course Log. Between them they use every property type, every block type and all
three view kinds, with filters and sorts saved per view. The e2e suite reads it: Trip Planner's five
rows and their order are asserted directly, so add rows elsewhere rather than there.

**Creating a page navigates first and refreshes the tree afterwards** (`Sidebar.createPage`). The
other order leaves you on the old page for as long as the tree takes to load, which grows with the
workspace - and a test that types into "the title" before the new page arrives is typing into the
old one. `e2e/space/pages.spec.ts` waits for an empty title before filling it, for exactly that
reason.

## Routes and API

Two routes: `/` (redirects to the first page) and `/p/:pageId`, under `basename="/space"`.

API under `/api/space`: `tree`, `pages`, `pages/:id/blocks` (+ `blocks/order`), `blocks/:id`,
`databases/:id` (+ `properties`, `rows`, `rows/order`, `views/:kind`), `properties/:id` (+
`options`), `rows/:rowId` (+ `values`), `search`.

## Editor

`web/src/space/editor/`. Blocks are contenteditable rows with a slash menu; types include
headings, bullets, numbered lists, to-dos, quote, callout, code and divider.

**The editor flushes pending edits with a raw `keepalive` fetch when it unmounts** - it bypasses the
`api` module deliberately, because `keepalive` is the point. Two consequences:

- Tests must stub global `fetch`, not only the `api` module. `web/src/space/test/setup.ts` does this
  for every test; without it Node's fetch rejects the relative URL and the unhandled rejection
  fails the run under vitest 4.
- Editing behaviour is asynchronous by design. Assert on what the server returns, not on timing.

## Databases and views

`web/src/space/database/`. One dataset, three views - table, board, list - with filters and sort
persisted per view in the `views` table. `viewLogic.ts` holds the filter and sort logic and is unit
tested directly; prefer adding there rather than inside a view component.

## The kanban board

`BoardView.tsx`, drag via dnd-kit (`@dnd-kit/core` + `@dnd-kit/sortable`).

- Cards group by a select property. Dropping on a column changes the row's value for that property.
- **Cards can also be reordered within a column.** Cards are `useSortable` inside a
  `SortableContext`; `onDragEnd` distinguishes a drop on a column from a drop on a card, and
  reorders against the full row list so `position` stays meaningful outside the board. Persisted
  through `PUT /api/space/databases/:id/rows/order`, which validates that the ids are a permutation
  of the database's rows.
- The board is a **grid** - `grid-auto-flow: column` with `minmax(150px, 1fr)` - so any number of
  columns shares the width instead of overflowing.
- **dnd-kit has no keyboard sensor here**, so e2e drags are mouse-driven and need the 1440x900
  viewport. At 1280 a card sits partly outside the viewport and the drag never activates.

## Themes

`theme.ts` sets `data-theme` on the root element and persists the choice. Every colour is a
`:root` custom property with a dark override - do not hardcode a colour in a component.

## Related

- [REQUIREMENTS.md](./REQUIREMENTS.md) - the original product brief
- [../PROJECT.md](../PROJECT.md), [../PROCESS.md](../PROCESS.md), [../STANDARDS.md](../STANDARDS.md)
- [../../e2e/EXPLORATORY.md](../../e2e/EXPLORATORY.md) - editor feel, dark mode and mouse drag are
  left to judgement
