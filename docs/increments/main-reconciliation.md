---
type: Increment
id: main-reconciliation
title: "Reconcile main quality gates and Vue lifecycle behavior"
owner: "Luis"
size: L
status: In progress
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

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- Suite `maker`: CLI modules and build contracts.
- Suite `cli`: portable distribution, generation and documentation behavior.
- Suite `runtime`: real Vue composables and services.
- Suite `quality`: workflow and source-boundary regressions.
- Gate `npm run check`: agent gate on the resulting source.
- Gate `npm run app:dev -- check --plan --base origin/main`: full verification scope.
- E2E: optional because this work changes packaging and lifecycle guards, not visual layout; exercise served tests when a browser is provisioned.

- Gate `npm run typecheck`: strict runtime and CLI checks both pass.
- New test `tests/tooling/framework-checkout-build.checks.mjs`: fresh tracked checkout builds the CLI; injected runtime and CLI type errors each fail the public check.

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
- [[docs/pull-requests/main-reconciliation-kickoff|Kick-off: Reconcile main quality gates and Vue lifecycle behavior]] · New
- [[docs/pull-requests/main-reconciliation-1|Reconcile CLI source layout and quality gates]] · New
<!-- /wb:pull-requests -->
