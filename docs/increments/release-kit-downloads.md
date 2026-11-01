---
type: Increment
id: release-kit-downloads
title: "Tidy release kits with or without starters"
owner: "Claude"
size: L
status: Done
e2e: none
refs: []
pullRequests: []
---

# Tidy release kits with or without starters

## Summary

A release offers the Workbench CLI as two alternative downloads instead of a CLI ZIP plus a data-only starters ZIP to extract on top: `workbench-shell-X.Y.Z.zip` (CLI only) and `workbench-shell-with-starters-X.Y.Z.zip` (CLI and every starter). The kit's root README becomes a short kit guide with the quick start, the framework boundaries and two prompts for an AI coding agent: start a new plugin, and migrate an existing plugin into a clean shell.

## Outcome

A plugin author downloads one ZIP, checks it, extracts it and scaffolds a plugin with the README's five commands, or pastes one of the README's prompts into a coding agent to do the same or to migrate an old plugin. A maintainer's Release tier packs and validates both kits exactly as Publish checks them.

## Scope

### In scope

- `node bin/app framework pack --with-starters`: the same kit plus every installed starter under `configs/starters/`.
- The kit root README from `src/cli/KIT-README.md`, with the packed version and its links rebased onto `bin/template/`.
- Release-tier packing of the two kits, a schema 2 `workbench-distributions.json` and a validation step that runs Publish's check.
- Publish's distribution check for the new asset pair and schema.
- Docs, adoption plan text and changelog for the two downloads.

### Out of scope

- Changing the CLI runtime, `bin/kit.json`, `framework status` or `framework upgrade`.
- Removing `node bin/app starters pack`; it still builds a data-only archive for sharing definitions.
- An npm package, a starter fetcher or renaming `bin/template/` (see `docs/development/PUBLISHED-DISTRIBUTION-PLAN.md`).
- Cutting or publishing a release.

## Acceptance criteria

- [x] AC-1: `node bin/app framework pack --with-starters --out <zip> --yes` packs every installed starter as `configs/starters/<id>.json` beside `bin/`, while `framework pack` without the flag packs none, and both extracted kits pass `framework status`. Evidence: `tests/acceptance/release-kit-downloads/ac-1.checks.mjs`
  Evidence: `tests/acceptance/release-kit-downloads/ac-1.checks.mjs`
- [x] AC-2: The extracted with-starters kit, without `node_modules`, runs the README quick start (`new --list`, a preview that writes nothing, then `--yes`) and produces a plugin project with `package.json`, `manifest.json` and `AGENTS.md`; the CLI-only kit lists no starters. Evidence: `tests/acceptance/release-kit-downloads/ac-2.checks.mjs`
  Evidence: `tests/acceptance/release-kit-downloads/ac-2.checks.mjs`
- [x] AC-3: The kit root README is the short kit guide: it names the packed version and no `X.Y.Z`, both downloads, the framework boundaries and the two agent prompts (start a new plugin; migrate an existing plugin keeping its manifest id), carries none of the framework repository's README, and every relative link resolves inside the extracted kit. Evidence: `tests/acceptance/release-kit-downloads/ac-3.checks.mjs`
  Evidence: `tests/acceptance/release-kit-downloads/ac-3.checks.mjs`
- [x] AC-4: The Release tier packs `workbench-shell-X.Y.Z.zip` and `workbench-shell-with-starters-X.Y.Z.zip` with a schema 2 manifest and checksums and validates them with Publish's check; Publish refuses a schema 1 manifest or a retired `workbench-starters-X.Y.Z.zip` with `DISTRIBUTION_INVALID` before any remote write. Evidence: `tests/acceptance/release-kit-downloads/ac-4.checks.mjs`
  Evidence: `tests/acceptance/release-kit-downloads/ac-4.checks.mjs`
- [x] AC-5: The README, `docs/development/CUT-AND-PUBLISH-A-RELEASE.md`, `docs/development/FRAMEWORK-CLI.md` and `CHANGELOG.md` describe the two downloads, and no live doc tells users to extract `workbench-starters-X.Y.Z.zip`. Evidence: `tests/acceptance/release-kit-downloads/ac-5.checks.mjs`
  Evidence: `tests/acceptance/release-kit-downloads/ac-5.checks.mjs`

## Affected areas

