---
type: Increment
id: reviewed-host-floor
title: "Raise the Obsidian host floor through a reviewed release option"
owner: "Claude"
size: M
status: Done
e2e: optional
refs: []
pullRequests: [reviewed-host-floor-kickoff]
branch: "increment/reviewed-host-floor"
base: main
---

# Raise the Obsidian host floor through a reviewed release option

<!-- Developer handoff for one pull request. `npm run dor` checks it before implementation,
`npm run dod` after it. Replace every <placeholder>; delete these comments when done. -->

## Summary

Raising `minAppVersion` to Obsidian 1.14.4, the public desktop release on 2026-10-10, was deferred because the repository had no supported path for a host floor change: release preparation refused any floor that differed from the current version's `versions.json` entry (`UNREVIEWED_HOST_FLOOR_CHANGE`) and always reported `hostFloorChanged: false`, and setup refuses a released version whose recorded floor differs. Release preparation and `release:cut` now take an explicit, reviewed `--min-app-version`, write it to `manifest.minAppVersion` and the new `versions.json` entry together, and show the change in the plan. The tested-host pins move to 1.14.4 in the same change.

## Outcome

A maintainer cuts the next release with `node tooling/release/cut.mjs --version X.Y.Z --min-app-version 1.14.4` (or the Release cut `min_app_version` input): the dry run shows `minAppVersion 1.13.7 -> 1.14.4`, the release commit records `"X.Y.Z": "1.14.4"` while every released entry keeps 1.13.7, and the release pull request names the raised floor. An unreviewed floor edit is still refused. Native and real-Obsidian tests run host 1.14.4.

## Scope

### In scope

- `prepareVersion` and `release:prepare` accept a reviewed `minAppVersion` above the current floor and report `previousMinAppVersion` and `hostFloorChanged`.
- `tooling/release/cut.mjs` takes `--min-app-version`, shows the floor in its plan, output and release pull request body, and refuses a resumed cut whose committed floor differs from the requested one.
- The Release cut workflow's optional `min_app_version` input and the `node bin/app release prepare --min-app-version` option.
- Tested-host pins moved to 1.14.4: the host default, the native smoke target and its example template, the evidence identity guard, the foreign-notice witness, the real-Obsidian runner, the CI and devkit host cache keys and the native report fixtures.
- Refreshed `tooling/examples/ownership.json` hashes of the changed example-owned files.
- Docs: README, developer guide, Obsidian dev loop, test suites, release how-to and maintenance policy.

### Out of scope

- Changing `minAppVersion` or `versions.json` on `main`: the floor moves with the next release cut.
- Cutting, tagging or publishing a release.
- The standalone `projects/companion` release tooling and its host pins.
- Lowering a floor: a reviewed floor must be higher than the current one.

## Acceptance criteria

<!-- One `- [ ] AC-n: text` per criterion. At completion tick it and add
`Evidence: \`path\`` (a test file, doc or report that exists). -->

- [x] AC-1: Given a release source whose floor is 1.13.7 When the cut runs with the reviewed --min-app-version 1.14.4 Then the plan shows 1.13.7 -> 1.14.4, and the release commit sets manifest minAppVersion 1.14.4 and versions.json records the new version at 1.14.4 while every released entry keeps 1.13.7
  Evidence: `tests/acceptance/reviewed-host-floor/ac-1.checks.mjs`
- [x] AC-2: Given an invalid, unchanged or lower --min-app-version, or a floor edited in the source without review When release preparation or the cut runs Then it refuses (HOST_FLOOR_INVALID, HOST_FLOOR_NOT_RAISED, UNREVIEWED_HOST_FLOOR_CHANGE) without creating a branch or writing a file
  Evidence: `tests/acceptance/reviewed-host-floor/ac-2.checks.mjs`
- [x] AC-3: The tested-host pins (host default, native smoke target and template, evidence guard, foreign-notice witness, real-Obsidian runner, CI and devkit cache keys) name 1.14.4 and the example ownership hashes match the changed example-owned files
  Evidence: `tests/acceptance/reviewed-host-floor/ac-3.checks.mjs`

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

