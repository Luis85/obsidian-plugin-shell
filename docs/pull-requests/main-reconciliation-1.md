---
type: PullRequest
id: main-reconciliation-1
title: "Reconcile CLI source layout and quality gates"
kind: change
increment: main-reconciliation
status: New
delivers: [AC-1, AC-2]
head: "pr/main-reconciliation/main-reconciliation-1"
base: increment/main-reconciliation
---

# Reconcile CLI source layout and quality gates

## Summary

Moves Workbench CLI development into src/cli and builds a portable bin product with bundled tools, templates and verified assets. Fixes disposed settings actions, manual provenance and project CI aliases. Fresh checkouts now build from source, and the approved public typecheck runs both strict runtime and CLI projects.

## Scope

### In scope

- CLI layout, demonstrated lifecycle defects, dependency review and quality gates.

### Out of scope

- Product feature expansion and release publication.

## Tasks

- [ ] T-1: Move CLI sources, build and independently execute the standalone distribution, reconcile quality gates and validate dependency decisions.

## Documents

- [[docs/increments/main-reconciliation|Increment: Reconcile main quality gates and Vue lifecycle behavior]]
- [[docs/development/MAIN-RECONCILIATION]]

## Notes

CI follow-up: removed the three tracked partial bin artifacts so fresh checkouts build the complete standalone CLI. The owner approved separate strict runtime and CLI projects on 2026-10-06; npm run typecheck now runs both and passes. Three fresh-checkout/type-error tests and 23 existing configuration/distribution tests passed. The Dev fast gate passed all five executed checks, with expensive suites explicitly delegated.

The Gates and Evidence sections below record the original pre-publication runs. The root typecheck failure and pending approval recorded there are resolved by this follow-up. Seven self-review configuration flags and the three moderate dependency reports remain visible; no approval record or threshold was changed. See docs/development/MAIN-RECONCILIATION.md for the current results.

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
