---
type: Increment
id: publish-stale-hold
title: "Re-run the stale release-PR CI hold in Publish"
owner: "Claude"
size: M
status: Done
e2e: none
refs: []
pullRequests: [publish-stale-hold-kickoff, publish-stale-hold-1]
issues: [publish-stale-hold]
branch: "increment/publish-stale-hold"
base: main
---

# Re-run the stale release-PR CI hold in Publish

<!-- Developer handoff for one pull request. `npm run dor` checks it before implementation,
`npm run dod` after it. Replace every <placeholder>; delete these comments when done. -->

## Summary

A person's push to `release/X.Y.Z` starts the release pull request's own CI (`ci.yml`, `pull_request`), whose "CI result" deliberately fails until the Release workflow has reported a green "Release result" on that head. When Release later passes, nothing re-runs that failed check: Publish marks the pull request ready with `GITHUB_TOKEN`, which starts no workflows. GitHub keeps counting the stale failure, so Publish's merge was refused (HTTP 405, exit 2) during the 0.5.0 release until the owner re-ran the job by hand. Publish now re-runs such a stale hold itself before merging, once "Release result" is green, and waits for it to pass.

## Outcome

After a fix-forward push to a release branch and a green Release tier, an owner-dispatched Publish merges, tags and releases without a manual CI re-run; when the re-run does not pass, Publish stops before merging with a named code.

## Scope

### In scope

- Discovery of stale holds: a check suite on the release head whose latest "CI result" failed and whose workflow run is a `pull_request` run of `ci.yml`.
- A `requalify` Publish step between `ready` and `merge`: request a re-run of that run's failed jobs (or wait for one already running), wait within a bounded budget and require success.
- `publish.yml` grants the publish job `actions: write` (still dispatch-only and behind the `release` environment); the comment in `ci.yml` that claimed marking ready re-runs the hold is corrected.
- Fake-remote support, unit and acceptance tests, the publish guide, the workflow reference and the Unreleased entry.

### Out of scope

- Changing what the hold checks, the Release workflow or its aliases, and `RELEASE_TOKEN` handling.
- Re-running any other failed check.

## Acceptance criteria

<!-- One `- [ ] AC-n: text` per criterion. At completion tick it and add
`Evidence: \`path\`` (a test file, doc or report that exists). -->

- [x] AC-1: Given a release head with a green "Release result" and a failed "CI result" from a `pull_request` run of `ci.yml`, Publish plans a pending `requalify` step before `merge`, executes it by re-running that run's failed jobs, waits until the run completes successfully and then merges, tags and publishes; with no such failure the step is already done and Publish makes no re-run or run-status call. Evidence: `tests/acceptance/publish-stale-hold/ac-1.checks.mjs`
- [x] AC-2: If the re-run completes with any conclusion other than success, Publish stops before merging with exit 1 and `HOLD_RERUN_FAILED`; if it is still running when the wait budget ends, Publish exits 2 (uncertain), and a later Publish waits for the run already in progress instead of requesting another re-run. Evidence: `tests/acceptance/publish-stale-hold/ac-2.checks.mjs`
- [x] AC-3: `publish.yml` grants its publish job `actions: write` while staying dispatch-only behind the `release` environment, `npm run check:repository` passes, and the publish guide and workflow reference describe the `requalify` step and the permission. Evidence: `tests/acceptance/publish-stale-hold/ac-3.checks.mjs`

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

- `tooling/release/publish.mjs`: the `requalify` step and the bounded wait.
- `tooling/release/publish-discovery.mjs`: stale-hold discovery.
- `tooling/release/publish-hold.mjs`: stale-hold lookup, the bounded wait and its `PUBLISH_HOLD_WAIT_SECONDS` budget.
- `.github/workflows/publish.yml`: `actions: write`.
- `.github/workflows/ci.yml`: the corrected hold comment.
- `src/cli/tests/support/release-publish-fixture.mjs`: fake workflow runs and re-runs.
- `src/cli/tests/support/publish-cli-fixture.mjs`: a zero wait budget for the publish CLI tests.
- `tooling/tests/release-publish.checks.mjs`: plan and step tests.
- `tooling/tests/release-publish-refusals.checks.mjs`: the refusal and uncertain cases.
- `tests/acceptance/publish-stale-hold/`: the acceptance tests.
- `docs/development/CUT-AND-PUBLISH-A-RELEASE.md`: the step and its recovery.
- `docs/development/WORKFLOWS.md`: the publish job permissions.
- `CHANGELOG.md`: the Unreleased entry.
- `docs/increments/publish-stale-hold.md`: this handoff.
- `docs/pull-requests/`: the kick-off and change pull request records.
- `docs/issues/`: the increment issue.

