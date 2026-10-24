---
type: Increment
id: generated-inventory-headroom
title: "Generated prototypes keep first-run inventory headroom"
owner: "Claude"
size: M
status: Done
e2e: none
refs: []
pullRequests: [generated-inventory-headroom-kickoff]
branch: "increment/generated-inventory-headroom"
base: main
---

# Generated prototypes keep first-run inventory headroom

<!-- Developer handoff for one pull request. `npm run dor` checks it before implementation,
`npm run dod` after it. Replace every <placeholder>; delete these comments when done. -->

## Summary

A brainstorm prototype from a fresh project sat only about 140 KB below the 32,000,000-byte first-run inventory bound (`FIRST_RUN_LIMIT` in `src/cli/adapters/first-run-inventory.ts`), and prototypes built on the larger example starters were already over it; PR #214 tipped the maker suite over with about 100 KB of extra generated output. Generated projects now omit more framework-maintainer content, the same content the developer kit already omits, and a generator test fails clearly before the bound is reached. The bound itself is unchanged.

## Outcome

A brainstorm prototype from a fresh project and from every example starter stays at least 500 KB and 1,000 entries below the unchanged first-run inventory bounds, and a regression fails a named generator test with the largest contributors instead of failing makers with `FIRST_RUN_LIMIT`.

## Scope

### In scope

- `framework-scope.ts` and `framework-docs.ts`: omit the Capacity Planner and Iteration Planner prototypes, the companion concept's dated records and implementation handoff, `MAIN-RECONCILIATION.md`, and the concept's opt-in browser verification with its runner, `concept-metrics` test and workflow.
- The developer kit's matching exclusion of the two planner prototypes.
- Named exports of the unchanged first-run bounds and a generator budget test with a stated margin.

### Out of scope

- The 32 MB and 5,000-entry first-run bounds themselves; changing them needs an owner decision.
- Excluding `bin/` from the inventory: a generated project's `check` script runs `node bin/app`, so it is executed input.
- The built companion page `docs/concepts/companion/index.html` and the generation and maker provenance receipts.

## Acceptance criteria

<!-- One `- [ ] AC-n: text` per criterion. At completion tick it and add
`Evidence: \`path\`` (a test file, doc or report that exists). -->

- [x] AC-1: A brainstorm prototype from a fresh project and from every example starter stays at least 500 KB and 1,000 entries below the unchanged first-run inventory bounds, measured exactly as `firstRunInventory` counts them.
  Evidence: `tests/acceptance/generated-inventory-headroom/ac-1.checks.mjs`
- [x] AC-2: Generated projects omit the planner prototypes, the companion concept's dated records, implementation handoff and opt-in browser verification, keep the concept's design and how-to documents and test kit, and still pass their own suite manifest check.
  Evidence: `tests/acceptance/generated-inventory-headroom/ac-2.checks.mjs`

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

- `src/cli/adapters/first-run-inventory.ts`: named exports of the unchanged bounds.
- `src/cli/adapters/framework/distribution.ts`: the kit omits the two planner prototypes.
- `src/cli/compiler/emitters/framework-scope.ts`: concept record and review record classification.
- `src/cli/compiler/emitters/framework-docs.ts`: maintainer-only files and prefixes.
- `src/cli/tests/project-generator-inventory-budget.checks.mjs`: the budget test.
- `src/cli/tests/support/inventory-budget.mjs`: the shared measurement and margin of the budget and AC-1 tests.
- `src/cli/tests/project-generator-framework-scope.checks.mjs`: scope helper cases.
- `src/cli/tests/interactive-maker-compiler-emitters-kit.checks.mjs`: maintainer-only path cases.
- `tests/acceptance/generated-inventory-headroom/**`: the AC-1 and AC-2 acceptance tests.
- `CHANGELOG.md`: the Unreleased entry.
- `docs/increments/generated-inventory-headroom.md`: this handoff.
- `docs/pull-requests/generated-inventory-headroom-kickoff.md`: the pull request record.

## Test plan

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- Suite `generator`: the budget test, the framework scope test and the strict generated suite inventory test.
- Suite `compiler`: generated output and template snapshot behaviour.
- Suite `maker`: the brainstorm maker tests that failed with `FIRST_RUN_LIMIT` and the kit emitter cases.
- Suite `cli`: the developer kit distribution tests.
- Suite `acceptance`: runs the AC-1 and AC-2 acceptance tests.
- New test `src/cli/tests/project-generator-inventory-budget.checks.mjs`: fails on the previous scope with the measured size and largest contributors.
- Gate `node bin/app check --fast --base origin/main`: the diff-scoped checks.
- E2E: none — generated file selection and a size test only, no UI.

## Docs impact

<!-- - `docs/path.md` (how-to): what changes   — or —   None — reason -->

None — the exclusions follow the existing documented policy in `framework-scope.ts` and the kit's maintainer-only lists; no guide describes the omitted records.

## Changelog

<!-- - Added: text  (Added, Changed, Deprecated, Removed, Fixed or Security)  — or —  None — reason -->

