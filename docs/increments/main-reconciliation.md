---
type: Increment
id: main-reconciliation
title: "Reconcile main quality gates and Vue lifecycle behavior"
owner: "Luis"
size: L
status: Done
e2e: optional
refs: []
pullRequests: [main-reconciliation-kickoff, main-reconciliation-1]
branch: "increment/main-reconciliation"
base: main
---

# Reconcile main quality gates and Vue lifecycle behavior

<!-- Developer handoff for one pull request. `npm run dor` checks it before implementation,
`npm run dod` after it. Replace every <placeholder>; delete these comments when done. -->

## Summary

Reconcile the merged Workbench implementation, its dependency updates and its quality gates. Move CLI development sources into src/cli and make bin a generated, independently runnable distribution.

## Outcome

Maintainers develop all Workbench CLI modules under src/cli. A built bin directory runs from an unrelated directory with its own launcher, runtime, templates, configuration and notices. Dependency and quality failures are reported with concrete evidence.

## Scope

### In scope

- CLI source relocation and standalone distribution assembly.
- Source imports, generators, configuration, tests, documentation and workflows affected by that layout.
- Review open Dependabot updates and merge compatible green candidates.
- Repair demonstrated lifecycle and quality-gate regressions without lowering thresholds.

### Out of scope

- Product features from unfinished companion requirements.
- Release publication, host downloads or changes to personal vaults.
- Unsupported TypeScript major upgrades or lint peer overrides.

## Acceptance criteria

<!-- One `- [ ] AC-n: text` per criterion. At completion tick it and add
`Evidence: \`path\`` (a test file, doc or report that exists). -->

- [x] AC-1: Workbench CLI sources live under src/cli and a built bin copy runs without the source checkout or installed framework dependencies.
  Evidence: `tests/acceptance/main-reconciliation/ac-1.checks.mjs`, `docs/development/MAIN-RECONCILIATION.md`
- [x] AC-2: Targeted lifecycle and dependency workflow regressions have behavioral coverage and existing architecture, lint and coverage gates retain their thresholds.
  Evidence: `tests/acceptance/main-reconciliation/ac-2.checks.mjs`, `docs/development/MAIN-RECONCILIATION.md`

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

- `src/**`: CLI development sources and Vue lifecycle corrections.
- `bin/**`: generated standalone CLI output.
- `scripts/**`: build, documentation and quality tooling.
- `configs/**`: source roots and validation boundaries.
- `tests/**`: behavioral regressions and moved-source imports.
- `templates/**`: generated-project references.
- `plugins/**`: Workbench plugin imports.
- `.github/**`: dependency grouping and workflow contracts.
- `docs/**`: live layout documentation and evidence.
- `harness/**`: source references if required.

## Test plan

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- Suite `maker`: CLI modules and build contracts.
- Suite `cli`: portable distribution, generation and documentation behavior.
- Suite `runtime`: real Vue composables, services, form semantics and uncertain-write recovery.
- Suite `quality`: workflow and source-boundary regressions.
- Gate `npm run check`: agent gate on the resulting source.
- Gate `npm run app:dev -- check --plan --base origin/main`: full verification scope.
- Gate `npm run typecheck`: strict runtime and CLI checks both pass.
- Gate `npm run test:e2e`: served form sizing, keyboard recovery, accessibility and existing user journeys.
- New test `tests/tooling/framework-checkout-build.checks.mjs`: fresh tracked checkout builds the CLI; injected runtime and CLI type errors each fail the public check. Also runs in draft Dev CI.
- E2E: optional in hosted draft CI; the follow-up changes existing rendered forms and runs the served harness locally with the available Chromium override. Native and pinned-browser qualification remain separate.

## Docs impact

<!-- - `docs/path.md` (how-to): what changes   — or —   None — reason -->

- `docs/development/FRAMEWORK-CLI.md` (reference): source and built CLI usage.
- `docs/development/MAIN-RECONCILIATION.md` (explanation): findings, dependency decisions and measured verification limits.

## Changelog

<!-- - Added: text  (Added, Changed, Deprecated, Removed, Fixed or Security)  — or —  None — reason -->

- Changed: Develop the Workbench CLI under src/cli and build a portable standalone bin distribution.
- Fixed: Reconcile dependency checks and disposed Vue settings actions after the main merge.

## Risks and rollback

The largest risk is a relative path or generated-project reference retaining the source layout. Test the copied bin in isolation and use the existing kit and compiler fixtures. Revert the source-layout commit together with its configuration and generated documentation to roll back.

## Dependencies

The exact Node 24.21.0 and npm 11.19.1 toolchain and locked packages are required. Dependabot merges require compatible peers and successful applicable checks; unresolved updates remain open.

## Open questions

<!-- "None" when ready. Each open question blocks the Definition of Ready. -->

