---
type: Increment
id: cli-release-downloads
title: "Publish the downloadable Workbench CLI with each release"
owner: "Claude"
size: M
status: In progress
e2e: none
refs: []
pullRequests: [cli-release-downloads-kickoff, cli-release-downloads-1]
branch: "increment/cli-release-downloads"
base: main
---

# Publish the downloadable Workbench CLI with each release

<!-- Developer handoff for one pull request. `npm run dor` checks it before implementation,
`npm run dod` after it. Replace every <placeholder>; delete these comments when done. -->

## Summary

Each published GitHub release also carries the downloadable Workbench CLI: the framework kit `workbench-shell-X.Y.Z.zip`, the starters `workbench-starters-X.Y.Z.zip`, their manifest `workbench-distributions.json` and `workbench-SHA256SUMS`. The Release tier already builds them in "Independent Workbench distributions"; Publish now verifies them against the tested release head and uploads them next to the plugin's `main.js`, `manifest.json` and `styles.css`. This prepares 0.5.0, the first release a user can download to scaffold a plugin.

## Outcome

After a release is published, a plugin author downloads `workbench-shell-X.Y.Z.zip` and `workbench-starters-X.Y.Z.zip` from the release page, checks them with `workbench-SHA256SUMS`, extracts both into one empty folder and runs `node bin/app new my-plugin --starter <id>` with Node.js 22.13 or newer and no global install or `node_modules`. A maintainer sees in the Publish preview which distribution files will be uploaded and why a mismatching set is refused.

## Scope

### In scope

- Publish (preview and execute) locates the `workbench-distributions-<sha>` artifact of the same successful Release run as the qualified candidate, verifies it and uploads its four files as release assets after the plugin assets.
- Verification: the manifest names the release version and the release head as `sourceCommit`, lists exactly the shell and starters ZIPs, and every `workbench-SHA256SUMS` line and manifest hash matches the file bytes.
- Release-tier retention of the `workbench-distributions-<sha>` artifact long enough for Publish (the same retention as the qualified candidate).
- An acceptance test of the download journey: the two ZIPs packed from this checkout, extracted into an empty folder without `node_modules`, scaffold a project with `node bin/app new`.
- Docs for downloading, checking and running the CLI, and the publish guide's asset list.

### Out of scope

- Cutting and publishing 0.5.0 itself; that follows with the `release` skill after this increment merges.
- A separately versioned CLI line, `v`-prefixed tags, npm packages and the starter fetcher of `docs/development/PUBLISHED-DISTRIBUTION-PLAN.md`.
- Renaming `workbench-shell-*.zip` to `workbench-cli-*.zip` or bundling the starters into one ZIP.
- Obsidian community-directory submission and the blocked release profile.
- Changes to the plugin assets, their candidate checks or the cut.

## Acceptance criteria

<!-- One `- [ ] AC-n: text` per criterion. At completion tick it and add
`Evidence: \`path\`` (a test file, doc or report that exists). -->

- [x] AC-1: Given a release run whose `workbench-distributions-<sha>` artifact matches the release version and head, the Publish plan lists `workbench-shell-X.Y.Z.zip`, `workbench-starters-X.Y.Z.zip`, `workbench-distributions.json` and `workbench-SHA256SUMS` after `main.js`, `manifest.json` and `styles.css`, and execution uploads all seven to the draft release before publishing it.
  Evidence: `tests/acceptance/cli-release-downloads/ac-1.checks.mjs`
- [x] AC-2: Publish refuses with exit 1 and a named code, before any remote write, when the distribution artifact is missing, its manifest names another version or source commit, it holds an unexpected or missing file, or a checksum does not match the bytes.
  Evidence: `tests/acceptance/cli-release-downloads/ac-2.checks.mjs`
- [x] AC-3: A resumed Publish on an existing draft release uploads only the missing distribution files and never replaces or deletes an asset already on the release.
  Evidence: `tests/acceptance/cli-release-downloads/ac-3.checks.mjs`
- [x] AC-4: The shell and starters ZIPs packed from this checkout, extracted into one empty folder without `node_modules`, run `node bin/app new` with a starter and produce the project's `package.json`, `manifest.json` and `AGENTS.md`.
  Evidence: `tests/acceptance/cli-release-downloads/ac-4.checks.mjs`
- [x] AC-5: The README and `docs/development/CUT-AND-PUBLISH-A-RELEASE.md` describe the seven release assets, checking the ZIPs with `workbench-SHA256SUMS` and the scaffold command, and `starter-distribution.yml` keeps the distribution artifact as long as the qualified candidate.
  Evidence: `tests/acceptance/cli-release-downloads/ac-5.checks.mjs`

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

