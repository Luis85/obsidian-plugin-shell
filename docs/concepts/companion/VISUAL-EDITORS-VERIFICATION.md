# Visual editors — verification receipt

Scope: the visual Page and Component editors ([VISUAL-EDITORS.md](VISUAL-EDITORS.md)) on branch
`feat/pr5-visual-editors`, targeting PR #5. This receipt records exact local executions. It does not authorize
qualification or release, which remain separate gates.

## Identity and environment

| Item | Value |
| --- | --- |
| Measured code commit | Final fix wave: `db95ad1` for every command in “Final fix wave” below (the maintainability classification change of the verification commit was measured by its own `check:maintainability` run). Earlier rows below record `c4af1bd` and fix round 1. |
| `docs/concepts/companion/index.html` | 3,374,608 bytes · SHA-256 `ba3a5b657ddea349c5c49c5dbc8857f7bcf06e2dc84b3fb27131187c02712d3a` (final fix wave; fix round 1 built 3,362,339 bytes · `5caecf01…cd17`) |
| `docs/concepts/companion/companion-project.json` | 2,242,139 bytes · SHA-256 `030d63a2a56e847de682205916aedb861a8ab0ed2457e4ba66fc2efd5a8c16ab` (v5: 27 pages, 54 components, 0 layouts, 54 revisions, 726 elements) |
| Platform | Windows 11 Pro 10.0.26200, Git Bash |
| Node / npm | Node 24.15.0 and npm 12.0.2 locally, **not** the pinned 24.21.0/11.19.1. The generated workspaces were installed with a separately installed npm 11.19.1 (`QUALIFIED_NPM`), as the workflow does. |
| Browser | Node `@playwright/test` 1.63.0 with its Chromium. Python Playwright is not installed. |
| Python | 3.14.4 |

## Results

| Command | Exit | Result |
| --- | --- | --- |
| `python3 scripts/concepts/build-companion.py --check` | 0 | Verified 3,362,339 bytes, SHA-256 as above |
| `python3 -B tests/concepts/companion-assembly.test.py` | 0 | 19 tests OK |
| `python3 scripts/concepts/export-companion-project.py --check` | 0 | Self-project verified: 2,242,139 bytes (Node Playwright fallback path, see untested scope) |
| `npm run test:visual` | 0 | 117 tests: 117 pass, 0 fail, 0 skipped, 0 todo |
| `npm run test:generator` | 0 | 295 tests: 294 pass, 0 fail, 1 skipped (“file loader rejects symlink source”: Windows refused a file symlink), 0 todo |
| `node tests/concepts/companion-visual-editors.browser.mjs` | 0 | 39/39 named checks passed |
| `python3 scripts/concepts/run-browser-checks.py --only visual-editors` | 0 | `visual-editors` (runner `node`): passed 39, failed 0. Evidence is bound to `html_sha256` `5caecf01…cd17` |
| `python3 scripts/concepts/run-browser-checks.py --real-storage` | 1 | Stops at its first suite, `generator-fixtures` (Python): `ModuleNotFoundError: No module named 'playwright'`. No Python browser suite ran (environment) |
| `npm run check:analyzer` | 0 | Full fallow dead-code, dependency, cycle, suppression and boundary analysis: zero findings, with the handoff archive present |
| `npm run check:source` | 0 | 796 inputs within code-line limits; locale parity passed |
| `npm run verify` | 1 | Stopped after the tooling step: “Tooling suites failed: cli, quality”. Both are Windows-only causes; see below |

### `npm run verify`, step by step

`verify.mjs` stops at the first failing step, and the tooling step runs every suite before failing. Each later step was
therefore run individually with the same arguments, in the same order and on the same tree.

