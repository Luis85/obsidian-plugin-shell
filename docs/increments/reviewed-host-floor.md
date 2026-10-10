---
type: Increment
id: reviewed-host-floor
title: "Raise the Obsidian host floor through a reviewed release option"
owner: "Claude"
size: M
status: In progress
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