- `src/cli/KIT-README.md`: the kit's root README source.
- `src/cli/adapters/framework/kit.ts`: `--with-starters` packing and the kit README.
- `src/cli/adapters/framework/distribution.ts`: README link rebasing and the template README intro.
- `src/cli/adapters/framework/catalog.ts`: the `--with-starters` option.
- `src/cli/adapters/framework/help-text.ts`: option help and example.
- `src/cli/adapters/framework/process-operation.ts`: passes the option to the packer.
- `src/cli/domain/adoption/plan-phases.ts`: the adoption plan names the real download.
- `src/cli/tooling/release/distribution-assets.mjs`: the asset pair and manifest schema 2.
- `.github/workflows/starter-distribution.yml`: packs and validates the two kits.
- `src/cli/tests/framework-kit-bootstrap.checks.mjs`: the kit README.
- `src/cli/tests/support/release-publish-fixture.mjs`: the fake distribution artifact.
- `tooling/tests/release-publish.checks.mjs`: the release asset list.
- `tooling/tests/release-publish-refusals.checks.mjs`: the schema refusal.
- `tooling/tests/starter-distribution.checks.mjs`: the workflow contract.
- `tests/acceptance/cli-release-downloads/**`: the earlier increment's tests follow the new asset names.
- `tests/acceptance/release-kit-downloads/**`: the acceptance tests.
- `tests/suites.json`: registers the acceptance tests.
- `README.md`: the download section.
- `tooling/examples/ownership.json`: the refreshed reviewed hash of the example-owned README.
- `docs/development/ADOPT-EXISTING-PROJECT.md`: the download and the migration prompt.
- `docs/development/CUT-AND-PUBLISH-A-RELEASE.md`: the asset list.
- `docs/development/FRAMEWORK-CLI.md`: `--with-starters` and the kit README.
- `docs/development/JSON-STARTERS.md`: where starters come from.
- `docs/development/PUBLISHED-DISTRIBUTION-PLAN.md`: the implemented download layout.
- `docs/development/WORKBENCH-PLUGINS.md`: plugin starters are not packed.
- `docs/development/WORKFLOWS.md`: Publish uploads.
- `src/cli/PROJECT-STARTERS.md`: where starters come from.
- `CHANGELOG.md`: the Unreleased entries.
- `docs/increments/release-kit-downloads.md`: this handoff.

## Test plan

- New test `tests/acceptance/release-kit-downloads/ac-1.checks.mjs`: packs both kits with the real CLI and checks starters and `framework status`.
- New test `tests/acceptance/release-kit-downloads/ac-2.checks.mjs`: runs the README quick start from the extracted kits.
- New test `tests/acceptance/release-kit-downloads/ac-3.checks.mjs`: reads the extracted kit README and resolves its links.
- New test `tests/acceptance/release-kit-downloads/ac-4.checks.mjs`: the workflow steps and Publish's refusals with the fake GitHub remote.
- New test `tests/acceptance/release-kit-downloads/ac-5.checks.mjs`: the docs name the two downloads.
- Suite `release`: `release-publish` and `release-publish-refusals` with the new asset pair and schema.
- Suite `acceptance`: this increment's tests and `cli-release-downloads`, whose AC-4 now packs both kits.
- Gate `node bin/app check --fast --base origin/main`: types, lint and tests on the diff.
- Gate `node tooling/testing/suites.mjs --check`: every new test file has a suite and level.
- Gate `node src/cli/tooling/release/changelog.mjs check`: the Unreleased entries.
- Gate `npm run check:self-review`: no findings on the diff.
- E2E: none; the kits are exercised by running the extracted CLI, and the release upload runs against the fake remote.

## Docs impact

- `README.md` (how-to): the two downloads and where the agent prompts are.
- `src/cli/KIT-README.md` (how-to): the kit guide with the quick start and agent prompts.
- `docs/development/CUT-AND-PUBLISH-A-RELEASE.md` (how-to): the seven release assets.
- `docs/development/FRAMEWORK-CLI.md` (reference): `framework pack --with-starters` and the kit README.
- `docs/development/JSON-STARTERS.md` (reference): starters in the with-starters kit.
- `docs/development/ADOPT-EXISTING-PROJECT.md` (how-to): the real download name and the migration prompt.

## Changelog

- Added: Each release offers the Workbench CLI as two alternative downloads: `workbench-shell-X.Y.Z.zip` (the CLI only) and `workbench-shell-with-starters-X.Y.Z.zip` (the CLI with every starter in `configs/starters/`, ready for `node bin/app new`). `node bin/app framework pack --with-starters` builds the second one locally.
- Added: The extracted kit's `README.md` is now a short kit guide instead of the framework repository's README: which download it is, a five-command quick start, the framework boundaries a plugin must stay inside, and two copy-paste prompts for an AI coding agent, one to install Workbench and start a new plugin and one to migrate an existing Obsidian plugin into a clean shell.
- Removed: Releases no longer ship the separate data-only `workbench-starters-X.Y.Z.zip`; download `workbench-shell-with-starters-X.Y.Z.zip` instead. `workbench-distributions.json` moves to schema 2 and lists the two kits.

## Risks and rollback

Risk: someone scripted against `workbench-starters-X.Y.Z.zip`; releases up to 0.5.0 keep it, the changelog names the replacement, and `starters pack` still builds it locally. Risk: two kits double the upload size (about 41 MB and 45 MB); Publish already uploads each asset once and resumes without replacing. Rollback: revert the pull request; the next release then ships the previous asset set.

## Dependencies

None

## Open questions

