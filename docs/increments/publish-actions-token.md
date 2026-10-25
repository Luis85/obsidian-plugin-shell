---
type: Increment
id: publish-actions-token
title: "Let Publish run with the built-in Actions token"
owner: "Claude"
size: M
status: In progress
e2e: none
refs: []
pullRequests: [publish-actions-token-kickoff, publish-actions-token-1]
issues: [publish-actions-token]
branch: "increment/publish-actions-token"
base: main
---

# Let Publish run with the built-in Actions token

<!-- Developer handoff for one pull request. `npm run dor` checks it before implementation,
`npm run dod` after it. Replace every <placeholder>; delete these comments when done. -->

## Summary

Publish's pre-write check reads `permissions.push` from `GET /repos/{owner}/{repo}` and refuses with `PUSH_PERMISSION_REQUIRED` when it is false. For the built-in Actions token (an installation token) GitHub reports `push: false` even when the job grants `contents: write`, so the documented `GITHUB_TOKEN` fallback can never publish: the first Publish of 0.5.0 (run 40167224544) refused before any write. Publish now probes `GET /user` only when the repository reports `push: false`: an installation token cannot read it (HTTP 403), so the permission is treated as unknown and the job's granted permissions decide; a user token that reports no push still refuses before any write.

## Outcome

With no `RELEASE_TOKEN` secret, an owner-dispatched Publish of a green release passes the pre-write check with `GITHUB_TOKEN` and runs its merge, tag, release and branch-deletion steps, while a personal token without push access is still refused before any remote write.

## Scope

### In scope

- `tooling/release/publish-github.mjs`: a fixed `GET /user` probe that reports a user or an integration token and fails closed otherwise.
- `tooling/release/publish-discovery.mjs`: `canPush` is unknown for an integration token whose repository permissions say no push.
- The publish fake remote, the refusal and client tests, acceptance tests, the publish guide and the Unreleased entry.

### Out of scope

- Cutting or publishing 0.5.0 itself, which re-dispatches Publish after this merges.
- `RELEASE_TOKEN` handling, the release cut, other pre-write checks and the workflow permissions.

## Acceptance criteria

<!-- One `- [ ] AC-n: text` per criterion. At completion tick it and add
`Evidence: \`path\`` (a test file, doc or report that exists). -->

- [x] AC-1: Given an installation token (`GET /user` answers HTTP 403) and repository permissions with `push: false`, Publish executes and publishes instead of refusing with `PUSH_PERMISSION_REQUIRED`; given a user token with `push: false`, Publish still refuses with `PUSH_PERMISSION_REQUIRED` before any remote write, and a dry run still plans. Evidence: `tests/acceptance/publish-actions-token/ac-1.checks.mjs`
- [x] AC-2: The token probe issues only `GET /user`, reports `user` on success and `integration` on HTTP 403, and any other failure fails closed with a coded error that carries no raw gh output; Publish calls it only when the repository reports `push: false`. Evidence: `tests/acceptance/publish-actions-token/ac-2.checks.mjs`

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

- `tooling/release/publish-github.mjs`: the token probe.
- `tooling/release/publish-discovery.mjs`: the push-permission decision.
- `src/cli/tests/support/release-publish-fixture.mjs`: the fake `GET /user` route.
- `tooling/tests/release-publish-refusals.checks.mjs`: refusal and installation-token cases.
- `tooling/tests/release-publish.checks.mjs`: the probe's client behaviour.
- `tests/acceptance/publish-actions-token/`: the acceptance tests.
- `docs/development/CUT-AND-PUBLISH-A-RELEASE.md`: when `PUSH_PERMISSION_REQUIRED` applies.
- `CHANGELOG.md`: the Unreleased entry.
- `docs/increments/publish-actions-token.md`: this handoff.
- `docs/pull-requests/`: the kick-off and change pull request records.
- `docs/issues/`: the increment issue.

## Test plan

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- Suite `release`: `release-publish` and `release-publish-refusals` against the fake GitHub remote, including the installation-token and user-token cases.
- Suite `acceptance`: one acceptance test per criterion through the real publish code and the fake remote.
- Gate `npm run check`: types, lint and tests.
- Gate `npm run check:repository`: unchanged workflows still pass the workflow policy.
- Gate `node tooling/testing/suites.mjs --check`: the new test files have a suite and level.
- Gate `node src/cli/tooling/release/changelog.mjs check`: the Unreleased entry.
- E2E: none; the GitHub remote is faked, and the real path is exercised by re-dispatching Publish for 0.5.0 after this merges.

## Docs impact

<!-- - `docs/path.md` (how-to): what changes   — or —   None — reason -->

- `docs/development/CUT-AND-PUBLISH-A-RELEASE.md` (how-to): `PUSH_PERMISSION_REQUIRED` applies to a user token without push access; `GITHUB_TOKEN` relies on the job's granted permissions.

## Changelog

<!-- - Added: text  (Added, Changed, Deprecated, Removed, Fixed or Security)  — or —  None — reason -->

- Fixed: Publish no longer refuses the built-in `GITHUB_TOKEN` with `PUSH_PERMISSION_REQUIRED`: GitHub reports `push: false` for Actions installation tokens, so the pre-write check now applies only to user tokens and the job's granted permissions decide for `GITHUB_TOKEN`.

## Risks and rollback

Risk: an installation token without write access now passes the pre-write check; its first write (marking the pull request ready or merging) then fails with exit 1 or 2 and Publish resumes idempotently, and the workflow grants `contents: write` and `pull-requests: write`. Risk: one more API call; it runs only when the repository reports no push. Rollback: revert the change pull request; `RELEASE_TOKEN` remains a workaround.

## Dependencies

None.

## Open questions

<!-- "None" when ready. Each open question blocks the Definition of Ready. -->

None. The owner chose to fix the check on `main` before re-dispatching Publish for 0.5.0.

## Issues

<!-- wb:issues generated by node bin/app; edits here are replaced -->
- [[docs/issues/publish-actions-token|Let Publish run with the built-in Actions token]] · New
<!-- /wb:issues -->

## Pull requests

<!-- wb:pull-requests generated by node bin/app; edits here are replaced -->
- [[docs/pull-requests/publish-actions-token-kickoff|Kick-off: Let Publish run with the built-in Actions token]] · New
- [[docs/pull-requests/publish-actions-token-1|Let Publish run with the built-in Actions token]] · New
<!-- /wb:pull-requests -->