| Step | Exit | Result |
| --- | --- | --- |
| `suites.mjs --check` | 0 | 236 test files in 23 suites, 29 helpers |
| `check-dependencies.mjs` | 0 | Exact versions, hashes and hooks passed |
| `bundling/build.mjs` | 0 | Built |
| Tooling · cli | 1 | 96 tests: 94 pass, **1 fail, 1 cancelled** (see Windows-only failures) |
| Tooling · generator | 0 | 295: 294 pass, 1 skipped |
| Tooling · visual | 0 | 117: 117 pass |
| Tooling · companion | 0 | 188: 187 pass, 1 skipped (at `c4af1bd`; after fix round 1 `npm run test:companion`: 191, 190 pass, 1 skipped) |
| Tooling · test-data / makers / release | 0 | 30/30 · 34/34 · 49/49 |
| Tooling · native | 0 | 81: 79 pass, 2 skipped (`OBSIDIAN-DEV-06`, `-19`, platform watcher cases) |
| Tooling · setup | 0 | 34: 33 pass, 1 skipped |
| Tooling · quality | 1 | 68: 67 pass, **1 fail** (see Windows-only failures) |
| `vue-tsc --noEmit` | 0 | |
| `lint-source.mjs` | 0 | 103 files |
| ESLint `src` · ESLint tests/harness | 0 · 0 | `--max-warnings 0` |
| `check-test-quality.mjs` | 0 | 104 files |
| `check-repository.mjs` | 0 | 241 Markdown files, 911 local links |
| `check-source.mjs` | 0 | 796 inputs |
| `check-presentation.mjs` | 0 | 25 inputs, 9 Vue |
| `check-architecture.mjs` | 0 | Boundaries and zone coverage passed |
| `check-analyzer.mjs` | 0 | Zero findings |
| `check-maintainability.mjs` | 0 | `status: passed`, `failures: []` (604 s) |
| `makers/entities.mjs --check` · `events/catalog.mjs --check` | 0 · 0 | |
| Production coverage (`vitest.production.config.mjs`) | 0 | 73 files, 413 tests passed; all files 97.57 % statements, 95.11 % branches, 97.79 % functions, 99.5 % lines |
| `coverage-inventory.mjs --selected-core` | 0 | |
| `check-tokens.mjs` | 0 | 968 observed, 133 reviewed token names |
| `check-artifacts.mjs` | **1** | `ARTIFACT_SIZE_BUDGET`: `dist/styles.css` is 153,511 B against the 100 KiB budget (`dist/main.js` is 599,267 B against 1 MiB). Inherited; see below |
| `verify-baseline.mjs --repeat 3` | 0 | 52 tests × 3 runs passed (the baseline itself reports “Release blocked”, as intended) |
| `vite build --config vite.harness.config.mjs` | 0 | Built |

**Windows-only failures.** All three reproduce independently of this work, as recorded on the branch since Task 19/20:

- **cli:** `framework-new-from-project.checks.mjs` fails with `EPERM: operation not permitted, symlink …`. Local file
  symlinks need a Windows privilege; CI Windows runners pass.
- **cli:** “compiled kit bootstraps, imports and generates without dependencies or Git” is cancelled after its
  300,000 ms test timeout on this machine.
- **quality:** `[ANALYZER-ARCHIVE]` fails because GNU `tar` reads `C:` as a remote host: `tar: Cannot connect to C:
  resolve failed`, exit 128.

**Inherited artifact budget.** `dist/styles.css` (153,511 B) exceeds the 100 KiB budget. This branch has no `src/`,
style-pipeline, bundling or `check-artifacts.mjs` changes since upstream `0121893`, which merged PR #24 and is an
ancestor of HEAD:

- `git diff 0121893 HEAD -- src/` is empty.
- The only `package.json` change is the added `test:visual` script.

The overage therefore comes from the PR branch state, not from the visual editors, and is surfaced for the owner's
decision. No threshold was changed.

## Generated-output qualification

These are the commands the `generated-companion` job of `ci.yml` (formerly `project-generator.yml`) runs. Each installs the generated workspace with `QUALIFIED_NPM` (npm
11.19.1) outside the checkout, then builds, type-checks (`vue-tsc`) and tests it. All runs used code commit `c4af1bd`.

| Command | Exit | Result |
| --- | --- | --- |
| `node scripts/companion/qualify-project.mjs` | 0 | `scaffold-qualified`. 81 definitions (27 pages, 54 components, 54 revisions), 131 visual interactions, 1,841 files. Vitest: 35 files passed / 33 skipped; 860 passed, 33 todo. `test:ui-effects`: 129 pass, 0 fail, 2 todo |
| `… --boundary-fixture` | 0 | Vitest 891 passed, 34 todo. ui-effects: 131 pass, 0 fail, 1 todo |
| `… --provider-fixture` | 0 | Vitest 893 passed, 33 todo. ui-effects: 129 pass, 0 fail, 2 todo |
| `node scripts/companion/qualify-styles.mjs` | 0 | harness-build 0; nuxt-styles 3 passed |
| `node scripts/companion/qualify-starter.mjs <id>` for all nine starters | 0 × 9 | See the per-starter table below |

Per-starter results for `qualify-starter.mjs`. Every run reported `status: passed` with `npm ci` 0 and `verify:project` 0:

| Starter | Vitest | ui-effects |
| --- | --- | --- |
| blank | 12 passed | 0 / 0 |
| command-utility | 50 passed, 10 todo | 6 pass, 3 todo |
| quick-capture | 74 passed, 12 todo | 8 pass, 4 todo |
| tasks-projects | 90 passed, 13 todo | 8 pass, 4 todo |
| knowledge-collection | 90 passed, 12 todo | 8 pass, 4 todo |
| daily-journal | 74 passed, 13 todo | 8 pass, 4 todo |
| vault-dashboard | 74 passed, 13 todo | 8 pass, 4 todo |
| note-inspector | 60 passed, 10 todo | 6 pass, 3 todo |
| import-integration | 82 passed, 13 todo | 8 pass, 4 todo |

