---
type: Increment
id: e2e-source-paths
title: "Check the source-project paths in e2e qualification"
owner: "Claude"
size: M
status: Done
e2e: required
refs: []
pullRequests: [e2e-source-paths-kickoff]
branch: "increment/e2e-source-paths"
base: main
---

# Check the source-project paths in e2e qualification

<!-- Developer handoff for one pull request. `npm run dor` checks it before implementation,
`npm run dod` after it. Replace every <placeholder>; delete these comments when done. -->

## Summary

Five e2e-gated jobs fail on unchanged `main` (2cb7c484) when run with `e2e: true` (runs 38078591637, 38078593203 and 38080701858), and so on every pull request that carries the `e2e` label. Each one still reads a path from before the source-project split: generated projects and the shell now keep the plugin under `src/plugin/` and tooling under `tooling/`, and the harness preview serves `/harness/app/`. A sixth concept browser suite, `project-transfer`, was hidden behind the first failure and still expected the imported starter to use the default `src`/`tests` folders and treated `<codebase>/tests` as an overlap.

## Outcome

The example-removal, generated-companion stylesheet, Airship preview, concept browser and Generated Journey Lens jobs check the paths the generator and the harness actually use, so an `e2e` run fails only on real regressions.

## Scope

### In scope

- `tooling/examples/plan.mjs`: stop rewriting the foundation browser test's served URL `/harness/app/` to `/src/plugin/harness/app/`, which the harness preview never serves.
- `tooling/companion-tools/qualify-styles.mjs`: import the generated stylesheet from `src/plugin/harness/app/main.ts`.
- `tooling/airship/qualify.mjs`: expect resolved element sources under `src/plugin/generated/`.
- `.github/workflows/companion-concept-verification.yml`: check the generated `tooling/tests/obsidian/journey-lens.obsidian.ts`.
- Concept browser checks: the generator fixture reads `src/plugin/main.ts`, `tooling/test-data/` and `src/plugin/generated/`; project transfer compares with the imported starter's own folders and uses a still-overlapping example.
- `[EXAMPLES-SERVED-HARNESS]` in `tooling/tests/example-removal.checks.mjs`.

### Out of scope

- The generator, the harness layout and the companion folder rules: they are correct; only the checks were stale.
- `projects/companion`, a standalone project with its own copy of the concept checks.
- The open Moment advisory that keeps the live security gate red, tracked in `docs/development/MOMENT-ADVISORY-EXCEPTION.md`.

## Acceptance criteria

<!-- One `- [ ] AC-n: text` per criterion. At completion tick it and add
`Evidence: \`path\`` (a test file, doc or report that exists). -->

- [x] AC-1: The planned example removal keeps the foundation browser test on the URL the harness preview serves, and its harness imports resolve.
  Evidence: `tests/acceptance/e2e-source-paths/ac-1.checks.mjs`
- [x] AC-2: Every generated-project path that the stylesheet, Airship, concept browser and Journey Lens qualification reads is a file the generator plans for the companion starter.
  Evidence: `tests/acceptance/e2e-source-paths/ac-2.checks.mjs`

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

- `tooling/examples/plan.mjs`: the removal template rewrite.
- `tooling/tests/example-removal.checks.mjs`: the served-harness regression test.
- `tooling/companion-tools/qualify-styles.mjs`: the generated harness entry.
- `tooling/airship/qualify.mjs`: the generated source prefix.
- `.github/workflows/companion-concept-verification.yml`: the Journey Lens test path.
- `src/companion/tests/concepts/companion-generator-fixtures.browser.py`: the generated project paths.
- `src/companion/tests/concepts/companion-project-transfer.browser.py`: the imported folders and the overlap example.
- `tests/acceptance/e2e-source-paths/**`: the acceptance tests.
- `docs/increments/e2e-source-paths.md`: this handoff.
- `docs/pull-requests/e2e-source-paths-kickoff.md`: the kick-off pull request record.

## Test plan

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- Suite `quality`: runs `tooling/tests/example-removal.checks.mjs`.
- Suite `acceptance`: runs the AC-1 and AC-2 acceptance tests.
- New test `tests/acceptance/e2e-source-paths/ac-1.checks.mjs`: runs `[EXAMPLES-SERVED-HARNESS]` in a fresh process.
- New test `tests/acceptance/e2e-source-paths/ac-2.checks.mjs`: plans the companion starter with the real generator and matches the paths each qualification reads.
- Gate `npm run check:self-review`: no findings on the diff.
- E2E: required — the fixes are in e2e-gated jobs, so only the `e2e` label proves them.

## Docs impact

<!-- - `docs/path.md` (how-to): what changes   — or —   None — reason -->

None — the checks follow the documented source-project layout; no documented behavior changes.

