---
type: Increment
id: release-preflight
title: "Release preflight before the cut"
owner: "Luis85"
size: S
status: Done
e2e: none
refs: []
pullRequests: [release-preflight-kickoff]
branch: "increment/release-preflight"
base: main
---

# Release preflight before the cut

<!-- Developer handoff for one pull request. `npm run dor` checks it before implementation,
`npm run dod` after it. Replace every <placeholder>; delete these comments when done. -->

## Summary

Two of the three 0.6.1 Release attempts failed on problems visible in minutes: an acceptance test pinned to `## [Unreleased]`, which the cut promotes into the new version, and a newly published advisory caught by the live security gate near the end of Candidate qualification. Add a read-only `tooling/release/preflight.mjs` (`npm run release:preflight`) that runs the cut plan, every acceptance test that reads `CHANGELOG.md` against the promoted changelog in a throwaway git worktree, and the live security audit, before Release cut is dispatched.

## Outcome

A maintainer runs `npm run release:preflight -- --version X.Y.Z` on main and learns in minutes whether the cut would be blocked, whether a changelog-bound test would fail after promotion, and whether the security gate would fail, without writing anything in the checkout.

## Scope

### In scope

- `tooling/release/preflight.mjs` with the `cut-plan`, `changelog-tests` and `security` checks, `--skip-security` and `--json`, and the `release:preflight` script.
- The shared release runner accepts a per-call environment, so the nested test run starts clean.
- Tests, the release guide and the release skill's preflight step.

### Out of scope

- Running the preflight automatically in a workflow or blocking Release cut on it.
- Changes to the cut, Release or Publish workflows, or to the security gate and its exceptions.
- Running the complete verify or any suite other than the changelog-bound acceptance tests.

## Acceptance criteria

<!-- One `- [ ] AC-n: text` per criterion. At completion tick it and add
`Evidence: \`path\`` (a test file, doc or report that exists). -->

- [x] AC-1: On a releasable main with a changelog-bound acceptance test that accepts the promoted section, `node tooling/release/preflight.mjs --version X.Y.Z --skip-security` reports `ready`, exits 0 and leaves the checkout, its branches and its worktrees unchanged.
  Evidence: `tests/acceptance/release-preflight/ac-1.checks.mjs`
- [x] AC-2: When an acceptance test only accepts the entry under `## [Unreleased]`, the preflight reports `changelog-tests` failed naming that test, prints `Release preflight blocked` and exits 1.
  Evidence: `tests/acceptance/release-preflight/ac-2.checks.mjs`

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

- `tooling/**`: the preflight, the release runner and their tests.
- `package.json`: the `release:preflight` script.
- `docs/development/CUT-AND-PUBLISH-A-RELEASE.md`: the preflight before the cut preview.
- `.claude/skills/release/SKILL.md`: the preflight step.
- `CHANGELOG.md`: the user-facing entry.
- `docs/*/release-preflight*.md`: this handoff and its kick-off record.
- `tests/acceptance/release-preflight/`: the acceptance tests.

## Test plan

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- Suite `release`: `tooling/tests/release-preflight.checks.mjs` (ready, a test pinned to Unreleased, a security finding, a cut blocker, `--skip-security`, arguments) and the existing cut tests.
- Suite `acceptance`: the AC-1 and AC-2 tests run the real preflight command on a temporary git repository.
- Gate `node bin/app check --fast --skip-suites --base origin/main`: types, lint and diff-scoped tests.
- Gate `node tooling/testing/suites.mjs --check`: every new test file has a suite and level.
- E2E: none; no user interface changes.

## Docs impact

<!-- - `docs/path.md` (how-to): what changes   — or —   None — reason -->

- `docs/development/CUT-AND-PUBLISH-A-RELEASE.md` (how-to): run the preflight before the cut preview.

## Changelog

<!-- - Added: text  (Added, Changed, Deprecated, Removed, Fixed or Security)  — or —  None — reason -->

- Added: `npm run release:preflight -- --version X.Y.Z` checks in minutes, without writing anything, whether a release cut would be blocked, whether acceptance tests that read the changelog still pass once it is promoted, and whether the live security audit passes.

## Risks and rollback

Risk: the security check needs the npm registry and reports a failure when it is unreachable; `--skip-security` reports it as skipped instead. The throwaway worktree is always removed, also after a failure. Rollback: revert the commit.

## Dependencies

None.

## Open questions

<!-- "None" when ready. Each open question blocks the Definition of Ready. -->

None. The owner approved a release preflight before the cut.

## Pull requests

<!-- wb:pull-requests generated by node bin/app; edits here are replaced -->
- [[docs/pull-requests/release-preflight-kickoff|Kick-off: Release preflight before the cut]] · New
<!-- /wb:pull-requests -->

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/main` (merge base `b6d497024531`)
- Changed files: 10 (6 added, 4 modified, 0 renamed, 0 deleted)
- E2E decision: none; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `tooling/**` | 3 |
| `package.json` | 1 |
| `docs/development/CUT-AND-PUBLISH-A-RELEASE.md` | 1 |
| `.claude/skills/release/SKILL.md` | 1 |
| `CHANGELOG.md` | 0 |
| `docs/*/release-preflight*.md` | 2 |
| `tests/acceptance/release-preflight/` | 2 |
| Outside the affected areas | 0 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/acceptance/release-preflight/ac-1.checks.mjs` |
| AC-2 | yes | `tests/acceptance/release-preflight/ac-2.checks.mjs` |

### Gates

`node bin/app check --plan` was not available here (no installed dependencies); run it locally and paste the result into the pull request.