- `src/cli/tooling/release/prepare.mjs`: the reviewed host floor option.
- `tooling/release/cut.mjs`: the cut option, plan, output and pull request body.
- `.github/workflows/release-cut.yml`: the optional `min_app_version` input.
- `.github/PULL_REQUEST_TEMPLATE/release.md`: the host floor line.
- `src/cli/adapters/framework/**`: the `release prepare` option.
- `docs/user-manual/shell-cli/generated/**`: the regenerated CLI reference.
- `tooling/testing/**`: the tested-host pins.
- `templates/**`: the devkit cache keys and the native smoke example.
- `.github/workflows/ci.yml`: the host cache key.
- `tooling/examples/ownership.json`: refreshed example hashes.
- `tooling/tests/**`: release and native report tests.
- `tests/acceptance/reviewed-host-floor/**`: the acceptance tests.
- `README.md`: the host minimum statement.
- `DEVELOPER_GUIDE.md`: the tested host row.
- `docs/testing/**`: the dev loop default and the suite table.
- `docs/development/**`: the release how-to and maintenance policy.
- `docs/increments/reviewed-host-floor.md`: this handoff.
- `docs/pull-requests/reviewed-host-floor-kickoff.md`: the kick-off pull request record.

## Test plan

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- Suite `release`: runs `tooling/tests/release.checks.mjs` and `tooling/tests/release-cut.checks.mjs` with the reviewed and refused floor cases against real git repositories.
- Suite `native`: runs the native report fixtures and the harness default host check on 1.14.4.
- Suite `quality`: runs the evidence adapter checks with the 1.14.4 identity guard.
- Suite `acceptance`: runs the three acceptance tests.
- New test `tests/acceptance/reviewed-host-floor/ac-1.checks.mjs`: runs the real cut and prepare scripts on a fixture repository and checks the released and new `versions.json` entries.
- New test `tests/acceptance/reviewed-host-floor/ac-2.checks.mjs`: invalid, unchanged, lowered and unreviewed floors are refused without a branch or a write.
- New test `tests/acceptance/reviewed-host-floor/ac-3.checks.mjs`: reads the pinned tooling files as text and checks the 1.14.4 pins and the example ownership hashes.
- Gate `npm run check`: builds the CLI, then types, lint and tests.
- Gate `npm run check:self-review`: no findings on the diff.
- E2E: optional — no user interface change; the templates change only devkit host cache keys and the native smoke example. The real-Obsidian suite on host 1.14.4 runs with the `e2e` label and in the Release tier.

## Docs impact

<!-- - `docs/path.md` (how-to): what changes   — or —   None — reason -->

- `docs/development/CUT-AND-PUBLISH-A-RELEASE.md` (how-to): choosing and passing a reviewed host floor.
- `docs/development/MAINTENANCE-AND-RELEASE.md` (reference): the reviewed floor rule next to [R25].
- `docs/testing/OBSIDIAN-DEV-LOOP.md` (how-to): the default host 1.14.4.

## Changelog

<!-- - Added: text  (Added, Changed, Deprecated, Removed, Fixed or Security)  — or —  None — reason -->

- Added: Release preparation and the release cut take a reviewed `--min-app-version` that raises the Obsidian host floor in `manifest.json` and the new `versions.json` entry; the native and real-Obsidian tests now run Obsidian 1.14.4.

## Risks and rollback

A wrong floor would exclude users on older hosts; the option only raises the floor, the plan shows it before any write, and promotion needs native acceptance on the new minimum host. Moving the tested host without raising the floor leaves 1.13.7 untested until the release raises it; the release's native acceptance closes that gap. Roll back by reverting these commits; no released metadata changes.

## Dependencies

The Obsidian API declarations 1.14.4 increment on the same branch (pull request 111).

## Open questions

<!-- "None" when ready. Each open question blocks the Definition of Ready. -->

None

## Pull requests