None. The owner explicitly requested src for development and bin for the standalone product; existing product requirements and release restrictions remain.

## Pull requests

<!-- wb:pull-requests generated by node bin/app; edits here are replaced -->
- [[docs/pull-requests/main-reconciliation-kickoff|Kick-off: Reconcile main quality gates and Vue lifecycle behavior]] · Ready · [#95](https://github.com/Luis85/obsidian-plugin-shell/pull/95)
- [[docs/pull-requests/main-reconciliation-1|Reconcile standalone CLI and harden runtime workflows]] · Merged · [#96](https://github.com/Luis85/obsidian-plugin-shell/pull/96)
<!-- /wb:pull-requests -->

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/main` (merge base `36ffeab14da1`)
- Changed files: 1006 (16 added, 463 modified, 525 renamed, 2 deleted)
- E2E decision: optional; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `src/**` | 536 |
| `bin/**` | 0 |
| `scripts/**` | 47 |
| `configs/**` | 23 |
| `tests/**` | 318 |
| `templates/**` | 2 |
| `plugins/**` | 6 |
| `.github/**` | 16 |
| `docs/**` | 41 |
| `harness/**` | 0 |
| Outside the affected areas | 14 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/acceptance/main-reconciliation/ac-1.checks.mjs`, `docs/development/MAIN-RECONCILIATION.md` |
| AC-2 | yes | `tests/acceptance/main-reconciliation/ac-2.checks.mjs`, `docs/development/MAIN-RECONCILIATION.md` |

### Gates

From `node bin/app check --plan`:

| Gate | Command | Required |
| --- | --- | --- |
| check | `node bin/app check --fast --base origin/main` | yes |
| coverage-production | `npm run test:coverage:production` | yes |
| check-presentation | `npm run check:presentation` | yes |
| suite:maker:pty | `node scripts/testing/suites.mjs maker:pty` | no |
| suite:maker | `node scripts/testing/suites.mjs maker` | yes |
| suite:workbench-plugins | `node scripts/testing/suites.mjs workbench-plugins` | yes |
| suite:airship | `node scripts/testing/suites.mjs airship` | yes |
| suite:compiler | `node scripts/testing/suites.mjs compiler` | yes |
| suite:compiler:properties | `node scripts/testing/suites.mjs compiler:properties` | yes |
| suite:prototypes | `node scripts/testing/suites.mjs prototypes` | yes |
| suite:prototypes:python | `node scripts/testing/suites.mjs prototypes:python` | no |
| suite:companion:mvp | `node scripts/testing/suites.mjs companion:mvp` | no |
| suite:runtime | `node scripts/testing/suites.mjs runtime` | yes |
| suite:cli | `node scripts/testing/suites.mjs cli` | yes |
| suite:cli:journey | `node scripts/testing/suites.mjs cli:journey` | no |
| suite:generator | `node scripts/testing/suites.mjs generator` | yes |
| suite:visual | `node scripts/testing/suites.mjs visual` | no |
| suite:companion | `node scripts/testing/suites.mjs companion` | yes |
| suite:companion:schema | `node scripts/testing/suites.mjs companion:schema` | no |
| suite:companion:assembly | `node scripts/testing/suites.mjs companion:assembly` | yes |
| suite:companion:browser | `node scripts/testing/suites.mjs companion:browser` | yes |
| suite:companion:visual-browser | `node scripts/testing/suites.mjs companion:visual-browser` | no |
| suite:companion:starter-browser | `node scripts/testing/suites.mjs companion:starter-browser` | no |
| suite:test-data | `node scripts/testing/suites.mjs test-data` | no |
| suite:makers | `node scripts/testing/suites.mjs makers` | yes |
| suite:memory | `node scripts/testing/suites.mjs memory` | no |
| suite:memory:python | `node scripts/testing/suites.mjs memory:python` | no |
| suite:native | `node scripts/testing/suites.mjs native` | yes |
| suite:setup | `node scripts/testing/suites.mjs setup` | yes |
| suite:release | `node scripts/testing/suites.mjs release` | yes |
| suite:acceptance | `node scripts/testing/suites.mjs acceptance` | yes |
| suite:quality | `node scripts/testing/suites.mjs quality` | yes |
| suite:baseline | `node scripts/testing/suites.mjs baseline` | no |
| suite:workflows:browser | `node scripts/testing/suites.mjs workflows:browser` | yes |
| suite:e2e | `node scripts/testing/suites.mjs e2e` | yes |
| suite:project | `node scripts/testing/suites.mjs project` | no |
| suite:project:ui-effects | `node scripts/testing/suites.mjs project:ui-effects` | no |
| suite:obsidian | `node scripts/testing/suites.mjs obsidian` | no |
| verify | `npm run verify` | yes |
