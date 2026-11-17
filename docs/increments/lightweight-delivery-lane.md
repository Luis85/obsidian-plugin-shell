---
type: Increment
id: lightweight-delivery-lane
title: "Lightweight delivery lane for docs, changelog and lockfile changes"
owner: "Luis85"
size: S
status: Done
e2e: none
refs: []
pullRequests: [lightweight-delivery-lane-kickoff]
branch: "increment/lightweight-delivery-lane"
base: main
---

# Lightweight delivery lane for docs, changelog and lockfile changes

<!-- Developer handoff for one pull request. `npm run dor` checks it before implementation,
`npm run dod` after it. Replace every <placeholder>; delete these comments when done. -->

## Summary

Docs fixes, changelog entries and lockfile-only dependency bumps today need a full increment handoff (25 Definition of Ready and 18 Definition of Done rules, a kick-off document and acceptance tests) before they can merge. Add a lightweight lane: a pull request whose changed files all sit under `exemptions.paths` in `configs/delivery/delivery.json` passes both checks as exempt, like Dependabot and release pull requests already do.

## Outcome

A maintainer opening a docs-only, changelog-only or lockfile-only pull request sees "Definition of Ready" and "Definition of Done" pass with a lightweight-lane notice, without writing an increment handoff; every CI gate still runs.

## Scope

### In scope

- An optional `exemptions.paths` list in `configs/delivery/delivery.json`, validated strictly, set to `docs`, root Markdown, the root and `projects/*` lockfiles and `.github/dependabot.yml`.
- `exemption()` exempts a diff whose files all match those paths and none of which is an Increment, PullRequest or Issue document; the shared delivery command line passes the diff to it for both gates.
- Tests for the rule, the configuration and the real command line, and the Definition of Ready and Done guide.

### Out of scope

- CI gates: the lane skips the increment handoff only, never a workflow or check.
- `package.json` changes, which can alter scripts, and any source, test, workflow or configuration file outside the listed paths.
- Changing the existing branch and author exemptions.

## Acceptance criteria

<!-- One `- [ ] AC-n: text` per criterion. At completion tick it and add
`Evidence: \`path\`` (a test file, doc or report that exists). -->

- [x] AC-1: With the shipped configuration, a change set of only lane files (a docs page, `CHANGELOG.md`, a lockfile or `.github/dependabot.yml`) is exempt from the Definition of Ready and Done with a notice naming the lane.
  Evidence: `tests/acceptance/lightweight-delivery-lane/ac-1.checks.mjs`
- [x] AC-2: A change set with any file outside the lane, an Increment, PullRequest or Issue document, or no files at all is not exempt and keeps the full check.
  Evidence: `tests/acceptance/lightweight-delivery-lane/ac-2.checks.mjs`

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

- `src/cli/**`: the exemption rule, its configuration validation and their tests.
- `tooling/**`: the shared delivery command line and its end-to-end test.
- `configs/delivery/delivery.json`: the lane paths.
- `docs/development/DEFINITION-OF-READY-AND-DONE.md`: the Exemptions section.
- `docs/*/lightweight-delivery-lane*.md`: this handoff and its kick-off record.
- `AGENTS.md`: the increments rule points to the lane.
- `CHANGELOG.md`: the user-facing entry.
- `tests/acceptance/lightweight-delivery-lane/`: the acceptance tests.

## Test plan

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- Suite `release`: the exemption, configuration and real command-line tests for the delivery checks.
- Suite `acceptance`: the AC-1 and AC-2 tests run the shipped configuration through the exemption rule.
- Gate `node bin/app check --fast --skip-suites --base origin/main`: types, lint and diff-scoped tests.
- Gate `node tooling/testing/suites.mjs --check`: every new test file has a suite and level.
- E2E: none; no user interface changes.

## Docs impact

<!-- - `docs/path.md` (how-to): what changes   — or —   None — reason -->

- `docs/development/DEFINITION-OF-READY-AND-DONE.md` (reference): the Exemptions section describes the lightweight lane.

## Changelog

<!-- - Added: text  (Added, Changed, Deprecated, Removed, Fixed or Security)  — or —  None — reason -->

- Changed: Pull requests that change only docs, root Markdown, lockfiles or the Dependabot configuration take a lightweight lane and need no increment handoff; every CI gate still runs.

## Risks and rollback

Risk: a pull request that should be planned slips through as docs-only; mitigated by keeping every Increment, PullRequest and Issue document out of the lane and every CI gate running. Rollback: remove `exemptions.paths` from `configs/delivery/delivery.json`.

## Dependencies

None.

## Open questions

<!-- "None" when ready. Each open question blocks the Definition of Ready. -->

None. The owner approved the lightweight lane as part of simplifying the release process.

## Pull requests

<!-- wb:pull-requests generated by node bin/app; edits here are replaced -->
- [[docs/pull-requests/lightweight-delivery-lane-kickoff|Kick-off: Lightweight delivery lane for docs, changelog and lockfile changes]] · New
<!-- /wb:pull-requests -->

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/main` (merge base `b6d497024531`)
- Changed files: 13 (4 added, 9 modified, 0 renamed, 0 deleted)
- E2E decision: none; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `src/cli/**` | 4 |
| `tooling/**` | 2 |
| `configs/delivery/delivery.json` | 1 |
| `docs/development/DEFINITION-OF-READY-AND-DONE.md` | 1 |
| `docs/*/lightweight-delivery-lane*.md` | 2 |
| `AGENTS.md` | 1 |
| `CHANGELOG.md` | 0 |
| `tests/acceptance/lightweight-delivery-lane/` | 2 |
| Outside the affected areas | 0 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/acceptance/lightweight-delivery-lane/ac-1.checks.mjs` |
| AC-2 | yes | `tests/acceptance/lightweight-delivery-lane/ac-2.checks.mjs` |

### Gates

`node bin/app check --plan` was not available here (no installed dependencies); run it locally and paste the result into the pull request.
