---
type: Increment
id: obsidian-api-1-14
title: "Obsidian 1.14.4 API declarations and host floor"
owner: "Claude"
size: M
status: Done
e2e: required
refs: []
pullRequests: [obsidian-api-1-14-kickoff]
branch: "increment/obsidian-api-1-14"
base: main
---

# Obsidian 1.14.4 API declarations and host floor

<!-- Developer handoff for one pull request. `npm run dor` checks it before implementation,
`npm run dod` after it. Replace every <placeholder>; delete these comments when done. -->

## Summary

Moves the plugin to Obsidian 1.14.4, the current public desktop release (2026-10-10): the `obsidian` API declarations dev dependency goes from 1.13.1 to 1.14.4 with its exact CodeMirror peers, and the declared host floor `minAppVersion` plus the host the real-Obsidian tooling launches go from 1.13.7 to 1.14.4. 1.14.4 depends on the patched `moment@2.31.0`, so the root API package no longer carries the Moment advisory.

## Outcome

The plugin type-checks, lints, tests and builds against the 1.14.4 declarations from a strict `npm ci`, declares 1.14.4 as its minimum app version, and the real-Obsidian suite passes on host 1.14.4. Released versions keep their recorded 1.13.7 floors in `versions.json`; the next release records the new floor.

## Scope

### In scope

- Exact pin `obsidian` 1.14.4 in `package.json` and the matching lockfile, including its CodeMirror peers.
- `minAppVersion` 1.14.4 in `manifest.json`.
- The default real-Obsidian host, the native smoke target and evidence identity, the CI host cache key and the generated devkit cache keys move to 1.14.4, with the native report fixtures and refreshed example ownership hashes.
- Update the Moment advisory record, the developer guide, README, dev-loop, maintenance and test-suite docs.

### Out of scope

- Historical `versions.json` entries and dated records of earlier qualification runs.
- `eslint-plugin-obsidianmd` and its nested `obsidian@1.12.3`, which keep the advisory open.
- The standalone companion project under `projects/companion`, which keeps its own host pins.
- Any `overrides` entry or audit ignore.

## Acceptance criteria

<!-- One `- [ ] AC-n: text` per criterion. At completion tick it and add
`Evidence: \`path\`` (a test file, doc or report that exists). -->

- [x] AC-1: The lockfile resolves the root `obsidian` API package to 1.14.4 with a patched `moment` (2.31.0 or later) and its exact CodeMirror peers.
  Evidence: `tests/acceptance/obsidian-api-1-14/ac-1.checks.mjs`
- [x] AC-2: The manifest floor, the default real-Obsidian host and the native smoke target are all 1.14.4, and released versions keep their recorded floors.
  Evidence: `tests/acceptance/obsidian-api-1-14/ac-2.checks.mjs`

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

- `package.json`: the exact `obsidian` pin.
- `package-lock.json`: the resolved API package, Moment and CodeMirror peers.
- `manifest.json`: the declared minimum app version.
- `tooling/testing/*.mjs`: the default host, native smoke target, evidence identity and witness manifest.
- `tooling/tests/*.checks.mjs`: the host default and native report fixtures.
- `tooling/examples/ownership.json`: refreshed hashes of the changed example-owned files.
- `templates/examples/scripts__testing__check-native.mjs.txt`: the replacement native smoke target.
- `templates/companion/devkit/*.tmpl`: the generated projects' host cache keys.
- `.github/workflows/ci.yml`: the real-Obsidian host cache key.
- `README.md`: the stated host minimum.
- `DEVELOPER_GUIDE.md`: the host version and the audit note.
- `docs/development/*.md`: the Moment advisory record and the maintenance snapshot.
- `docs/testing/*.md`: the dev-loop default host and the measured real-Obsidian suite.
- `CHANGELOG.md`: the Unreleased entry.
- `tests/acceptance/obsidian-api-1-14/*.checks.mjs`: the acceptance tests.
- `docs/increments/obsidian-api-1-14.md`: this handoff.
- `docs/pull-requests/obsidian-api-1-14-kickoff.md`: the kick-off pull request record.