ui-effects had 0 failures in every starter.

Todos are declared acceptance or implementation TODOs (`IMPLEMENTATION_REQUIRED`, adapter `it.todo`), not passing
assertions.

## Migration evidence

`migrateCompanionDocument` on real v4 data dropped canvas geometry and nothing else:

| Input | Positions / sizes dropped | Other counters |
| --- | --- | --- |
| Self-project (`tests/fixtures/companion/detail-v4.json`) | 847 / 847 | All 0 |
| Each of the eight non-blank starters (pre-migration bytes from `6772c42`) | 30–40 / 30–40 | All 0 |

The other counters are `droppedOutlineRefs`, `droppedSlotRules`, `listBindings`, `droppedFallbackBindings`,
`droppedInteractions`, `truncatedNotes`, `unparsedMembers`, `droppedProps` and `createdComponents`.

## Untested or environment-limited scope

- **Python browser suites were never executed locally**, because Python Playwright is not installed. This covers the
  aggregated `run-browser-checks.py` runner and the five legacy suites edited for the visual editors
  (`companion-storage`, `companion-storymap-polish`, `companion-storymaps`, `companion-project-starters`,
  `companion-generator-boundaries`). They need a CI run. Only the Node visual-editors suite
  ran.
- **`export-companion-project.py`'s Python Playwright branch is unverified.** Only its Node fallback ran.
- **Windows-only tooling failures** (symlink privilege, the compiled-kit timeout, GNU `tar` with `C:` paths) hide those
  tests' real outcome on this machine. CI Windows/Linux runners are the evidence of record.
- **`ARTIFACT_SIZE_BUDGET`** fails on `dist/styles.css`, 153,511 B against 100 KiB. This is inherited from the PR
  branch and is an open gate.
- **Pinned toolchain:** local runs used Node 24.15.0/npm 12.0.2. The generated workspaces used the pinned npm 11.19.1,
  but not the pinned Node.
- **Not tested at all:**
  - physical touch and pen input (keyboard and synthetic pointer only);
  - screen readers;
  - formal WCAG conformance (keyboard alternatives are implemented, and no conformance is claimed);
  - native companion conversion (the concept is a browser prototype);
  - real Nuxt UI rendering inside the concept (only generated projects use Nuxt UI);
  - external-library adapters beyond generated stubs and a fake-adapter lifecycle test.

## Fix round 1 — legacy store kept for a failed upgrade

`veRestoreVisual` dropped an inherited legacy store whenever the restored snapshot had none. For a project whose
startup upgrade failed (schema 4, the only copy in `detailDesigns`), undo of any unrelated edit deleted that copy and
persisted the loss. The store is now dropped only when the restored design holds visual designs (upgrade completed);
a still-legacy design keeps it on every travel path (outline, storymap, visual undo/redo).

| Command | Exit | Result |
| --- | --- | --- |
| `node --test tests/tooling/companion-visual-state.checks.mjs` | 0 | 17/17 (RED on the previous source: 6 fail, “legacy store lost after undo”) |
| `npm run test:companion` | 0 | 191 tests: 190 pass, 1 skipped |
| `python3 scripts/concepts/build-companion.py --check` · assembly test | 0 · 0 | 3,362,339 bytes `5caecf01…cd17` · 19 tests OK |
| `node tests/concepts/companion-visual-editors.browser.mjs` · `run-browser-checks.py --only visual-editors` | 0 · 0 | 39/39 · passed 39, bound to `5caecf01…cd17` |
| `npm run check:analyzer` · `npm run check:source` | 0 · 0 | zero findings · 796 inputs |

## Final fix wave — review findings C1, I1–I5, M1–M8

Fixes: failed-upgrade legacy designs survive project/blueprint export and blueprint import is refused (C1); designed or
navigated-to surfaces cannot be removed and orphaned designs are listed, openable and repairable (I1); longest-path
composition depth (I2); closed per-tag attribute contract with safe literal `img src` (I3); internal-reference
remapping tests (I4); deprecated `DetailAction`, edge → interaction mapping and the documented regeneration path (I5);
reserved export names, real adapter paths, authored action order, message patterns, control-list drift guard, revision
usages, slot notes/a11y (M1–M7). Details and RED/GREEN evidence: the wave's report.