## Changelog

<!-- - Added: text  (Added, Changed, Deprecated, Removed, Fixed or Security)  — or —  None — reason -->

None — internal test and qualification fixes with no user-facing change.

## Risks and rollback

A check could now pass while a generator regression moves a file again; AC-2 ties each read path to the generator's plan so that drift fails in the acceptance suite. Roll back by reverting this pull request.

## Dependencies

None

## Open questions

<!-- "None" when ready. Each open question blocks the Definition of Ready. -->

None

## Pull requests

<!-- wb:pull-requests generated by node bin/app; edits here are replaced -->
- [[docs/pull-requests/e2e-source-paths-kickoff|Kick-off: Check the source-project paths in e2e qualification]] · New
<!-- /wb:pull-requests -->

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/main` (merge base `2cb7c4842df3`)
- Changed files: 11 (4 added, 7 modified, 0 renamed, 0 deleted)
- E2E decision: required; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `tooling/examples/plan.mjs` | 1 |
| `tooling/tests/example-removal.checks.mjs` | 1 |
| `tooling/companion-tools/qualify-styles.mjs` | 1 |
| `tooling/airship/qualify.mjs` | 1 |
| `.github/workflows/companion-concept-verification.yml` | 1 |
| `src/companion/tests/concepts/companion-generator-fixtures.browser.py` | 1 |
| `src/companion/tests/concepts/companion-project-transfer.browser.py` | 1 |
| `tests/acceptance/e2e-source-paths/**` | 2 |
| `docs/increments/e2e-source-paths.md` | 1 |
| `docs/pull-requests/e2e-source-paths-kickoff.md` | 1 |
| Outside the affected areas | 0 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/acceptance/e2e-source-paths/ac-1.checks.mjs` |
| AC-2 | yes | `tests/acceptance/e2e-source-paths/ac-2.checks.mjs` |

### Gates

From `node bin/app check --plan`:

| Gate | Command | Required |
| --- | --- | --- |
| check | `node bin/app check --fast --base origin/main` | yes |
| coverage-production | `npm run test:coverage:production` | yes |
| suite:maker:pty | `node tooling/testing/suites.mjs maker:pty` | no |
| suite:maker | `node tooling/testing/suites.mjs maker` | no |
| suite:workbench-plugins | `node tooling/testing/suites.mjs workbench-plugins` | no |
| suite:airship | `node tooling/testing/suites.mjs airship` | yes |
| suite:compiler | `node tooling/testing/suites.mjs compiler` | no |
| suite:compiler:properties | `node tooling/testing/suites.mjs compiler:properties` | no |
| suite:prototypes | `node tooling/testing/suites.mjs prototypes` | no |
| suite:prototypes:python | `node tooling/testing/suites.mjs prototypes:python` | no |
| suite:companion:mvp | `node tooling/testing/suites.mjs companion:mvp` | no |
| suite:runtime | `node tooling/testing/suites.mjs runtime` | no |
| suite:cli | `node tooling/testing/suites.mjs cli` | no |
| suite:cli:journey | `node tooling/testing/suites.mjs cli:journey` | no |
| suite:generator | `node tooling/testing/suites.mjs generator` | no |
| suite:visual | `node tooling/testing/suites.mjs visual` | no |
| suite:companion | `node tooling/testing/suites.mjs companion` | no |
| suite:companion:schema | `node tooling/testing/suites.mjs companion:schema` | no |
| suite:companion:assembly | `node tooling/testing/suites.mjs companion:assembly` | no |
| suite:companion:browser | `node tooling/testing/suites.mjs companion:browser` | yes |
| suite:companion:visual-browser | `node tooling/testing/suites.mjs companion:visual-browser` | no |
| suite:companion:starter-browser | `node tooling/testing/suites.mjs companion:starter-browser` | no |
| suite:test-data | `node tooling/testing/suites.mjs test-data` | no |
| suite:makers | `node tooling/testing/suites.mjs makers` | yes |
| suite:native | `node tooling/testing/suites.mjs native` | no |
| suite:setup | `node tooling/testing/suites.mjs setup` | no |
| suite:acceptance | `node tooling/testing/suites.mjs acceptance` | yes |
| suite:quality | `node tooling/testing/suites.mjs quality` | yes |
| suite:baseline | `node tooling/testing/suites.mjs baseline` | no |
| suite:e2e | `node tooling/testing/suites.mjs e2e` | no |
| suite:project | `node tooling/testing/suites.mjs project` | no |
| suite:project:ui-effects | `node tooling/testing/suites.mjs project:ui-effects` | no |
| suite:obsidian | `node tooling/testing/suites.mjs obsidian` | no |
| verify | `npm run verify` | yes |