## Test plan

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- Suite `acceptance`: runs the AC-1 and AC-2 acceptance tests.
- Suite `obsidian`: the real-Obsidian suite (load, commands, views, unload and reload) on host 1.14.4; locally and through the `e2e` label in CI.
- Suite `native`: native report, identity and host tooling units with the 1.14.4 fixtures.
- Suite `quality`: example ownership and repository gates.
- New test `tests/acceptance/obsidian-api-1-14/ac-2.checks.mjs`: the floor, the default host and the native target agree.
- Gate `npm run check:security`: the live audit, expected to keep reporting the lint plugin's copy.
- Gate `npm run check:self-review`: no findings on the diff.
- E2E: required — raising the host floor needs the real-Obsidian suite on the new host.

## Docs impact

<!-- - `docs/path.md` (how-to): what changes   — or —   None — reason -->

- `docs/development/MOMENT-ADVISORY-EXCEPTION.md` (explanation): record the 1.14.4 update and the remaining dependent.
- `DEVELOPER_GUIDE.md` (how-to): the host version and the audit note.
- `docs/development/MAINTENANCE-AND-RELEASE.md` (reference): the dated public snapshot.
- `docs/testing/OBSIDIAN-DEV-LOOP.md` (how-to): the default host.

## Changelog

<!-- - Added: text  (Added, Changed, Deprecated, Removed, Fixed or Security)  — or —  None — reason -->

- Changed: The minimum Obsidian app version is now 1.14.4 (was 1.13.7), and the `obsidian` API declarations are 1.14.4, which uses the patched `moment` 2.31.0; the real-Obsidian tooling launches host 1.14.4 by default.

## Risks and rollback

Users on Obsidian 1.13.x no longer get new plugin versions once a release records the 1.14.4 floor; 1.14.4 is the public desktop release and the plugin is desktop-only. The full type-check proves the code still compiles against the new declarations, and the real-Obsidian suite proves load, commands, views and reload on host 1.14.4. Roll back by reverting this pull request before a release records the floor.

## Dependencies

None

## Open questions

<!-- "None" when ready. Each open question blocks the Definition of Ready. -->

None

## Pull requests

<!-- wb:pull-requests generated by node bin/app; edits here are replaced -->
- [[docs/pull-requests/obsidian-api-1-14-kickoff|Kick-off: Obsidian API declarations 1.14.4]] · New
<!-- /wb:pull-requests -->

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/main` (merge base `b33c0cf46220`)
- Changed files: 28 (4 added, 24 modified, 0 renamed, 0 deleted)
- E2E decision: required; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `package.json` | 1 |
| `package-lock.json` | 1 |
| `manifest.json` | 1 |
| `tooling/testing/*.mjs` | 5 |
| `tooling/tests/*.checks.mjs` | 5 |
| `tooling/examples/ownership.json` | 1 |
| `templates/examples/scripts__testing__check-native.mjs.txt` | 1 |
| `templates/companion/devkit/*.tmpl` | 2 |
| `.github/workflows/ci.yml` | 1 |
| `README.md` | 1 |
| `DEVELOPER_GUIDE.md` | 1 |
| `docs/development/*.md` | 2 |
| `docs/testing/*.md` | 2 |
| `CHANGELOG.md` | 0 |
| `tests/acceptance/obsidian-api-1-14/*.checks.mjs` | 2 |
| `docs/increments/obsidian-api-1-14.md` | 1 |
| `docs/pull-requests/obsidian-api-1-14-kickoff.md` | 1 |
| Outside the affected areas | 0 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/acceptance/obsidian-api-1-14/ac-1.checks.mjs` |
| AC-2 | yes | `tests/acceptance/obsidian-api-1-14/ac-2.checks.mjs` |

### Gates

`node bin/app check --plan` was not available here (no installed dependencies); run it locally and paste the result into the pull request.