- `tooling/release/publish.mjs`: locate, verify and upload the distribution assets.
- `tooling/release/publish-discovery.mjs`: find and verify the distribution artifact of the Release run.
- `src/cli/tooling/release/distribution-assets.mjs`: the new verification of the distribution artifact.
- `tooling/tests/release-publish.checks.mjs`: the plan and upload of the new assets.
- `src/cli/tests/support/release-publish-fixture.mjs`: the fake remote's distribution artifact.
- `src/cli/tests/support/publish-cli-fixture.mjs`: runs the real publish CLI against the fake remote.
- `src/cli/tests/support/fake-gh.mjs`: the file-backed gh stand-in and the hook that routes the CLI's gh calls to it.
- `tooling/tests/release-publish-refusals.checks.mjs`: the new refusals.
- `tests/acceptance/cli-release-downloads/`: the acceptance tests.
- `README.md`: download and scaffold section.
- `tooling/examples/ownership.json`: the refreshed reviewed hash of the example-owned README.
- `docs/development/CUT-AND-PUBLISH-A-RELEASE.md`: the asset list and the download check.
- `docs/development/WORKFLOWS.md`: Publish uploads and retention.
- `docs/development/FRAMEWORK-CLI.md`: the published-kit route.
- `CHANGELOG.md`: the Unreleased entry.
- `docs/increments/cli-release-downloads.md`: this handoff.
- `docs/pull-requests/`: the kick-off and change pull request records.

## Test plan

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- Suite `release`: `release-publish` and `release-publish-refusals` with the fake GitHub remote, covering the plan, upload order, resume and every refusal.
- Suite `acceptance`: one acceptance test per criterion; AC-4 runs the real packed ZIPs and the extracted CLI.
- Suite `quality`: `repository.checks.mjs` over the changed workflows.
- Gate `npm run check`: types, lint and tests before each pull request is marked ready.
- Gate `npm run check:repository`: the workflow policy after the retention change.
- Gate `node tooling/testing/suites.mjs --check`: every new test file has a suite and test-pyramid level.
- Gate `node src/cli/tooling/release/changelog.mjs check`: the Unreleased entry.
- Gate `npm run check:self-review`: no findings on the diff.
- E2E: none; Publish runs against the fake remote and the download journey runs the CLI from extracted ZIPs. The real GitHub upload is first exercised by the 0.5.0 publish, which is also the first run of the automated pipeline.

## Docs impact

<!-- - `docs/path.md` (how-to): what changes   — or —   None — reason -->

- `README.md` (how-to): download the CLI and starters, check them and scaffold a plugin.
- `docs/development/CUT-AND-PUBLISH-A-RELEASE.md` (how-to): the seven release assets and what Publish verifies.
- `docs/development/WORKFLOWS.md` (reference): Publish uploads and the distribution artifact retention.
- `docs/development/FRAMEWORK-CLI.md` (reference): the published kit as the download route.

## Changelog

<!-- - Added: text  (Added, Changed, Deprecated, Removed, Fixed or Security)  — or —  None — reason -->

- Added: GitHub releases include the downloadable Workbench CLI and starters (`workbench-shell-X.Y.Z.zip`, `workbench-starters-X.Y.Z.zip`) with a manifest and SHA-256 checksums, so a plugin can be scaffolded without cloning this repository.

## Risks and rollback

Risk: Publish now depends on a second artifact; a missing or expired one blocks publication, which is the intended fail-closed behaviour, and retention matches the candidate. Risk: a partial upload leaves a draft release; resume uploads only the missing files and never replaces one, as for the plugin assets. Risk: the publish path is privileged; the change adds no new permission, token or trigger. Rollback: revert the change pull request; releases already published keep their assets, and a wrong release is fixed by a higher version.

## Dependencies

Owner prerequisites of the release pipeline (the `release` environment with reviewers, branch protection, Actions allowed to create pull requests) before 0.5.0 is cut; none for this increment's pull requests.

## Open questions

<!-- "None" when ready. Each open question blocks the Definition of Ready. -->

None

## Pull requests

<!-- wb:pull-requests generated by node bin/app; edits here are replaced -->
- [[docs/pull-requests/cli-release-downloads-kickoff|Kick-off: Publish the downloadable Workbench CLI with each release]] · New
- [[docs/pull-requests/cli-release-downloads-1|Publish the CLI and starters downloads with each release]] · New
<!-- /wb:pull-requests -->
