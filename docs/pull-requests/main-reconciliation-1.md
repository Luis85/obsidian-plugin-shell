---
type: PullRequest
id: main-reconciliation-1
title: "Reconcile standalone CLI and harden runtime workflows"
kind: change
increment: main-reconciliation
status: Draft
delivers: [AC-1, AC-2]
head: "pr/main-reconciliation/main-reconciliation-1"
base: increment/main-reconciliation
platform: github
repository: "Luis85/obsidian-plugin-shell"
number: 96
url: "https://github.com/Luis85/obsidian-plugin-shell/pull/96"
publishedAt: 2026-10-06T16:01:19Z
lastSyncedAt: 2026-10-06T16:01:19Z
---

# Reconcile standalone CLI and harden runtime workflows

## Summary

Develop Workbench CLI sources under src/cli and build a verified standalone bin distribution. Reconcile strict checks, dependency workflow evidence and Vue lifecycle behavior; harden note recovery, settings feedback and accessible runtime forms. Draft CI now tests clean-checkout portability and retains diagnostic artifacts.

## Scope

### In scope

- CLI layout, demonstrated lifecycle defects, dependency review and quality gates.

### Out of scope

- Product feature expansion and release publication.

## Tasks

- [x] T-1: Move CLI sources, build and independently execute the standalone distribution, reconcile quality gates and validate dependency decisions.

## Documents

- [[docs/increments/main-reconciliation|Increment: Reconcile main quality gates and Vue lifecycle behavior]]
- [[docs/development/MAIN-RECONCILIATION]]

## Notes

Current follow-up (2026-10-06): the product review fixed oversized runtime-form checkboxes, missing control descriptions, optional-select clearing, uncertain note-write recovery, selection changes during pending writes and misleading settings-save errors after feedback failures. Draft Dev CI now runs the clean-checkout/strict-typecheck regression and retains results as an artifact. No new product feature, dependency change, threshold change or approval waiver was introduced.

All 51 served-browser tests passed with the explicit Chromium 151.0.7922.173 override. All 520 runtime tests passed with unchanged production and selected-core coverage gates; the three fresh-checkout/type-error regressions passed. Twenty light/dark, narrow/desktop screenshots are available in reports/ui-gallery/gallery.html as review evidence, not acceptance baselines. See docs/development/MAIN-RECONCILIATION.md for the complete review and final gate results.

The sections below retain the original pre-publication evidence and limitations; they are historical, not the current status. The owner has approved the separate strict projects, both public typechecks pass, PR #96 is published, and served-browser tests have now run. The former statements that approval was pending and all changes were local are superseded. The initial failed full verify run is still not represented as passing.

This follow-up has zero self-review findings. The complete PR retains seven earlier source-layout configuration flags; the three previously measured moderate Moment/Obsidian reports remain unresolved. The PR stays draft. Pinned-browser, native Obsidian, Windows, macOS and independent Companion qualification remain outside this follow-up; release or publication is not authorized.

## Gates

- `node bin/app check --plan --base origin/main`: passed; plan recorded against main `0d3dc44a`.
- Agent check: `check --fast --skip-suites --base origin/main` ran four checks successfully and failed root Vue typechecking; suite delegation was explicit. The complete agent gate is not green.
- Full `verify --json --keep-going`: initial diagnostic finished with 25 passed, six failed and one skipped. Repairs followed; this is not a passing full verdict.
- Final selected `verify`: 11 passed, zero failures. Selection covered suite inventory, plugin build, source lint, ESLint, maker types, maker coverage and gate, repository checks, analyzer, maintainability and legacy baseline. The runner explicitly reports a partial run.
- Maker suite: all 176 files passed; 1,142 tests passed and one existing test skipped. Coverage: 94.90% lines, 93.35% statements, 93.57% functions, 87.91% branches; independent core gate passed.
- Runtime suite: 515 tests passed; production coverage 99.11% lines, 97.44% statements, 97.68% functions, 95.04% branches; selected-core gate passed.
- Packaging/generator/workflow regressions: 60 passed, including both acceptance criteria. Starter replay: three passed. Golden contracts: 11 passed, all 14 starter baselines unchanged.
- Legacy baseline: 53 tests passed in each of three runs; existing release block retained.
- Self-review: seven configuration/path findings remain for owner review; no approval entries were added.
- Live security gate: failed with three moderate reports in the Moment/Obsidian chain; zero high or critical reports after the narrow source-map-js fix.
- Browser and native: not run; rendered UI did not change and native hosts were not provisioned. No remote PR or e2e label exists for this local branch.

## Evidence

Implementation commit: `02d79da2`; reconciliation with reviewed main: `151e2f64`.
The copied-bin acceptance test used kit source hash `f027674b5c12e810cc63ba50bcf83eba1c8c350ff5d591c7bcff9f317f4f4912`.
Measured output is in `reports/reconciliation/final-verification.json`, `repaired-regressions.log`, `runtime-coverage-gates.json`, `type-scope-proof.json` and `final-self-review.json`.
The committed review, dependency decisions and remaining recommendations are in `docs/development/MAIN-RECONCILIATION.md`.

## Thresholds and open decisions

Numeric thresholds, golden baselines and the owner-only approval file are unchanged. CLI rules and coverage follow source to src/cli; runtime coverage preserves all 108 runtime TS inputs and 12 Vue components. The maker configuration includes all 512 relocated modules plus two new modules.
Automatic approval review rejected excluding CLI sources from the root Vue project and wiring the public typecheck script to run both strict projects, citing possible coverage reduction. That concrete change remains unapplied pending the owner decision. The seven self-review path/configuration flags are documented without a waiver.

## Untested scope

Windows, macOS, real Obsidian and served-browser qualification were not run. This is an engineering and packaging review; no visual redesign or release qualification is claimed. All changes remain local except the authorized merge of Dependabot #91.

## Release and publication

This change does not authorize a release, tag, listing submission or publication.

## Amendments

<!-- Appended after publication with node bin/app pr amend; each is synced to the pull request body. -->

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/increment/main-reconciliation` (merge base `4de23a811948`); head `pr/main-reconciliation/main-reconciliation-1`
- Changed files: 992 (10 added, 455 modified, 525 renamed, 2 deleted)
- `e2e` label not verifiable locally

### Tasks

| Task | Done |
| --- | --- |
| T-1: Move CLI sources, build and independently execute the standalone distribution, reconcile quality gates and validate dependency decisions. | yes |

### Delivered acceptance criteria

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/acceptance/main-reconciliation/ac-1.checks.mjs`, `docs/development/MAIN-RECONCILIATION.md` |
| AC-2 | yes | `tests/acceptance/main-reconciliation/ac-2.checks.mjs`, `docs/development/MAIN-RECONCILIATION.md` |

### Gates

From `node bin/app check --plan`:

| Gate | Command | Required |
| --- | --- | --- |
| check | `node bin/app check --fast --base origin/increment/main-reconciliation` | yes |
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
| suite:companion:assembly | `node scripts/testing/suites.mjs companion:assembly` | no |
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