- Changed: Generated projects no longer receive the framework's planner prototypes, the companion concept's dated records, implementation handoff or maintainer-only browser verification; brainstorm prototypes regain about 1.3 to 1.9 MB below the unchanged 32 MB first-run inventory bound, guarded by a generator test with a 500 KB margin.

## Risks and rollback

A generated project loses only framework records and the concept's opt-in browser checks of a page it cannot rebuild; its suite manifest check stays green because the omitted suites are optional and their runner is omitted with them. Roll back by reverting this pull request.

## Dependencies

None

## Open questions

<!-- "None" when ready. Each open question blocks the Definition of Ready. -->

None

## Pull requests

<!-- wb:pull-requests generated by node bin/app; edits here are replaced -->
- [[docs/pull-requests/generated-inventory-headroom-kickoff|Kick-off: Generated prototypes keep first-run inventory headroom]] · New
<!-- /wb:pull-requests -->

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/main` (merge base `1c48a74b837c`)
- Changed files: 13 (6 added, 7 modified, 0 renamed, 0 deleted)
- E2E decision: none; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `src/cli/adapters/first-run-inventory.ts` | 1 |
| `src/cli/adapters/framework/distribution.ts` | 1 |
| `src/cli/compiler/emitters/framework-scope.ts` | 1 |
| `src/cli/compiler/emitters/framework-docs.ts` | 1 |
| `src/cli/tests/project-generator-inventory-budget.checks.mjs` | 1 |
| `src/cli/tests/support/inventory-budget.mjs` | 1 |
| `src/cli/tests/project-generator-framework-scope.checks.mjs` | 1 |
| `src/cli/tests/interactive-maker-compiler-emitters-kit.checks.mjs` | 1 |
| `tests/acceptance/generated-inventory-headroom/**` | 2 |
| `CHANGELOG.md` | 1 |
| `docs/increments/generated-inventory-headroom.md` | 1 |
| `docs/pull-requests/generated-inventory-headroom-kickoff.md` | 1 |
| Outside the affected areas | 0 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/acceptance/generated-inventory-headroom/ac-1.checks.mjs` |
| AC-2 | yes | `tests/acceptance/generated-inventory-headroom/ac-2.checks.mjs` |

### Gates

From `node bin/app check --plan`:

| Gate | Command | Required |
| --- | --- | --- |
| check | `node bin/app check --fast --base origin/main` | yes |
| coverage-production | `npm run test:coverage:production` | yes |
| suite:maker:pty | `node tooling/testing/suites.mjs maker:pty` | no |
| suite:maker | `node tooling/testing/suites.mjs maker` | yes |
| suite:workbench-plugins | `node tooling/testing/suites.mjs workbench-plugins` | no |
| suite:airship | `node tooling/testing/suites.mjs airship` | no |
| suite:compiler | `node tooling/testing/suites.mjs compiler` | yes |
| suite:compiler:properties | `node tooling/testing/suites.mjs compiler:properties` | no |
| suite:prototypes | `node tooling/testing/suites.mjs prototypes` | no |
| suite:prototypes:python | `node tooling/testing/suites.mjs prototypes:python` | no |
| suite:companion:mvp | `node tooling/testing/suites.mjs companion:mvp` | no |
| suite:runtime | `node tooling/testing/suites.mjs runtime` | no |
| suite:cli | `node tooling/testing/suites.mjs cli` | yes |
| suite:cli:journey | `node tooling/testing/suites.mjs cli:journey` | no |
| suite:generator | `node tooling/testing/suites.mjs generator` | yes |
| suite:visual | `node tooling/testing/suites.mjs visual` | no |
| suite:companion | `node tooling/testing/suites.mjs companion` | no |
| suite:companion:schema | `node tooling/testing/suites.mjs companion:schema` | no |
| suite:companion:assembly | `node tooling/testing/suites.mjs companion:assembly` | no |
| suite:companion:browser | `node tooling/testing/suites.mjs companion:browser` | no |
| suite:companion:visual-browser | `node tooling/testing/suites.mjs companion:visual-browser` | no |
| suite:companion:starter-browser | `node tooling/testing/suites.mjs companion:starter-browser` | no |
| suite:test-data | `node tooling/testing/suites.mjs test-data` | no |
| suite:makers | `node tooling/testing/suites.mjs makers` | no |
| suite:native | `node tooling/testing/suites.mjs native` | no |
| suite:setup | `node tooling/testing/suites.mjs setup` | no |
| suite:acceptance | `node tooling/testing/suites.mjs acceptance` | yes |
| suite:quality | `node tooling/testing/suites.mjs quality` | no |
| suite:baseline | `node tooling/testing/suites.mjs baseline` | no |
| suite:e2e | `node tooling/testing/suites.mjs e2e` | no |
| suite:project | `node tooling/testing/suites.mjs project` | no |
| suite:project:ui-effects | `node tooling/testing/suites.mjs project:ui-effects` | no |
| suite:obsidian | `node tooling/testing/suites.mjs obsidian` | no |
| verify | `npm run verify` | yes |
