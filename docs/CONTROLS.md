# Controls - lint, static analysis and enforcement

This records the decisions taken on 2026-08-14 and what has since been built against them. Every
decision below is settled; nothing here is still under discussion.

## Status

| Step                                                                  | State                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------ |
| 1. ESLint, Prettier, the reformat commit, `lint` / `format` / `check` | **Done**                                               |
| 2. Fix what strict finds                                              | **Done** - 1,586 errors to 0                           |
| 3. knip, jscpd, no-restricted-imports, gitleaks, check-secrets        | **Done**                                               |
| 4. Coverage widened to every app, then 80%                            | **Part done** - widened; at 52%, threshold not yet met |
| 5. Enforcement: prebuild, lefthook, Stop hook, GitHub Action          | **Not started**                                        |

`npm run check` runs today and passes every step except coverage, which fails the 80% threshold on
purpose: the bar is set where it is meant to end up, and the tests to reach it are the outstanding
work. See [F](#f-coverage-thresholds) for exactly what is missing.

**Nothing enforces any of this yet.** Until step 5 lands, `npm run check` is something you run, not
something that runs itself - so run it. [What implementation changed](#what-implementation-changed)
records the decisions that could only be made with the code in front of us.

## The toolset

One ESLint 9 flat config at the repo root covering `web`, `server` and `e2e`. A single config
rather than one per workspace: type-aware linting reaches both tsconfigs through typescript-eslint's
`projectService`, and one config means one process and one cache. Rules are **strict** -
`strictTypeChecked` plus `stylisticTypeChecked`.

| Package                       | Job                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `eslint`                      | The runner, flat config                                                                  |
| `typescript-eslint`           | Type-aware TS rules. The strict core                                                     |
| `eslint-plugin-sonarjs`       | Code smells: cognitive complexity, duplicated blocks, identical functions, dead stores   |
| `eslint-plugin-react-hooks`   | Rules of hooks, exhaustive-deps                                                          |
| `eslint-plugin-react-refresh` | Export shapes that break Vite HMR                                                        |
| `eslint-plugin-jsx-a11y`      | Accessibility - the e2e suite selects by role and label, so a11y regressions break tests |
| `@vitest/eslint-plugin`       | No focused or skipped tests left behind                                                  |
| `eslint-plugin-playwright`    | No conditional expects, no `waitForTimeout`                                              |
| `prettier`                    | Formatting. See [G](#g-prettier)                                                         |
| `eslint-config-prettier`      | Switches off the ESLint rules that would fight Prettier                                  |

Three standalone tools, not ESLint plugins:

| Tool       | Job                                                                               |
| ---------- | --------------------------------------------------------------------------------- |
| `knip`     | Unused files, exports and dependencies - dead code ESLint structurally cannot see |
| `jscpd`    | Copy-paste detection _across_ files; SonarJS only sees duplication within one     |
| `gitleaks` | Leaked credentials, working tree and git history. See [H](#h-secrets-and-pii)     |

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

That is what happened. It came to 1,586 errors, and they are all fixed - see below for the shape of
the work and for the rules that turned out not to fit.

## What implementation changed

Decisions that could only be taken with the code in front of us. The plan above stands; these are
the places reality argued back.

### TypeScript 7 cannot drive type-aware linting, so the repo is on 6.0.3

**This is the one to know about.** TypeScript 7 is the native Go compiler: `node_modules/typescript`
ships `tsc.js` and nothing else, and the JS compiler API that type-aware linting is built on is
gone. typescript-eslint peer-requires `<6.1.0` and refuses to install alongside 7 at all; its own
issue tracker says the programmatic API for tsgo lands in 7.1. So `strictTypeChecked` - the whole
point of the toolset - cannot run against TypeScript 7 at all.

This is not a quirk of this repo. It is where the whole ecosystem is: typescript-eslint
[#12518][ts-eslint-7] tracks it, and the API it needs lands in TypeScript 7.1. Anyone running
type-aware linting who upgrades to 7 hits exactly this. It also shows up in the download numbers:
7.0.2 is the `latest` tag but only ~7% of weekly installs, against ~44% for 5.9.3 and ~14% for
6.0.3.

**Decided: the whole repo is pinned to TypeScript 6.0.3 - one version, root and both workspaces.**
6.0.3 is the last release that ships the JS compiler API (`lib/typescript.js`, `createProgram`,
`createLanguageService`), and it sits inside typescript-eslint's supported range, so one compiler
serves both `tsc --noEmit` and the linter. This reverses the "TypeScript 7" line in
[PROJECT.md](./PROJECT.md), which is why it was Ed's call rather than an implementation detail.

The version is pinned **exactly**, not `^6.0.3`, in all three `package.json` files. A caret would
allow 6.1.0, which is outside typescript-eslint's `<6.1.0` peer range - the upper bound is a hard
constraint, not a preference.

What this bought, beyond one version:

- **The root `optionalDependencies` block is gone** - all twenty `@typescript/typescript-*` platform
  packages. It only ever existed because hoisting 5.9 to the root pushed 7 down into the workspaces,
  and npm does not install the optional platform binaries of a nested package, so `tsc` died with
  "Unable to resolve @typescript/typescript-darwin-arm64". No nested compiler, no missing binary,
  no workaround.
- **The two compilers can no longer disagree.** They did, rarely: 5.9 and 7 infer some generics
  differently, and `eslint --fix` once removed an assertion that `tsc` then demanded back. That
  class of problem is now structurally impossible.

`npm run check` still runs typecheck **and** lint, which is now belt-and-braces rather than
load-bearing.

**The cost is build speed, and it is real but small at this size.** Measured on the same tsconfigs:

| Compiler | server | web   | total     |
| -------- | ------ | ----- | --------- |
| 7.0.2    | 0.12s  | 0.36s | **0.48s** |
| 6.0.3    | 0.79s  | 2.55s | **3.34s** |

Seven times slower, and three seconds. Revisit when typescript-eslint supports tsgo in 7.1: at that
point the whole arrangement collapses into "use 7", and this section becomes history.

**Upgrading past 6.0.3 is therefore a deliberate, coordinated change**, not a routine bump - check
typescript-eslint's peer range first.

[ts-eslint-7]: https://github.com/typescript-eslint/typescript-eslint/issues/12518

### npm drops platform binaries when you add a dependency

Adding any dependency rewrites the lockfile and can drop optional platform packages already on
disk - [npm/cli#4828]. Reproduced deliberately: `npm install -D is-odd`, a package with no relation
to anything here, removed `@rolldown/binding-darwin-arm64` from `node_modules` and took the
lockfile from nine references to seven. vitest then refuses to start.

It is not silent - npm prints "removed N packages" - but it does not say what it removed or that it
mattered, and the failure surfaces later as a vitest startup error. Rolldown's own message names
the npm issue and the remedy: `rm -rf node_modules package-lock.json && npm install`. Removing
`node_modules` alone is not enough; the lockfile has to go too.

**In this repo that means all three `node_modules`.** `rm -rf node_modules` at the root leaves
`web/node_modules` and `server/node_modules` in place, and a package nested there shadows the
hoisted copy for anything running inside that workspace. The TypeScript 6 migration hit exactly
this: the root had 6.0.3 while both workspaces still held a stale nested 7.0.2, so `tsc` inside a
workspace was still the old compiler. The full incantation is:

```bash
rm -rf node_modules web/node_modules server/node_modules package-lock.json && npm install
```

[npm/cli#4828]: https://github.com/npm/cli/issues/4828

### Rules that did not fit, and why

Each of these was measured before it was switched off. They are in `eslint.config.js` with the same
reasons, next to the rule.

| Rule                                                                                              | Why not                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sonarjs/prefer-read-only-props`                                                                  | `Readonly<Props>` on 61 component signatures, for a mutation this codebase never makes and which `Readonly` is too shallow to prevent                                                                                      |
| `@typescript-eslint/no-non-null-assertion`                                                        | Contradicts `non-nullable-type-assertion-style`, also on, which asks for `x!` over `x as T`. Every site is one TypeScript's narrowing cannot follow                                                                        |
| `@typescript-eslint/no-unnecessary-type-parameters`                                               | Flags `useFetch<Deal[]>(url)`, which is the JSON boundary. Moving the cast to each call site would not make it any more checked                                                                                            |
| `sonarjs/function-return-type`                                                                    | A sort key is a number for a numeric column and a string otherwise; collapsing it would sort 10 before 9                                                                                                                   |
| `prefer-nullish-coalescing` (strings only)                                                        | `job_title \|\| "—"` is deliberate - `??` would render the empty string                                                                                                                                                    |
| `restrict-template-expressions` (numbers only)                                                    | Interpolating a number is unambiguous; `string \| undefined` printing "undefined" still errors                                                                                                                             |
| `no-confusing-void-expression` (arrow shorthand)                                                  | The braced form it wants at ~190 React handlers reads worse                                                                                                                                                                |
| In `e2e/` and `scripts/`: `sonarjs/assertions-in-tests`, `no-os-command-from-path`                | Plugin limits, not findings: it does not recognise `await expect.poll(...)`, and its PATH rule is aimed at services, not a local run of this repo's own toolchain                                                          |
| In `web/src/groove/audio/**`: `complexity`, `max-params`, `cognitive-complexity`, `pseudo-random` | Building a Web Audio graph is long and linear, a voice's parameters are its signal inputs, and EXPLORATORY.md records that none of it has automated coverage - a refactor to satisfy a metric could only be checked by ear |

### Size thresholds

CONTROLS.md never named numbers. They are `max-lines` 500, `max-lines-per-function` 200,
`complexity` 15, `max-depth` 4, `max-params` 5, with seed and patch modules (literal data) exempt
from the line counts and `max-lines-per-function` off for `.tsx`, whose bodies are mostly a JSX
tree the rule counts as logic. `complexity` and `cognitive-complexity` are the rules that measure
whether a function is actually hard to follow, and they stay strict everywhere outside Groove's
audio.

Those numbers were calibrated against the codebase rather than picked round, and they still bit:
`databasesRouter` was split into four registration groups, `matchesFilter` became a lookup table,
and the contact and organization detail pages gave up a duplicated deals list to a shared
component.

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
not gate a green run. It reports 2.2% across the tree today.

All of these exist and run. `knip` needed `knip.json` to be told the multi-page entry points, or it
reports all 48 web source files as unused.

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
_merged_ - not that nothing is _committed_, which no client-side hook can guarantee.

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

| Scope                                  | Statements | Branches | Functions |
| -------------------------------------- | ---------- | -------- | --------- |
| `server/src`                           | 81.58%     | 73.01%   | 67.82%    |
| `web/src/space`                        | 86.11%     | 73.43%   | 86.98%    |
| `web/src/crm` (not currently measured) | **9.78%**  | 4.08%    | 8.39%     |

**Decided: 80% goes into `npm run check`, measured across every app.** Two consequences, both real
work rather than configuration:

**The `include` widens from `src/space/**` to all of `src/**`.** Done. That brought in two apps with
almost no unit tests, and closing that gap is **the outstanding work on this whole document**.

Where it stands, measured with `npm run coverage`:

| Scope                       | Statements | What is missing                                |
| --------------------------- | ---------- | ---------------------------------------------- |
| `server/src`                | 82%        | nothing - already over                         |
| `web/src/space`             | 92%        | nothing - already over                         |
| `web/src/crm`               | 81%        | that is the non-component code only; see below |
| `web/src/crm/components`    | **0%**     | every form, table, chart and chip              |
| `web/src/crm/pages`         | **0%**     | all eight pages                                |
| `web/src/groove`            | 54%        | `App.tsx`; the pure modules are done           |
| `web/src/groove/components` | **0%**     | all eleven components                          |
| `web/src/home`              | **0%**     | the launcher, 59 lines                         |
| **web overall**             | **52%**    | against a threshold of 80                      |

Written so far: Groove's note and chord maths, the filter curve and its readout, the shipped
patches, the param specs, and the CRM's fetch wrapper and formatters. What remains is component and
page rendering - the largest single piece of work left in this document. Do it app by app, not in
one pass, and **do not lower the bar to make a red run green.**

Until it is met, `npm run check` fails on coverage and only on coverage.

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

| Area                                 | Semicolons | Quotes |
| ------------------------------------ | ---------- | ------ |
| `server/src`, `web/src/space`, `e2e` | yes        | double |
| `web/src/crm`, `web/src/groove`      | no         | single |

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

| Where                                    | Covers                          | Action               |
| ---------------------------------------- | ------------------------------- | -------------------- |
| Editor on save                           | Ed, in VS Code                  | write                |
| `npm run format`, in the finishing steps | The agent's edits               | write                |
| lefthook pre-commit                      | Anything that slipped past both | write, then re-stage |
| `npm run check`, `prebuild`, CI          | The gate                        | **check only**       |

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
- The same idea, added while building it: **addresses on a reserved domain pass** - `example.com`,
  `.net`, `.org`, and the `.test`, `.invalid` and `.localhost` TLDs. RFC 2606 and RFC 6761 reserve
  those for exactly this, and a fixture using one cannot reach a real person. Four server fixtures
  moved onto `example.com` rather than take a suppression; that is the outcome the control is for.

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

1. ~~ESLint config, Prettier and the reformat commit, `npm run lint` / `format` / `check`.~~ Done.
2. ~~Fix what strict finds - the `any` removal is the bulk of it.~~ Done.
3. ~~`knip`, `jscpd`, `no-restricted-imports`, `gitleaks` (with a one-off history scan) and
   `check:secrets`.~~ Done; history was clean across all 27 commits.
4. Coverage: `include` is widened. **Still to do:** tests for CRM's components and pages, Groove's
   components and `App.tsx`, and the launcher, until 80% holds. See [F](#f-coverage-thresholds).
5. Enforcement last - `prebuild`, lefthook, the stop hook, the GitHub Action. **Not started.**
   Wiring these up before the tree is green just means everything is blocked, and coverage is not
   green yet.

## Related documents

- [PROCESS.md](./PROCESS.md) - implementing a change and testing it.
- [STANDARDS.md](./STANDARDS.md) - the coding standards these rules mechanise.
- [PROJECT.md](./PROJECT.md) - layout and architectural decisions.
