---
type: Increment
id: source-project-split
title: "Self-contained source projects and named-source generation"
owner: "Luis85"
size: L
status: Done
e2e: optional
refs: []
pullRequests: [source-project-split-kickoff]
branch: "increment/source-project-split"
base: main
---

# Self-contained source projects and named-source generation

<!-- Developer handoff for one pull request. `npm run dor` checks it before implementation,
`npm run dod` after it. Replace every <placeholder>; delete these comments when done. -->

## Summary

Split the Workbench runtime and authoring tools into five self-contained TypeScript projects, preserving dependency boundaries and executable quality gates. Finish the source management command and generated project migration so maintainers can add and target source projects safely.

## Outcome

Maintainers can inspect and change the source dependency graph with reviewed plans. Makers and compilers emit runnable named-source projects, while existing flat-source consumers retain their supported generation path.

## Scope

### In scope

- Source layout, project references, named-source makers, compiler output, repository tooling and documentation migration.
- Safe source mutations, source project validation, relocated test inventories, and integration with the current main branch.

### Out of scope

- Release publication, tags, package publication and host floor changes.
- New product UI behavior beyond preserving the integrated runtime and generated project contracts.

## Acceptance criteria

<!-- One `- [ ] AC-n: text` per criterion. At completion tick it and add
`Evidence: \`path\`` (a test file, doc or report that exists). -->

- [x] AC-1: Source management plans preserve dependency boundaries and reject invalid, stale or unsafe mutations.
  Evidence: `tests/acceptance/source-project-split/ac-1.checks.mjs`
- [x] AC-2: Makers target the selected source project and reject ambiguous targets without writing files.
  Evidence: `tests/acceptance/source-project-split/ac-2.checks.mjs`
- [x] AC-3: Compilers and starter generation emit a coherent named-source plugin project with working local imports.
  Evidence: `tests/acceptance/source-project-split/ac-3.checks.mjs`

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

- `src/**`: separated projects, source management, makers, compiler output and project-owned tests.
- `tooling/**`: relocated repository machinery and test discovery.
- `tests/**`: cross-project acceptance and suite classifications.
- `configs/**`: project references and equivalent quality gate scopes.
- `templates/**`: generated project source layout.
- `.github/**`: migrated workflow paths.
- `.claude/**`: relocated authoring tool references.
- `.agents/**`: skill adapter references.
- `docs/**`: source layout and generation guidance.
- `package.json`: source project imports and gate commands.
- `tsconfig.json`: solution project references.
- `workbench.sources.json`: source project dependency manifest.

## Test plan

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- Suite `cli`: source command plans, rejection paths and source-aware makers.
- Suite `compiler`: compiler emitter path and generated output contracts.
- Suite `generator`: starter generation and developer kit qualification.
- Suite `quality`: project boundaries, source inventory and test discovery guards.
- Suite `acceptance`: executable source-management, maker-target and compiler layout acceptance.
- Gate `npm run check`: TypeScript, lint, runtime and selected tooling suites.
- Gate `npm run verify -- --json`: full repository qualification.
- E2E: optional because this change preserves runtime UI behavior; served Chromium smoke is planned where provisioning permits.

## Docs impact

<!-- - `docs/path.md` (how-to): what changes   — or —   None — reason -->

- `docs/architecture/COMPANION-ON-SHELL.md` (explanation): describe the source project graph and repository boundaries.

## Changelog

<!-- - Added: text  (Added, Changed, Deprecated, Removed, Fixed or Security)  — or —  None — reason -->

- Added: Source project management and explicit maker source selection for self-contained TypeScript projects.

## Risks and rollback

Incorrect path translation can break generated consumers or omit tests from gates. Exercise both named-source and legacy layouts, retain numeric thresholds, and revert this pull request as one merge if qualification regresses.

## Dependencies

PR 96 is merged; integrate the current main branch so the agent scaffold and iteration lifecycle remain available after the source migration.

## Open questions

<!-- "None" when ready. Each open question blocks the Definition of Ready. -->

None. Quality configuration equivalence is reviewed separately before final integration qualification; this increment does not authorize relaxing thresholds or exclusions.

## Pull requests

<!-- wb:pull-requests generated by node bin/app; edits here are replaced -->
- [[docs/pull-requests/source-project-split-kickoff|Kick-off: Self-contained source projects and named-source generation]] · New
<!-- /wb:pull-requests -->

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/main` (merge base `ce26008be423`)
- Changed files: 2027 (80 added, 570 modified, 1372 renamed, 5 deleted)
- E2E decision: optional; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `src/**` | 1358 |
| `tooling/**` | 409 |
| `tests/**` | 27 |
| `configs/**` | 52 |
| `templates/**` | 21 |
| `.github/**` | 28 |
| `.claude/**` | 26 |
| `.agents/**` | 0 |
| `docs/**` | 91 |
| `package.json` | 1 |
| `tsconfig.json` | 1 |
| `workbench.sources.json` | 1 |
| Outside the affected areas | 6 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/acceptance/source-project-split/ac-1.checks.mjs` |
| AC-2 | yes | `tests/acceptance/source-project-split/ac-2.checks.mjs` |
| AC-3 | yes | `tests/acceptance/source-project-split/ac-3.checks.mjs` |

### Gates

`node bin/app check --plan` was not available here (no installed dependencies); run it locally and paste the result into the pull request.