<!-- wb:pull-requests generated by node bin/app; edits here are replaced -->
- [[docs/pull-requests/reviewed-host-floor-kickoff|Kick-off: Raise the Obsidian host floor through a reviewed release option]] · New
<!-- /wb:pull-requests -->

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/main` (merge base `2cb7c4842df3`)
- Changed files: 45 (8 added, 37 modified, 0 renamed, 0 deleted)
- E2E decision: optional; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `src/cli/tooling/release/prepare.mjs` | 1 |
| `tooling/release/cut.mjs` | 1 |
| `.github/workflows/release-cut.yml` | 1 |
| `.github/PULL_REQUEST_TEMPLATE/release.md` | 1 |
| `src/cli/adapters/framework/**` | 3 |
| `docs/user-manual/shell-cli/generated/**` | 3 |
| `tooling/testing/**` | 5 |
| `templates/**` | 3 |
| `.github/workflows/ci.yml` | 1 |
| `tooling/examples/ownership.json` | 1 |
| `tooling/tests/**` | 7 |
| `tests/acceptance/reviewed-host-floor/**` | 3 |
| `README.md` | 1 |
| `DEVELOPER_GUIDE.md` | 1 |
| `docs/testing/**` | 2 |
| `docs/development/**` | 3 |
| `docs/increments/reviewed-host-floor.md` | 1 |
| `docs/pull-requests/reviewed-host-floor-kickoff.md` | 1 |
| Outside the affected areas | 5 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/acceptance/reviewed-host-floor/ac-1.checks.mjs` |
| AC-2 | yes | `tests/acceptance/reviewed-host-floor/ac-2.checks.mjs` |
| AC-3 | yes | `tests/acceptance/reviewed-host-floor/ac-3.checks.mjs` |

### Gates

From `node bin/app check --plan`:

| Gate | Command | Required |
| --- | --- | --- |
| check | `node bin/app check --fast --base origin/main` | yes |
| coverage-production | `npm run test:coverage:production` | yes |
| suite:maker:pty | `node tooling/testing/suites.mjs maker:pty` | no |
| suite:maker | `node tooling/testing/suites.mjs maker` | no |
| suite:workbench-plugins | `node tooling/testing/suites.mjs workbench-plugins` | no |
| suite:airship | `node tooling/testing/suites.mjs airship` | no |
| suite:compiler | `node tooling/testing/suites.mjs compiler` | yes |
| suite:compiler:properties | `node tooling/testing/suites.mjs compiler:properties` | no |
| suite:prototypes | `node tooling/testing/suites.mjs prototypes` | no |
| suite:prototypes:python | `node tooling/testing/suites.mjs prototypes:python` | no |
| suite:companion:mvp | `node tooling/testing/suites.mjs companion:mvp` | no |
| suite:runtime | `node tooling/testing/suites.mjs runtime` | no |
| suite:cli | `node tooling/testing/suites.mjs cli` | yes |
| suite:cli:journey | `node tooling/testing/suites.mjs cli:journey` | no |
| suite:generator | `node tooling/testing/suites.mjs generator` | yes |
| suite:visual | `node tooling/testing/suites.mjs visual` | no |
| suite:companion | `node tooling/testing/suites.mjs companion` | yes |
| suite:companion:schema | `node tooling/testing/suites.mjs companion:schema` | no |
| suite:companion:assembly | `node tooling/testing/suites.mjs companion:assembly` | no |
| suite:companion:browser | `node tooling/testing/suites.mjs companion:browser` | no |
| suite:companion:visual-browser | `node tooling/testing/suites.mjs companion:visual-browser` | no |
| suite:companion:starter-browser | `node tooling/testing/suites.mjs companion:starter-browser` | no |
| suite:test-data | `node tooling/testing/suites.mjs test-data` | no |
| suite:makers | `node tooling/testing/suites.mjs makers` | yes |
| suite:memory | `node tooling/testing/suites.mjs memory` | no |
| suite:memory:python | `node tooling/testing/suites.mjs memory:python` | no |
| suite:native | `node tooling/testing/suites.mjs native` | yes |
| suite:setup | `node tooling/testing/suites.mjs setup` | no |
| suite:release | `node tooling/testing/suites.mjs release` | yes |
| suite:acceptance | `node tooling/testing/suites.mjs acceptance` | yes |
| suite:quality | `node tooling/testing/suites.mjs quality` | yes |
| suite:baseline | `node tooling/testing/suites.mjs baseline` | no |
| suite:e2e | `node tooling/testing/suites.mjs e2e` | no |
| suite:project | `node tooling/testing/suites.mjs project` | no |
| suite:project:ui-effects | `node tooling/testing/suites.mjs project:ui-effects` | no |
| suite:obsidian | `node tooling/testing/suites.mjs obsidian` | no |
| verify | `npm run verify` | yes |
