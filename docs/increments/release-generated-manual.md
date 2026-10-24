---
type: Increment
id: release-generated-manual
title: "Regenerate the CLI manual in the release commit"
owner: "Claude"
size: M
status: Done
e2e: none
refs: []
pullRequests: [release-generated-manual-kickoff]
branch: "increment/release-generated-manual"
base: main
---

# Regenerate the CLI manual in the release commit

<!-- Developer handoff for one pull request. `npm run dor` checks it before implementation,
`npm run dod` after it. Replace every <placeholder>; delete these comments when done. -->

## Summary

The release cut (`tooling/release/cut.mjs`, through release preparation in `src/cli/tooling/release/prepare.mjs`) bumped `package.json`, `package-lock.json`, `manifest.json`, `versions.json` and `CHANGELOG.md`, but not the generated CLI manual in `docs/user-manual/shell-cli/generated/`, which records the framework version and a hash of `package.json` `/version`. After the 0.5.0 cut, "Application docs / qualify" failed with `MANUAL_STALE` and `release/0.5.0` needed a follow-up commit. Release preparation now plans the manual regenerated for the new version in the same reviewed plan, and the release-branch gate proves it current.

## Outcome

A release cut for a new version produces a `release: X.Y.Z` commit whose generated CLI manual passes `manual.mjs --check`, with no follow-up commit, and a release branch with a stale manual fails the Release metadata gate.

## Scope

### In scope

- `prepareVersion` accepts generated, version-stamped outputs that join the reviewed plan and the stale-input check, with an exact-path contract.
- `tooling/release/generated-outputs.mjs` loads the release root's own manual generator; the cut and `npm run release:prepare` (a tooling wrapper) pass it.
- `manual.mjs` renders for a version that `package.json` does not hold yet.
- The cut lists and stages only changed files; `branch.mjs verify` fails with `RELEASE_GENERATED_STALE` when the manual is stale.
- Docs listing the files the cut changes, and the changelog entry.

### Out of scope

- Generated projects' `release version` command: they vendor the manual at the framework's version, not their own, so nothing is regenerated there.
- Other generated artifacts: on a tree prepared for 0.5.0 only `manual.mjs --check` failed.

## Acceptance criteria

<!-- One `- [ ] AC-n: text` per criterion. At completion tick it and add
`Evidence: \`path\`` (a test file, doc or report that exists). -->

- [x] AC-1: A release cut for a bumped version commits the CLI manual regenerated for that version, and `manual.mjs --check` passes on the release head.
  Evidence: `tests/acceptance/release-generated-manual/ac-1.checks.mjs`
- [x] AC-2: The release-branch gate fails with `RELEASE_GENERATED_STALE` when the generated manual is not current for the release version.
  Evidence: `tests/acceptance/release-generated-manual/ac-2.checks.mjs`
- [x] AC-3: Release preparation plans generated outputs without writes and refuses a broken output contract or a generated file changed while preparing.
  Evidence: `tests/acceptance/release-generated-manual/ac-3.checks.mjs`

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

- `src/cli/tooling/release/prepare.mjs`: generated outputs in release preparation and the reusable command line.
- `tooling/release/*.mjs`: the cut, the release-branch gate, the generated-output loader and the `release:prepare` wrapper.
- `tooling/documentation/manual.mjs`: the version override and release outputs.
- `docs/user-manual/shell-cli/generated/manifest.json`: regenerated because `manual.mjs` is a hashed input.
- `tooling/tests/release*.mjs`: release cut, preparation and fixture tests.
- `tests/acceptance/release-generated-manual/*.checks.mjs`: the acceptance tests.
- `package.json`: `release:prepare` runs the tooling wrapper.
- `configs/quality/fallow.json`: the src preparation script stays an analyzer entry.
- `.github/workflows/release-cut.yml`: header comment.
- `docs/development/CUT-AND-PUBLISH-A-RELEASE.md`: the files the cut changes.
- `docs/development/MAINTENANCE-AND-RELEASE.md`: release preparation outputs.
- `CHANGELOG.md`: the Fixed entry.
- `docs/increments/release-generated-manual.md`: this handoff.
- `docs/pull-requests/release-generated-manual-kickoff.md`: the kick-off pull request record.