None

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/main` (merge base `8013f9982f99`)
- Changed files: 36 (7 added, 29 modified, 0 renamed, 0 deleted)
- E2E decision: none; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `src/cli/KIT-README.md` | 1 |
| `src/cli/adapters/framework/kit.ts` | 1 |
| `src/cli/adapters/framework/distribution.ts` | 1 |
| `src/cli/adapters/framework/catalog.ts` | 1 |
| `src/cli/adapters/framework/help-text.ts` | 1 |
| `src/cli/adapters/framework/process-operation.ts` | 1 |
| `src/cli/domain/adoption/plan-phases.ts` | 1 |
| `src/cli/tooling/release/distribution-assets.mjs` | 1 |
| `.github/workflows/starter-distribution.yml` | 1 |
| `src/cli/tests/framework-kit-bootstrap.checks.mjs` | 1 |
| `src/cli/tests/support/release-publish-fixture.mjs` | 1 |
| `tooling/tests/release-publish.checks.mjs` | 1 |
| `tooling/tests/release-publish-refusals.checks.mjs` | 1 |
| `tooling/tests/starter-distribution.checks.mjs` | 1 |
| `tests/acceptance/cli-release-downloads/**` | 5 |
| `tests/acceptance/release-kit-downloads/**` | 5 |
| `tests/suites.json` | 0 |
| `README.md` | 1 |
| `tooling/examples/ownership.json` | 1 |
| `docs/development/ADOPT-EXISTING-PROJECT.md` | 1 |
| `docs/development/CUT-AND-PUBLISH-A-RELEASE.md` | 1 |
| `docs/development/FRAMEWORK-CLI.md` | 1 |
| `docs/development/JSON-STARTERS.md` | 1 |
| `docs/development/PUBLISHED-DISTRIBUTION-PLAN.md` | 1 |
| `docs/development/WORKBENCH-PLUGINS.md` | 1 |
| `docs/development/WORKFLOWS.md` | 1 |
| `src/cli/PROJECT-STARTERS.md` | 1 |
| `CHANGELOG.md` | 1 |
| `docs/increments/release-kit-downloads.md` | 1 |
| Outside the affected areas | 0 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/acceptance/release-kit-downloads/ac-1.checks.mjs`, `tests/acceptance/release-kit-downloads/ac-1.checks.mjs` |
| AC-2 | yes | `tests/acceptance/release-kit-downloads/ac-2.checks.mjs`, `tests/acceptance/release-kit-downloads/ac-2.checks.mjs` |
| AC-3 | yes | `tests/acceptance/release-kit-downloads/ac-3.checks.mjs`, `tests/acceptance/release-kit-downloads/ac-3.checks.mjs` |
| AC-4 | yes | `tests/acceptance/release-kit-downloads/ac-4.checks.mjs`, `tests/acceptance/release-kit-downloads/ac-4.checks.mjs` |
| AC-5 | yes | `tests/acceptance/release-kit-downloads/ac-5.checks.mjs`, `tests/acceptance/release-kit-downloads/ac-5.checks.mjs` |

### Gates

From `node bin/app check --plan`:

| Gate | Command | Required |
| --- | --- | --- |
| check | `node bin/app check --fast --base origin/main` | yes |
| coverage-production | `npm run test:coverage:production` | yes |
| suite:maker:pty | `node tooling/testing/suites.mjs maker:pty` | no |
| suite:maker | `node tooling/testing/suites.mjs maker` | yes |
| suite:workbench-plugins | `node tooling/testing/suites.mjs workbench-plugins` | no |
| suite:airship | `node tooling/testing/suites.mjs airship` | no |
| suite:compiler | `node tooling/testing/suites.mjs compiler` | no |
| suite:compiler:properties | `node tooling/testing/suites.mjs compiler:properties` | no |
| suite:prototypes | `node tooling/testing/suites.mjs prototypes` | no |
| suite:prototypes:python | `node tooling/testing/suites.mjs prototypes:python` | no |
| suite:companion:mvp | `node tooling/testing/suites.mjs companion:mvp` | no |
| suite:runtime | `node tooling/testing/suites.mjs runtime` | no |
| suite:cli | `node tooling/testing/suites.mjs cli` | yes |
| suite:cli:journey | `node tooling/testing/suites.mjs cli:journey` | no |
| suite:generator | `node tooling/testing/suites.mjs generator` | no |
| suite:visual | `node tooling/testing/suites.mjs visual` | no |
| suite:companion | `node tooling/testing/suites.mjs companion` | no |
| suite:companion:schema | `node tooling/testing/suites.mjs companion:schema` | no |
| suite:companion:assembly | `node tooling/testing/suites.mjs companion:assembly` | no |
| suite:companion:browser | `node tooling/testing/suites.mjs companion:browser` | no |
| suite:companion:visual-browser | `node tooling/testing/suites.mjs companion:visual-browser` | no |
| suite:companion:starter-browser | `node tooling/testing/suites.mjs companion:starter-browser` | no |
| suite:test-data | `node tooling/testing/suites.mjs test-data` | no |
| suite:makers | `node tooling/testing/suites.mjs makers` | yes |
| suite:native | `node tooling/testing/suites.mjs native` | no |
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
