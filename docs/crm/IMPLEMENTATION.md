# CRM

A personal sales CRM at `/crm`. Organizations, contacts, deals, a drag-and-drop pipeline,
activities with follow-ups, and a dashboard. Backed by `data/crm.sqlite`.

- Frontend: `web/src/crm/` - `pages/`, `components/`, `types.ts`, `api.ts`, `styles.css`
- Backend: `server/src/crm/` - `db.ts`, `routes.ts`, `seed.ts`
- Tests: `server/test/crm/`, `web/src/crm/types.test.ts` (the derived values), `e2e/crm/`

## Data model

Four tables in `server/src/crm/db.ts`: `organizations`, `contacts`, `deals`, `activities`.
Contacts and deals link to an organization; deals and activities link to a contact. Deleting an
organization sets those links null rather than cascading.

Deal stages, in order: **New, Qualified, Proposal, Negotiation, Won, Lost.**
Contact statuses: lead, qualified, customer. Activity types: note, call, email.

## Probability and expected revenue

This is the part of the domain worth reading before changing anything on the pipeline or dashboard.

- **Every deal carries a `probability` (0-100).** `STAGE_PROBABILITY` holds the per-stage defaults
  and is declared in **two** places that must agree: `server/src/crm/db.ts` and
  `web/src/crm/types.ts`. New 10, Qualified 25, Proposal 50, Negotiation 75, Won 100, Lost 0.
- **Moving a deal re-bases its probability on the new stage.** `updateDealStage` does this
  server-side; the pipeline mirrors it optimistically so the totals move with the card rather than
  after it; the deal form re-bases on stage change too. This is what makes expected revenue respond
  to a drag - without it, dragging would only change a column.
- **Expected revenue = value x probability.** `expectedValue`, `sumValue` and `sumExpected` in
  `web/src/crm/types.ts` are the single source; the pipeline header, the stage columns, the deals
  table and the dashboard tiles all read from them.
- **Open means not Won and not Lost** (`isOpen`, `OPEN_STAGES`). Pipeline totals count open deals
  only, so winning a deal removes its value from the pipeline.
- An explicit probability set on the deal form is kept until the stage changes.

## Dashboard

`web/src/crm/pages/Dashboard.tsx` composes and fetches; the charts themselves are
`components/DashboardCharts.tsx`, via recharts. Every figure they draw comes from a function in
`types.ts` - none of the aggregation lives in the component, which is what makes it unit-testable
(`types.test.ts`).

Tiles, then **four charts**, then recent activity and follow-ups.

- Tiles: open deals, pipeline value, expected revenue, deals won (6mo), revenue won (6mo). The two
  "6 mo" tiles read the **trailing slice** of the month range, not all of it - the range now runs
  into the future, and a win dated next month is not revenue you have booked.
- **Revenue and deal volume** (`monthRange`, `monthlyRevenue`) - twelve months, six back and six
  forward, with a dashed marker on the first forecast month. Won value fills the months behind it,
  weighted pipeline the months ahead. The two stack rather than sit side by side: a month is nearly always one or the
  other, and stacking keeps the bars readable across twelve of them. Deal volume rides over the top
  as a line on its own right-hand axis.
- **Revenue funnel** (`pipelineFunnel`) - **cumulative**: value at or past each stage, which is why
  the labels carry a trailing `+`. Charting value *sitting in* each stage produces an inverted
  funnel, because historical Won dwarfs the open stages. If the funnel ever widens downwards, this
  is why. Wins are capped at the trailing six months; without a horizon every win ever recorded
  keeps widening the top. Lost deals never appear - a lost deal overwrites the stage it reached, so
  there is nothing to place it at, and a **conversion** funnel is not buildable on this schema.
- **Win rate** (`winLoss`) - closed deals in the trailing six months, won against lost, with the
  rate in the middle of the donut.
- **Top organizations** (`topOrganizations`) - open pipeline by organization, largest five.

**The charts set `isAnimationActive={false}`, deliberately.** recharts animates bars in from zero,
and anything that re-measures the container restarts that animation - a full-page screenshot, a
viewport resize, an HMR reload. Screenshots taken during it show axes, labels and correct totals
with **no bars at all**, which reads as a broken chart and is not one. Turning animation off makes
the page deterministic to capture. If you see an empty-looking chart here, check this before
debugging the data.

## Pipeline

`web/src/crm/pages/Pipeline.tsx`, drag via `@hello-pangea/dnd`.

- Six columns, colour-coded from `STAGE_COLOR` (gray, blue, purple, amber, green, red) and passed
  down as a `--stage` CSS custom property so the header dot, card hover, probability badge and
  drag-over outline all take the stage colour.
- The board is a **grid** - `repeat(6, minmax(0, 1fr))` - so the columns always fit. Do not go back
  to fixed-width flex columns; that is what produced a horizontal scrollbar.
- Header shows total pipeline and expected revenue; each column shows its own total and expected.
  Those figures carry `data-testid` attributes (`pipeline-total`, `stage-total-<Stage>`, ...) that
  the e2e suite reads.
- **Drag with the keyboard in tests**: Space to lift, arrows, Space to drop. Deterministic and free
  of viewport sensitivity. The mouse path works but is not covered.

## Tables

`web/src/crm/components/DataTable.tsx`, built on TanStack Table.

Supports sorting, per-row edit and delete icon actions, an empty state, and a summary footer. Pass
`rowLabel` so the action buttons get accessible names - "Edit Bluepeak Software" - which is what the
e2e specs select on.

**Derived columns must live on the row data, not in an `accessorFn`.** TanStack memoises its core
row model on `data` alone, so an accessor that reads a `useMemo` map keeps the values it produced
before the related fetch resolved. This showed up as every count in the Organizations table
rendering `0` while the footer total was correct. Build an enriched row type instead - see
`OrgRow` in `pages/Organizations.tsx`.

## Conventions

- Forms are modals (`Modal.tsx`, `role="dialog"` with the title as its accessible name); deletes go
  through `ConfirmDialog`.
- Money and dates format through `formatMoney` / `formatDate` in `components/Chips.tsx`.
- Icons are inline SVG in `components/Icons.tsx`, one 24-grid, sized by prop.
- Sidebar: Home link, brand, then nav. All three share one icon column - check alignment against
  the brand mark when touching it.

## Related

- [REQUIREMENTS.md](./REQUIREMENTS.md) - the original product brief
- [../PROJECT.md](../PROJECT.md), [../PROCESS.md](../PROCESS.md), [../STANDARDS.md](../STANDARDS.md)
- [../../e2e/EXPLORATORY.md](../../e2e/EXPLORATORY.md) - what is left to manual judgement here