## Test plan

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- Suite `release`: runs the release cut, preparation and branch tests.
- Suite `acceptance`: runs the AC-1 to AC-3 acceptance tests.
- New test `tests/acceptance/release-generated-manual/ac-1.checks.mjs`: a cut in a git fixture carrying the real manual generator passes `manual.mjs --check` on the release head.
- New test `tests/acceptance/release-generated-manual/ac-2.checks.mjs`: a release branch with the old manual fails `RELEASE_GENERATED_STALE`.
- New test `tests/acceptance/release-generated-manual/ac-3.checks.mjs`: the preparation contract and stale-input refusal.
- Gate `node --experimental-strip-types tooling/documentation/manual.mjs --check`: the committed manual stays current.
- Gate `npm run check:analyzer`: zero findings.
- E2E: none — release tooling only; no user interface change.

## Docs impact

<!-- - `docs/path.md` (how-to): what changes   — or —   None — reason -->

- `docs/development/CUT-AND-PUBLISH-A-RELEASE.md` (how-to): the files the cut changes include the generated CLI manual.
- `docs/development/MAINTENANCE-AND-RELEASE.md` (reference): release preparation also updates the generated CLI manual.

## Changelog

<!-- - Added: text  (Added, Changed, Deprecated, Removed, Fixed or Security)  — or —  None — reason -->

- Fixed: Release cut and `release:prepare` regenerate the CLI manual (`docs/user-manual/shell-cli/generated/`), which records the framework version, in the release commit, so `manual.mjs --check` passes on the release head without a follow-up commit. The release-branch gate now fails with `RELEASE_GENERATED_STALE` when a generated, version-stamped output is not current for the release version.

## Risks and rollback

A new generated, version-stamped output would still need a generator entry in `tooling/release/generated-outputs.mjs`. Roll back by reverting this pull request; `release/0.5.0` already carries its regenerated manual.

## Dependencies

None

## Open questions

<!-- "None" when ready. Each open question blocks the Definition of Ready. -->

None

## Pull requests

<!-- wb:pull-requests generated by node bin/app; edits here are replaced -->
- [[docs/pull-requests/release-generated-manual-kickoff|Kick-off: Regenerate the CLI manual in the release commit]] · New
<!-- /wb:pull-requests -->

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/main` (merge base `36f37ea79acd`)
- Changed files: 20 (7 added, 13 modified, 0 renamed, 0 deleted)
- E2E decision: none; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `src/cli/tooling/release/prepare.mjs` | 1 |
| `tooling/release/*.mjs` | 4 |
| `tooling/documentation/manual.mjs` | 1 |
| `docs/user-manual/shell-cli/generated/manifest.json` | 1 |
| `tooling/tests/release*.mjs` | 3 |
| `tests/acceptance/release-generated-manual/*.checks.mjs` | 3 |
| `package.json` | 1 |
| `configs/quality/fallow.json` | 1 |
| `.github/workflows/release-cut.yml` | 1 |
| `docs/development/CUT-AND-PUBLISH-A-RELEASE.md` | 1 |
| `docs/development/MAINTENANCE-AND-RELEASE.md` | 1 |
| `CHANGELOG.md` | 0 |
| `docs/increments/release-generated-manual.md` | 1 |
| `docs/pull-requests/release-generated-manual-kickoff.md` | 1 |
| Outside the affected areas | 0 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/acceptance/release-generated-manual/ac-1.checks.mjs` |
| AC-2 | yes | `tests/acceptance/release-generated-manual/ac-2.checks.mjs` |
| AC-3 | yes | `tests/acceptance/release-generated-manual/ac-3.checks.mjs` |

### Gates

`node bin/app check --plan` was not available here (no installed dependencies); run it locally and paste the result into the pull request.
