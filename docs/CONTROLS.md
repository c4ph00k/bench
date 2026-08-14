# Controls - lint, static analysis and enforcement

**None of this is built yet.** This records decisions taken on 2026-08-14 so the work can be picked
up without relitigating them. Every decision below is settled; nothing here is still under
discussion. There is no linter in the repo today and none of the commands below exist yet.

Two things already partly exist: **coverage** thresholds, which are configured and passing at a
narrower scope than intended - see [F](#f-coverage-thresholds) - and the **process rules** in
[PROCESS.md](./PROCESS.md) and [STANDARDS.md](./STANDARDS.md), which are already written for the
world this lands in. PROCESS.md says so at the top, so nobody runs `npm run check` and wonders why
it is missing.

Build it in the order given at the end of this document.

## The toolset

One ESLint 9 flat config at the repo root covering `web`, `server` and `e2e`. A single config
rather than one per workspace: type-aware linting reaches both tsconfigs through typescript-eslint's
`projectService`, and one config means one process and one cache. Rules are **strict** -
`strictTypeChecked` plus `stylisticTypeChecked`.

| Package | Job |
| --- | --- |
| `eslint` | The runner, flat config |
| `typescript-eslint` | Type-aware TS rules. The strict core |
| `eslint-plugin-sonarjs` | Code smells: cognitive complexity, duplicated blocks, identical functions, dead stores |
| `eslint-plugin-react-hooks` | Rules of hooks, exhaustive-deps |
| `eslint-plugin-react-refresh` | Export shapes that break Vite HMR |
| `eslint-plugin-jsx-a11y` | Accessibility - the e2e suite selects by role and label, so a11y regressions break tests |
| `@vitest/eslint-plugin` | No focused or skipped tests left behind |
| `eslint-plugin-playwright` | No conditional expects, no `waitForTimeout` |
| `prettier` | Formatting. See [G](#g-prettier) |
| `eslint-config-prettier` | Switches off the ESLint rules that would fight Prettier |

Three standalone tools, not ESLint plugins:

| Tool | Job |
| --- | --- |
| `knip` | Unused files, exports and dependencies - dead code ESLint structurally cannot see |
| `jscpd` | Copy-paste detection *across* files; SonarJS only sees duplication within one |
| `gitleaks` | Leaked credentials, working tree and git history. See [H](#h-secrets-and-pii) |

Plus two things that need no package, only configuration:

- ESLint's built-in size rules - `complexity`, `max-depth`, `max-lines`, `max-lines-per-function`,
  `max-params`. These are what enforce "short functions, short modules" from
  [STANDARDS.md](./STANDARDS.md).
- **`no-restricted-imports`**, stopping the three apps importing from each other. Shape it as a
  denylist of the sibling apps - "`web/src/crm` may not import from `web/src/space` or
  `web/src/groove`" - rather than an allowlist of permitted paths, so a future shared module such as
  `web/src/shared/` is allowed by default and needs no rule change.

  Note what this does **not** cover: the collision [PROJECT.md](./PROJECT.md) warns about is the
  three global stylesheets, and a lint rule cannot see CSS. Separate HTML entry points remain the
  thing that keeps the styles apart. This rule guards the module graph only.

### Deliberately excluded

- **`eslint-plugin-unicorn`.** Three of its rules fight this codebase directly.
  `prevent-abbreviations` would rename `db` (185 uses), `(req, res)` (39 Express handlers), `(e) =>`
  (73 handlers) and `Props` (32 files) - and it reads as abbreviations the names this project
  considers plain. `no-null` hits 301 `null`s, which is not a style habit: SQLite stores NULL, the
  columns are nullable, and `better-sqlite3` binds `null` and rejects `undefined`. `filename-case`
  defaults to kebab-case against PascalCase components. Once those are off, what remains overlaps
  heavily with `strictTypeChecked` and SonarJS.

## Landing strict on the existing code

**Decided: fix it properly. No warn-only tier, no suppressions.**

There are 44 `any` sites, nearly all `as any` query returns in `server/src/crm/db.ts` and the three
Space route files. They cascade into `no-unsafe-return`, `no-unsafe-assignment` and
`no-unsafe-member-access` at every call site, so the message count will be far higher than 44. The
fix is to give the queries real row types rather than to silence the rule.

`no-floating-promises` will also flag deliberate fire-and-forget calls - the optimistic
`api.patch` in `Pipeline.tsx` is the known one. Those want `void` or an awaited call, decided case
by case; the optimistic update is intentional and must keep working.

## A. npm scripts

The base layer every other layer calls.

```
npm run lint          eslint across the repo
npm run lint:fix      the same, applying fixes
npm run format        prettier --write
npm run format:check  prettier --check, for CI
npm run knip          unused files, exports, dependencies
npm run gitleaks      leaked credentials - see H
npm run check:secrets PII and files that must never be tracked - see H
npm run jscpd         cross-file duplication
npm run check         typecheck + lint + format:check + gitleaks + check:secrets + knip
                      + test with coverage
```

`npm run check` is the one to run when finishing a change, and [PROCESS.md](./PROCESS.md) requires
it before every commit. Unit tests run **with coverage** inside it, so the 80% threshold in F is a
gate rather than a report.

`jscpd` stays outside it: duplication findings are advisory rather than pass/fail, so they should
not gate a green run.

## B. npm lifecycle

**`prebuild` runs lint.** npm fires it before `npm run build` automatically, so it cannot be
forgotten and nothing extra needs typing.

**`e2e/global-setup.ts` is deliberately left alone.** It shells out to `npm run build`, so
`npm run e2e` lints first and pays the cost - roughly doubling its wall time. That is a considered
trade, not an oversight. Rerouting global-setup to `npm run build -w web` would skip the root
`prebuild` and buy the time back; do not do it without asking.

Note the one gap: `pre*` scripts only fire for `npm run <script>`. Calling `vite build` directly
walks past them.

## C. Git hooks - lefthook, on pre-commit

`lefthook`, configured in `lefthook.yml` at the root, installed through a `prepare` script so
`npm install` wires it up with no extra step. **The hook runs on pre-commit.**

Because the rules are type-aware, prefer a full `npm run lint` over linting only staged files.
typescript-eslint reasons over the whole program, so a staged subset can pass while the change has
broken a file that was not staged.

**This layer is a nudge, not a gate.** `git commit --no-verify` bypasses any client-side hook, by
design - git lets you override your own hooks. D is the gate.

It is also a **backstop, not the mechanism**. [PROCESS.md](./PROCESS.md) requires whoever did the
work - agent or human - to run `npm run check` before committing. This hook exists for the times
that slips. A hook firing means the process already failed.

## D. CI - the real gate

A GitHub Actions workflow on push and pull request running **`npm run check` and `npm run e2e`** -
naming the aggregate rather than restating its parts, so CI cannot drift out of step with what A
defines. It needs `gitleaks` installed; use the official `gitleaks/gitleaks-action`.
**Branch protection on `main` requires it to pass before merge.**

This is the only layer that cannot be bypassed. "Nothing lands unless it passes" means nothing is
*merged* - not that nothing is *committed*, which no client-side hook can guarantee.

## E. Claude Code Stop hook

A `Stop` hook in `.claude/settings.json` running `npm run lint`, blocking the agent from ending a
turn while it fails. This is the only lever that binds the coding agent rather than asking it to
remember; `settings.json` is committed, unlike the `settings.local.json` already in the repo.

**The loop hazard is real and must be handled.** A Stop hook that blocks on failure can cycle
forever: the agent stops, the hook fails and forces it to continue, it cannot fix the problem, it
stops again, the hook fails again. Claude Code passes `stop_hook_active` in the hook's stdin JSON,
set true when the agent is already continuing because of a Stop hook. **The hook must read it and
allow the stop when it is true**, which caps the cost at one extra turn instead of an unbounded
loop. Verify the field name against the current Claude Code hooks documentation when implementing -
this is the whole safety mechanism, so do not guess it.

Two more things that keep it sane: run `lint` only, not the full `check`, so a slow suite does not
run on every turn end; and pass ESLint's actual messages back through the hook output, since a bare
"lint failed" gives the agent nothing to act on.

## F. Coverage thresholds

**This control already exists** and is already set at 80% statements. It is vitest's built-in
`coverage.thresholds`, configured per workspace:

- `server/vitest.config.ts` - includes `src/**`, excludes `src/index.ts`, `statements: 80`
- `web/vite.config.ts` - includes **`src/space/**` only**, `statements: 80`

Measured on 2026-08-14 with `npm run coverage`:

| Scope | Statements | Branches | Functions |
| --- | --- | --- | --- |
| `server/src` | 81.58% | 73.01% | 67.82% |
| `web/src/space` | 86.11% | 73.43% | 86.98% |
| `web/src/crm` (not currently measured) | **9.78%** | 4.08% | 8.39% |

**Decided: 80% goes into `npm run check`, measured across every app.** Two consequences, both real
work rather than configuration:

**The `include` widens from `src/space/**` to all of `src/**`.** That brings in two apps with almost
no unit tests:

| App | Source in scope | Unit test files | Coverage today |
| --- | --- | --- | --- |
| `web/src/space` | 2,817 lines | 11 | 86% |
| `web/src/crm` | 2,378 lines | 1 (`types.test.ts`) | 9.78% |
| `web/src/groove` | 1,689 lines (audio excluded) | 0 | 0% |
| `web/src/home` | 59 lines | 0 | 0% |

So roughly **4,100 lines of untested UI** need tests before this threshold can be turned on. Do it
app by app, not in one pass, and do not lower the bar to make a red run green.

**`web/src/groove/audio/**` is excluded from the `include`** - 1,053 lines across four files. jsdom
has no `AudioContext`, so they cannot be unit tested without a mock that would assert nothing about
how anything sounds.
[EXPLORATORY.md](../e2e/EXPLORATORY.md) already records that Groove's audio is not automatically
testable, and a coverage threshold must not be allowed to imply otherwise - excluding it and saying
so is the honest option. Groove's pure modules (`music.ts`, `params.ts`, `patches.ts`, `filter.ts`)
stay in, and are ordinary logic to test.

**Thresholds stay on `statements` only for now.** Branches sit at ~73% in both workspaces, so adding
a branches threshold at 80 fails today. Revisit once the statement threshold holds everywhere.

## G. Prettier

**Decided: adopt Prettier and reformat the tree.**

The tree currently carries two styles, split cleanly along the lines of the repos the apps came
from:

| Area | Semicolons | Quotes |
| --- | --- | --- |
| `server/src`, `web/src/space`, `e2e` | yes | double |
| `web/src/crm`, `web/src/groove` | no | single |

So [STANDARDS.md](./STANDARDS.md)'s "match the file around you" currently means two different things
depending on which app you are in. Prettier ends that, which is the main prize - but it means
picking a winner and rewriting roughly two thousand lines of the losing style.

**Settings: Prettier's defaults, with no configuration.** That means semicolons, double quotes and a
print width of 80 - the first two are what the larger body of code already does. An empty config
file is deliberate: Prettier's value is ending the argument, and every option added reopens it.

The one visible consequence is width. Parts of the codebase run to about 110 columns, so 80 will
rewrap JSX and long call signatures noticeably taller - the recharts components in
`web/src/crm/components/DashboardCharts.tsx` most of all. Raising `printWidth` to 100 is a one-line
change if the result reads badly, but start from the default.

How to land it:

- **One commit that does nothing but reformat**, separate from any behaviour change, so review and
  `git blame` stay readable.
- Add a `.git-blame-ignore-revs` file naming that commit, so `git blame` skips past it. GitHub
  honours it automatically.
- `eslint-config-prettier` goes last in the flat config so Prettier owns formatting and ESLint stops
  having opinions about it.

### Keeping it applied

Formatting must happen automatically, not by remembering to run it. Four places, and the split
between which ones **write** and which ones **check** matters:

| Where | Covers | Action |
| --- | --- | --- |
| Editor on save | Ed, in VS Code | write |
| `npm run format`, in the finishing steps | The agent's edits | write |
| lefthook pre-commit | Anything that slipped past both | write, then re-stage |
| `npm run check`, `prebuild`, CI | The gate | **check only** |

- **On save** needs `.vscode/settings.json` with `editor.formatOnSave` and Prettier as the default
  formatter, plus `.vscode/extensions.json` recommending the extension. Note that `.gitignore`
  currently ignores `.vscode/`, so shipping these needs `!.vscode/settings.json` and
  `!.vscode/extensions.json` exceptions.
- **On save does nothing for the agent** - it writes files through tools, not an editor, so
  format-on-save never fires for its changes. A Claude Code `PostToolUse` hook was considered as the
  equivalent and **rejected**: reformatting a file immediately after an edit invalidates the text the
  agent is about to match for its next edit, which is confusing for little gain. Instead
  [PROCESS.md](./PROCESS.md) puts `npm run format` in the finishing steps, before `npm run check`.
  This matters: without it `format:check` inside `check` fails on every unformatted agent edit.
- **Never `prettier --write` in `prebuild` or CI.** A build that rewrites its own source is not
  reproducible, and in CI it would pass while leaving the repository unformatted. Those layers run
  `--check` and fail.

## H. Secrets and PII

**Two tools, with a clean division of labour.** `gitleaks` handles credentials, which is a solved
problem with a maintained ruleset and no reason to hand-roll. A small script in this repo handles
the two things no general scanner can know about: what counts as PII here, and which files must
never be tracked.

Turn on **GitHub secret scanning with push protection** as well. It is free on public repositories,
it is server-side, and it is the only one of the three that can stop a secret before it leaves the
machine.

### gitleaks

Run as `npm run gitleaks`, inside `npm run check`.

`gitleaks` is a Go binary, not an npm package, so it will not arrive with `npm install`. Install it
locally with `brew install gitleaks`; in CI use the official `gitleaks/gitleaks-action`. **If the
binary is missing, fail with an actionable message rather than skipping.** A control that silently
passes when its tool is absent is worse than no control.

Two modes matter: working-tree scanning for `check` and the pre-commit hook, and history scanning.
**Do a full history scan once when this is first built** - the repo is only a handful of commits
old, so it is seconds of work, and it establishes that nothing is already buried in the past.

Custom rules and allowlists go in `.gitleaks.toml`.

### The bespoke script

`scripts/check-secrets.mjs`, run as `npm run check:secrets`, zero dependencies. Scans tracked files
only, via `git ls-files`. With gitleaks covering credentials, this script is small and stays that
way - it exists for the repo-specific rules:

**Structural.** Fail if `.env` is tracked, or if anything under `data/` is. Both are gitignored
today; this makes it durable rather than dependent on `.gitignore` staying correct.

**PII.** Measured on 2026-08-14 across tracked files: 22 email-shaped strings and 15 phone-shaped
strings, all of them deliberate fixture data.

- **The seed files are excluded** - `server/src/crm/seed.ts` and `server/src/space/seed.ts`. They
  exist to hold synthetic data, and that is the standing assumption: nothing real goes in them. If
  that assumption ever stops holding, this exclusion is the reason a leak would go unnoticed.
- Everywhere else, flag email shapes and phone shapes, with one carve-out: **phone numbers in the
  `555-01xx` range pass.** That is the NANP block reserved for fiction, it cannot dial a real
  person, and the existing fixtures in the server tests and `e2e/crm/records.spec.ts` already use
  it.

**No generic entropy check.** It is the classic false-positive engine - hashes, minified output,
base64 data URIs - and with gitleaks handling real credential patterns it would add noise and
nothing else.

### Suppression

One escape hatch: an inline `// allow-secret: <reason>` on the offending line. The reason is
required; a bare marker is not accepted. No baseline file - in a repo this size an unexplained
standing exception is worse than a red run.

### What none of this can do

Once a secret has been pushed to a public repository it must be **rotated, not deleted**. Removing
it from the tree, or even from history, does not unpublish it.

## Branching

Ed creates a branch before work starts. The agent commits to it and **never pushes**; Ed pushes and
opens the pull request, CI runs there, and the required check in D gates the merge into `main`.

There is no conflict between committing and branch protection: protection governs `main` only, a
feature branch is unprotected, and the agent never pushes anything anywhere.

**If a session begins on `main`, branch before committing** rather than committing onto `main`, and
say so in the reply.

Because the agent never pushes, CI does not see the work until Ed pushes the branch. That is what
makes running `npm run check` locally a requirement rather than a courtesy - see
[PROCESS.md](./PROCESS.md).

## Order of work

This work lives on the **`controls`** branch, cut from `main` on 2026-08-14.

The pieces depend on each other, so build them in this order:

1. ESLint config, Prettier and the reformat commit, `npm run lint` / `format` / `check`.
2. Fix what strict finds - the `any` removal is the bulk of it.
3. `knip`, `jscpd`, `no-restricted-imports`, `gitleaks` (with a one-off history scan) and
   `check:secrets`.
4. Coverage: widen the `include`, then write tests app by app until 80% holds.
5. Enforcement last - `prebuild`, lefthook, the stop hook, the GitHub Action. Wiring these up before
   the tree is green just means everything is blocked.

## Related documents

- [PROCESS.md](./PROCESS.md) - implementing a change and testing it. Its finishing checklist will
  need a lint step once this exists.
- [STANDARDS.md](./STANDARDS.md) - the coding standards these rules mechanise.
- [PROJECT.md](./PROJECT.md) - layout and architectural decisions.