## Test plan

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- Suite `release`: plan, re-run, wait, refusal and resume cases against the fake GitHub remote.
- Suite `acceptance`: one acceptance test per criterion; AC-1 and AC-2 run the real publish CLI against the fake remote.
- Suite `quality`: `repository.checks.mjs` over the changed workflows.
- Gate `npm run check:repository`: the workflow policy with `actions: write`.
- Gate `npm run verify -- --json --keep-going`: the full gate before ready for review.
- Gate `node tooling/testing/suites.mjs --check`: the new test files have a suite and level.
- Gate `node src/cli/tooling/release/changelog.mjs check`: the Unreleased entry.
- E2E: none; the GitHub remote is faked and the real path runs at the next release with a fix-forward push.

## Docs impact

<!-- - `docs/path.md` (how-to): what changes   — or —   None — reason -->

- `docs/development/CUT-AND-PUBLISH-A-RELEASE.md` (how-to): Publish re-runs a stale release-pull-request hold before merging, and what `HOLD_RERUN_FAILED` and a timeout mean.
- `docs/development/WORKFLOWS.md` (reference): the publish job's `actions: write`.

## Changelog

<!-- - Added: text  (Added, Changed, Deprecated, Removed, Fixed or Security)  — or —  None — reason -->

- Fixed: Publish re-runs the release pull request's stale "CI result" hold once "Release result" is green and waits for it before merging, so a fix-forward push to a release branch no longer blocks the merge.

## Risks and rollback

Risk: a re-run requested with `GITHUB_TOKEN` might not start; the bounded wait then ends uncertain (exit 2) without merging, and the owner can re-run the job by hand as before. Risk: `actions: write` widens the publish job's token; the job stays dispatch-only behind the reviewed `release` environment, and only the named run's failed jobs are re-run. Rollback: revert the change pull request.

## Dependencies

None.

## Open questions

<!-- "None" when ready. Each open question blocks the Definition of Ready. -->

None. The owner chose that Publish re-runs the stale hold itself, with `actions: write` on the publish job.

## Issues

<!-- wb:issues generated by node bin/app; edits here are replaced -->
- [[docs/issues/publish-stale-hold|Re-run the stale release-PR CI hold in Publish]] · Done
<!-- /wb:issues -->

## Pull requests

<!-- wb:pull-requests generated by node bin/app; edits here are replaced -->
- [[docs/pull-requests/publish-stale-hold-kickoff|Kick-off: Re-run the stale release-PR CI hold in Publish]] · New
- [[docs/pull-requests/publish-stale-hold-1|Re-run the stale release-PR CI hold in Publish]] · Merged · [#228](https://github.com/Luis85/obsidian-plugin-shell/pull/228)
<!-- /wb:pull-requests -->

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/main` (merge base `90a15a92bf5d`)
- Changed files: 19 (8 added, 11 modified, 0 renamed, 0 deleted)
- E2E decision: none; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `tooling/release/publish.mjs` | 1 |
| `tooling/release/publish-discovery.mjs` | 1 |
| `tooling/release/publish-hold.mjs` | 1 |
| `.github/workflows/publish.yml` | 1 |
| `.github/workflows/ci.yml` | 1 |
| `src/cli/tests/support/release-publish-fixture.mjs` | 1 |
| `src/cli/tests/support/publish-cli-fixture.mjs` | 1 |
| `tooling/tests/release-publish.checks.mjs` | 1 |
| `tooling/tests/release-publish-refusals.checks.mjs` | 1 |
| `tests/acceptance/publish-stale-hold/` | 3 |
| `docs/development/CUT-AND-PUBLISH-A-RELEASE.md` | 1 |
| `docs/development/WORKFLOWS.md` | 1 |
| `CHANGELOG.md` | 1 |
| `docs/increments/publish-stale-hold.md` | 1 |
| `docs/pull-requests/` | 2 |
| `docs/issues/` | 1 |
| Outside the affected areas | 0 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/acceptance/publish-stale-hold/ac-1.checks.mjs` |
| AC-2 | yes | `tests/acceptance/publish-stale-hold/ac-2.checks.mjs` |
| AC-3 | yes | `tests/acceptance/publish-stale-hold/ac-3.checks.mjs` |

### Gates

`node bin/app check --plan` was not available here (no installed dependencies); run it locally and paste the result into the pull request.