| Command | Exit | Result |
| --- | --- | --- |
| `npm run test:visual` | 0 | 164 tests: 164 pass, 0 fail |
| `npm run test:generator` | 0 | 301 tests: 300 pass, 0 fail, 1 skipped (“file loader rejects symlink source”, Windows symlink privilege); 1,333.5 s |
| `node --test tests/tooling/companion-*.checks.mjs` (10 files) | 0 | 197 tests: 196 pass, 1 skipped |
| `node tests/concepts/companion-visual-editors.browser.mjs` | 0 | 42/42 named checks (new: failed-upgrade recovery, designed-surface removal refused, orphan repair; the legacy import check also requires the interaction ID list) |
| `python3 scripts/concepts/run-browser-checks.py --only visual-editors` | 0 | passed 42, failed 0, bound to `html_sha256` `ba3a5b65…12d3a` |
| `python3 scripts/concepts/build-companion.py --check` | 0 | Verified 3,374,608 bytes, `ba3a5b65…12d3a` |
| `python3 -B tests/concepts/companion-assembly.test.py` | 0 | 19 tests OK |
| `python3 scripts/concepts/export-companion-project.py --check` | 0 | Self-project unchanged: 2,242,139 bytes · `030d63a2…c16ab` (Node fallback path) |
| `npm run check:analyzer` | 0 | Zero findings (`scripts/companion/runtime/detail-actions.ts` is an analyzer entry: generated projects and the retained pre-visual runtime import its types, like `visual-runtime.ts`) |
| `npm run check:source` | 0 | 798 inputs within code-line limits |
| `npm run check:maintainability` | 0 | `status: passed`, `failures: []` (656 s). The first run stopped with `METRIC_UNCLASSIFIED_INPUT` for the new `tests/fixtures/companion/legacy-generated/detail-runtime.ts.txt`; generated-output fixtures stored as `.ts.txt` are now measured as TypeScript fixtures, like the `.vue.txt` golden SFCs |
| `npm run typecheck:generator` | 0 | |
| `node scripts/companion/qualify-project.mjs` | 0 | `scaffold-qualified`: 81 definitions, 131 visual interactions, 1,845 files. Vitest 35 files passed / 33 skipped; 861 passed, 33 todo. ui-effects 129 pass, 0 fail, 2 todo |
| `… --boundary-fixture` | 0 | Vitest 892 passed, 34 todo. ui-effects 131 pass, 0 fail, 1 todo |
| `… --provider-fixture` | 0 | Vitest 894 passed, 33 todo. ui-effects 129 pass, 0 fail, 2 todo |
| `node scripts/companion/qualify-starter.mjs <id>` × 9 | 0 × 9 | Every starter `status: passed`, `npm ci` 0, `verify:project` 0; table below |

Each generated project gains one runtime test (“runs mixed actions in authored order and stops at the first failing
action”), hence +1 passed everywhere.

| Starter | Vitest | ui-effects |
| --- | --- | --- |
| blank | 13 passed | 0 / 0 |
| command-utility | 51 passed, 10 todo | 6 pass, 3 todo |
| quick-capture | 75 passed, 12 todo | 8 pass, 4 todo |
| tasks-projects | 91 passed, 13 todo | 8 pass, 4 todo |
| knowledge-collection | 91 passed, 12 todo | 8 pass, 4 todo |
| daily-journal | 75 passed, 13 todo | 8 pass, 4 todo |
| vault-dashboard | 75 passed, 13 todo | 8 pass, 4 todo |
| note-inspector | 61 passed, 10 todo | 6 pass, 3 todo |
| import-integration | 83 passed, 13 todo | 8 pass, 4 todo |

**Known flake (M8): `tests/tooling/project-starters.checks.mjs` in the full generator suite.** Its per-starter
“real plan/apply yields an independent workspace, safe replay and owned input” cases (and the fixture-parity
“real generated CLI reviews, applies, replays…” case) plan, apply and replay real workspaces for about a minute each.
When the generator's template inputs change during the run, or the machine is saturated, the replay no longer sees
only `unchanged` files and they fail: an earlier run of this wave, overlapping source edits and a browser run, failed
7 starter cases and the parity case at `project-starters.checks.mjs:67` / `project-generator-fixture-parity.checks.mjs:105`.
The clean rerun on the committed tree above passed all of them. Treat such a failure as a rerun candidate only after
confirming nothing changed the tree during the run.

Still not executed locally: the Python browser suites (no Python Playwright), `npm run verify` as a whole (the
Windows-only failures and the inherited `ARTIFACT_SIZE_BUDGET` above are unchanged by this wave, which has no `src/`
change), the pinned Node 24.21.0 (Node 24.15.0/npm 12.0.2 locally; generated workspaces used npm 11.19.1).
