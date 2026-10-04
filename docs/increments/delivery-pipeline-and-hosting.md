---
type: Increment
id: delivery-pipeline-and-hosting
title: "Delivery pipeline, documentation archive and hosting platforms"
owner: "Luis85"
size: L
status: Done
e2e: optional
refs: ["#74", docs/development/DELIVERY-PIPELINE.md, "[[WORKFLOWS]]"]
pullRequests: ["#74"]
---

# Delivery pipeline, documentation archive and hosting platforms

## Summary

Turns the framework repository into a tiered delivery pipeline. Historical documents
move to an archive behind a Diataxis index, pull requests pass a fast Dev tier, an
Integration tier and a Release tier, releases are cut and published by automated,
reviewed workflows with a Keep a Changelog changelog, agents get ideation, delivery and
release skills, projects can choose GitHub, Azure DevOps or no hosting platform, and
every pull request carries an Increment document checked by the Definition of Ready and
the Definition of Done.

## Outcome

A maintainer opens a draft pull request with its Increment document, gets fast Dev and
Definition of Ready feedback, marks it ready to run the Integration tier and the
Definition of Done, and releases a green `main` through the Release cut, Release tier
and Publish workflows without manual tagging. Readers find current documentation by
Diataxis type, and a generated project gets the pipeline of its hosting platform.

## Scope

### In scope

- The `docs/_archive/` move of historical records and the Diataxis index in `docs/README.md`.
- Dev, Integration, Release and Publish tiers: `dev.yml`, the ready-gate in every pull-request workflow, `release.yml` with its alias checks, `release-cut.yml` and `publish.yml` with the scoped write policy.
- Release scripts (`scripts/release/branch.mjs`, `changelog.mjs`, `cut.mjs`, `publish.mjs`) and the Keep a Changelog `CHANGELOG.md`.
- The ideation skill chain, the `feature-delivery` and `release` skills and their Codex adapters.
- The GitHub, Azure DevOps or no hosting choice for `setup`, `new` and `hosting show|set`, with the generated `azure-pipelines.yml`.
- The Definition of Ready and Definition of Done checks, their configuration, workflows and this Increment document.
- PullRequest and Issue documents, the kick-off and change pull request kinds of the increment branch model and the acceptance criterion test stubs in those checks.

### Out of scope

- Running the Release cut or Publish workflows against GitHub, tagging or publishing a release.
- Changing the blocked legacy release profile or submitting to the Obsidian community directory.
- Calling `gh` or `az`, adding remotes or storing tokens for a generated project.
- The Increments and PullRequest CLI feature that will edit and sync these documents.

## Acceptance criteria

- [x] AC-1: Current documentation is indexed by Diataxis type in `docs/README.md`, historical records live under `docs/_archive/`, and neither reaches a generated project. Evidence: `docs/README.md`, `docs/_archive/README.md`, `tests/tooling/project-generator-framework-scope.checks.mjs`
- [x] AC-2: Every pull-request workflow skips drafts and release heads unless called with `tier: release`; `release.yml` calls each of them and reports "Dev checks", "CI result", "Definition of Ready" and "Definition of Done" only after "Release result" succeeded. Evidence: `tests/tooling/interactive-maker-ci-workflow-model.checks.mjs`, `.github/workflows/release.yml`
- [x] AC-3: Only `release-cut.yml` and `publish.yml` may write, only on manual dispatch behind the `release` environment; every other workflow fails the repository policy when it asks for a write scope. Evidence: `scripts/quality/workflow-policy.mjs`, `tests/tooling/repository.checks.mjs`
- [x] AC-4: Release cut and publish default to a plan, resume idempotently and refuse to merge, tag or release without a green "Release result" on the tested head. Evidence: `tests/tooling/release-cut.checks.mjs`, `tests/tooling/release-publish.checks.mjs`, `tests/tooling/release-publish-refusals.checks.mjs`
- [x] AC-5: `CHANGELOG.md` follows Keep a Changelog 1.1.0; the release branch verifier rejects a missing or malformed version section. Evidence: `tests/tooling/release-changelog.checks.mjs`, `tests/tooling/release-branch.checks.mjs`
- [x] AC-6: The ideation, `feature-delivery` and `release` skills cite only existing scripts, npm scripts, workflows and jobs, and never act on remote state without an explicit request. Evidence: `tests/tooling/agent-ideation-skills.checks.mjs`, `tests/tooling/agent-delivery-skills.checks.mjs`
- [x] AC-7: `setup`, `new` and `hosting set` record GitHub, Azure DevOps or no hosting through a reviewed plan that deletes nothing, and a generated project gets the matching pipeline and template. Evidence: `tests/tooling/framework-hosting-command.checks.mjs`, `tests/tooling/framework-hosting-flags.checks.mjs`, `tests/tooling/project-generator-hosting.checks.mjs`, `tests/tooling/setup-hosting.checks.mjs`
- [x] AC-8: The Definition of Ready fails an incomplete Increment document with a hint per rule and a refinement brief naming the `increment-handoff` and ideation skills, and exempts release and dependabot pull requests. Evidence: `tests/tooling/delivery-ready.checks.mjs`, `tests/tooling/delivery-handoff.checks.mjs`, `configs/delivery/definition-of-ready.json`
- [x] AC-9: The Definition of Done checks criteria evidence, tests, changelog, typed and indexed docs, forbidden additions and the `e2e` label, and generates the Completion record, changelog entries and index rows with `--write` while CI stays read-only. Evidence: `tests/tooling/delivery-done.checks.mjs`, `tests/tooling/delivery-cli.checks.mjs`, `.github/workflows/definition-of-done.yml`
- [x] AC-10: Neither the framework kit nor a generated project receives the Dev, Release, Release cut, Publish, Definition of Ready or Definition of Done workflows. Evidence: `tests/tooling/interactive-maker-compiler-emitters-kit.checks.mjs`, `tests/tooling/starter-distribution.checks.mjs`
- [x] AC-11: The Definition of Ready checks the PullRequest and Issue documents a pull request changes and their links to the Increment, requires one test stub (or an existing test as evidence) per acceptance criterion, and the Definition of Done completes a change pull request against its PullRequest document and the kick-off against the whole Increment. Evidence: `tests/tooling/delivery-documents.checks.mjs`, `tests/tooling/delivery-acceptance.checks.mjs`, `configs/delivery/delivery.json`

## Affected areas

- `docs/_archive/**`: archived historical records.
- `docs/README.md`: the Diataxis index.
- `docs/development/**`: delivery, workflow, hosting and layout pages.
- `docs/increments/**`: this Increment document.
- `docs/architecture/**`: link updates after the archive move.
- `docs/concepts/**`: link updates and the re-assembled companion concept.
- `docs/design/**`: link updates.
- `docs/memory/**`: link updates.
- `docs/prds/**`: link updates.
- `docs/product/**`: link updates.
- `docs/project-setup/**`: link updates.
- `docs/research/**`: the research index.
- `docs/security/**`: link updates.
- `docs/tasks/**`: link updates.
- `docs/testing/**`: link updates and the suite guide.
- `docs/tooling/**`: link updates.
- `docs/user-manual/**`: link updates.
- `*.md`: root guides, `AGENTS.md`, `README.md` and `CHANGELOG.md`.
- `.gitattributes`: line endings of the archive.
- `.github/workflows/**`: the tiers, release workflows and delivery checks.
- `.github/PULL_REQUEST_TEMPLATE/release.md`: the release pull-request template.
- `.github/CODEOWNERS`: owners of the pipeline and delivery configuration.
- `.github/pull_request_template.md`: the opt-in end-to-end label in the pull-request template.
- `.claude/skills/**`: ideation, delivery and release skills.
- `.agents/skills/**`: their Codex adapters.
- `bin/**`: hosting command, CI plan, adoption and compiler scope.
- `configs/delivery/**`: Definition of Ready and Done configuration and template.
- `configs/quality/fallow.json`: analyzer entry points for the new scripts.
- `scripts/release/**`: branch, changelog, cut and publish scripts.
- `scripts/delivery/**`: the Definition of Ready and Done checks.
- `scripts/quality/**`: workflow policy and self-review updates.
- `scripts/setup/**`: the hosting prompt.
- `scripts/setup.mjs`: the hosting flags.
- `scripts/companion/**`: the hosting contract.
- `scripts/compiler/**`: generator qualifiers skip only their browser runs.
- `scripts/examples/**`: link updates.
- `scripts/help.mjs`: new npm scripts in the help.
- `scripts/testing/suite-manifest.mjs`: optional tooling suites without files are not run.
- `scripts/testing/evidence-identity.mjs`: the tooling inventory includes acceptance criterion tests.
- `scripts/README.md`: the release and delivery scripts.
- `templates/companion/devkit/**`: the Azure Pipelines template and hosting hints.
- `tests/**`: tests and the suite manifest.
- `package.json`: release and delivery npm scripts.

## Test plan

- Suite `release`: release scripts, changelog and the Definition of Ready and Done checks.
- Suite `quality`: repository policy, workflow policy negatives and the skill checks.
- Suite `maker`: workflow model, release aliases, CI reproduction and kit boundaries.
- Suite `generator`: framework scope and the hosting-specific generated project.
- Suite `cli`: the hosting command and flags.
- Gate `node bin/app check --fast --skip-suites --base origin/claude/exciting-brown-c6ipwt`: typecheck, lint and related tests on the diff.
- Gate `npm run check:repository`: workflow, composite action and root Markdown policy.
- Gate `npm run check:analyzer`: no dead exports in the new scripts.
- Gate `node scripts/release/changelog.mjs check`: changelog structure.
- Gate `actionlint`: workflow syntax and shell scripts.
- New test `tests/tooling/delivery-ready.checks.mjs`: every Definition of Ready rule, positive and negative.
- New test `tests/tooling/delivery-done.checks.mjs`: every Definition of Done rule and the generators.
- New test `tests/tooling/delivery-handoff.checks.mjs`: the parser and strict configuration.
- New test `tests/tooling/delivery-cli.checks.mjs`: end to end in a temporary repository and the workflow shape.
- New test `tests/tooling/delivery-documents.checks.mjs`: PullRequest and Issue rules, drift and the kick-off and change Definition of Done.
- New test `tests/tooling/delivery-acceptance.checks.mjs`: acceptance stubs from a new increment to an implemented one and the pending-stub guard exception.
- E2E: optional, because no rendered view changes; the companion concept bundle only re-assembles the hosting contract, which its own browser suites cover in the companion concept workflow.

## Docs impact

- `docs/development/DELIVERY-PIPELINE.md` (explanation): why the tiers exist and how they hand off.
- `docs/development/DELIVER-A-CHANGE.md` (how-to): deliver a change through the tiers.
- `docs/development/CUT-AND-PUBLISH-A-RELEASE.md` (how-to): cut and publish a release.
- `docs/development/WORKFLOWS.md` (reference): every workflow, its jobs and the repository policy.
- `docs/development/HOSTING-PLATFORMS.md` (how-to): choose GitHub, Azure DevOps or no hosting platform.
- `docs/development/REPOSITORY-LAYOUT.md` (explanation): what each top-level folder owns.

## Changelog

- Added: Tiered delivery pipeline: a fast Dev tier for every pull request including drafts, an Integration tier for pull requests marked ready for review and a Release tier that runs every check with full matrices on a `release/X.Y.Z` branch.
- Added: Release cut and publish automation: `release:cut` creates the release branch from `main`, prepares version metadata, commits and opens a draft release pull request; `release:publish` merges the tested release head, creates the bare `X.Y.Z` tag and the GitHub release with the qualified candidate assets, then deletes the release branch. Both default to a dry-run plan and are idempotent on rerun.
- Added: `release:changelog` validates this changelog and extracts one version's notes; release preparation promotes the Unreleased section into the new version.
- Added: Archived historical development documents under `docs/_archive/` and added a documentation index (`docs/README.md`) that sorts current pages into tutorials, how-to guides, reference and explanation.
- Added: Delivery documentation: the delivery pipeline explanation, how-to guides to deliver a change and to cut and publish a release, and a reference of every GitHub Actions workflow, its triggers, jobs, permissions and required checks.
- Added: Chained ideation skills for Claude Code (`ideation-journey`, `ideation-brainstorm`, `ideation-concept`, `ideation-design`, `ideation-prototype`, `ideation-boilerplate`) that take an idea to a checked prototype skeleton, with Codex adapters.
- Added: `feature-delivery` and `release` skills that drive a draft pull request through the Dev and Integration tiers to a green merge, and a release from cut to publish, without acting on remote state unless the user explicitly asks.
- Added: Setup and creation ask which hosting platform a project uses (GitHub, Azure DevOps or none): `--hosting` with `--azure-organization`, `--azure-project` and `--azure-repository` for `node bin/app setup`, `node bin/app new <dir>` and `npm run setup`. Generated projects get the matching pipeline (`azure-pipelines.yml` or GitHub Actions), pull-request template and `gh`/`az` hints; `node bin/app hosting show|set` switches an existing project through a reviewed plan that deletes nothing; `doctor` checks `az` and its azure-devops extension read-only. Nothing runs `gh` or `az`, adds a remote or stores a token.
- Added: Definition of Ready and Definition of Done checks: a pull request carries an Increment document (`docs/increments/<slug>.md`, created with `npm run increment:new`) that `npm run dor` checks before implementation and `npm run dod` checks against the implemented diff, with rules, severities and exemptions in `configs/delivery/`. The read-only "Definition of Ready" and "Definition of Done" workflows report a refinement brief or the generated Completion record, changelog entries and docs index rows, which `npm run dod -- --write` applies locally.
- Added: Increment documents in the Definition of Ready and Done: PullRequest documents (`docs/pull-requests/`, kind kickoff or change) and Issue documents (`docs/issues/`) are checked with their links to the Increment; the Definition of Done is chosen by the pull request: a change pull request into the increment branch (`increment/<id>`) completes its PullRequest document (tasks, delivered criteria, its own Completion record), the kick-off into `main` completes the Increment once every other pull request and issue is closed. Each acceptance criterion gets a generated pending test stub (`npm run dor -- --write` or `node scripts/delivery/acceptance.mjs stubs`) that the Definition of Ready requires and the Definition of Done requires implemented; `node scripts/delivery/increment.mjs new --kickoff` also writes the kick-off PullRequest document.
- Changed: This changelog now follows Keep a Changelog 1.1.0, and release candidates carry only the released version's section as release notes.

## Risks and rollback

The pipeline changes which checks block a merge: a misconfigured gate could block every
pull request or let one through. Each workflow is a separate file, so reverting one file
restores the previous behaviour; the Definition of Ready and Done rules can be switched
to warnings or disabled in `configs/delivery/` without a code change. The release
automation has run only against fakes; the first real cut follows the release how-to
and stops at the environment approval.

## Dependencies

Branch protection must require "Dev checks", "CI result", "Definition of Ready" and
"Definition of Done", and the `release` environment needs its reviewers before the first
Release cut dispatch. The [[DELIVERY-PIPELINE]] explanation records both.

## Open questions

None.

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/claude/exciting-brown-c6ipwt` (merge base `02c377d9f63c`)
- Changed files: 517 (142 added, 237 modified, 137 renamed, 1 deleted)
- E2E decision: optional; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `docs/_archive/**` | 140 |
| `docs/README.md` | 1 |
| `docs/development/**` | 66 |
| `docs/increments/**` | 1 |
| `docs/architecture/**` | 5 |
| `docs/concepts/**` | 7 |
| `docs/design/**` | 1 |
| `docs/memory/**` | 2 |
| `docs/prds/**` | 3 |
| `docs/product/**` | 11 |
| `docs/project-setup/**` | 1 |
| `docs/research/**` | 1 |
| `docs/security/**` | 1 |
| `docs/tasks/**` | 17 |
| `docs/testing/**` | 8 |
| `docs/tooling/**` | 2 |
| `docs/user-manual/**` | 5 |
| `*.md` | 8 |
| `.gitattributes` | 1 |
| `.github/workflows/**` | 20 |
| `.github/PULL_REQUEST_TEMPLATE/release.md` | 1 |
| `.github/CODEOWNERS` | 1 |
| `.github/pull_request_template.md` | 1 |
| `.claude/skills/**` | 26 |
| `.agents/skills/**` | 9 |
| `bin/**` | 52 |
| `configs/delivery/**` | 5 |
| `configs/quality/fallow.json` | 1 |
| `scripts/release/**` | 9 |
| `scripts/delivery/**` | 23 |
| `scripts/quality/**` | 5 |
| `scripts/setup/**` | 5 |
| `scripts/setup.mjs` | 1 |
| `scripts/companion/**` | 5 |
| `scripts/compiler/**` | 3 |
| `scripts/examples/**` | 1 |
| `scripts/help.mjs` | 1 |
| `scripts/testing/suite-manifest.mjs` | 1 |
| `scripts/testing/evidence-identity.mjs` | 1 |
| `scripts/README.md` | 1 |
| `templates/companion/devkit/**` | 6 |
| `tests/**` | 56 |
| `package.json` | 1 |
| Outside the affected areas | 0 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `docs/README.md`, `docs/_archive/README.md`, `tests/tooling/project-generator-framework-scope.checks.mjs` |
| AC-2 | yes | `tests/tooling/interactive-maker-ci-workflow-model.checks.mjs`, `.github/workflows/release.yml` |
| AC-3 | yes | `scripts/quality/workflow-policy.mjs`, `tests/tooling/repository.checks.mjs` |
| AC-4 | yes | `tests/tooling/release-cut.checks.mjs`, `tests/tooling/release-publish.checks.mjs`, `tests/tooling/release-publish-refusals.checks.mjs` |
| AC-5 | yes | `tests/tooling/release-changelog.checks.mjs`, `tests/tooling/release-branch.checks.mjs` |
| AC-6 | yes | `tests/tooling/agent-ideation-skills.checks.mjs`, `tests/tooling/agent-delivery-skills.checks.mjs` |
| AC-7 | yes | `tests/tooling/framework-hosting-command.checks.mjs`, `tests/tooling/framework-hosting-flags.checks.mjs`, `tests/tooling/project-generator-hosting.checks.mjs`, `tests/tooling/setup-hosting.checks.mjs` |
| AC-8 | yes | `tests/tooling/delivery-ready.checks.mjs`, `tests/tooling/delivery-handoff.checks.mjs`, `configs/delivery/definition-of-ready.json` |
| AC-9 | yes | `tests/tooling/delivery-done.checks.mjs`, `tests/tooling/delivery-cli.checks.mjs`, `.github/workflows/definition-of-done.yml` |
| AC-10 | yes | `tests/tooling/interactive-maker-compiler-emitters-kit.checks.mjs`, `tests/tooling/starter-distribution.checks.mjs` |
| AC-11 | yes | `tests/tooling/delivery-documents.checks.mjs`, `tests/tooling/delivery-acceptance.checks.mjs`, `configs/delivery/delivery.json` |

### Gates

From `node bin/app check --plan`:

| Gate | Command | Required |
| --- | --- | --- |
| check | `node bin/app check --fast --base origin/claude/exciting-brown-c6ipwt` | yes |
| suite:maker | `node scripts/testing/suites.mjs maker` | yes |
| suite:airship | `node scripts/testing/suites.mjs airship` | yes |
| suite:compiler | `node scripts/testing/suites.mjs compiler` | yes |
| suite:companion:mvp | `node scripts/testing/suites.mjs companion:mvp` | no |
| suite:runtime | `node scripts/testing/suites.mjs runtime` | yes |
| suite:cli | `node scripts/testing/suites.mjs cli` | yes |
| suite:generator | `node scripts/testing/suites.mjs generator` | yes |
| suite:visual | `node scripts/testing/suites.mjs visual` | no |
| suite:companion | `node scripts/testing/suites.mjs companion` | yes |
| suite:companion:schema | `node scripts/testing/suites.mjs companion:schema` | no |
| suite:companion:assembly | `node scripts/testing/suites.mjs companion:assembly` | no |
| suite:companion:browser | `node scripts/testing/suites.mjs companion:browser` | no |
| suite:companion:visual-browser | `node scripts/testing/suites.mjs companion:visual-browser` | no |
| suite:companion:starter-browser | `node scripts/testing/suites.mjs companion:starter-browser` | no |
| suite:test-data | `node scripts/testing/suites.mjs test-data` | no |
| suite:makers | `node scripts/testing/suites.mjs makers` | yes |
| suite:memory | `node scripts/testing/suites.mjs memory` | no |
| suite:memory:python | `node scripts/testing/suites.mjs memory:python` | no |
| suite:setup | `node scripts/testing/suites.mjs setup` | yes |
| suite:release | `node scripts/testing/suites.mjs release` | yes |
| suite:quality | `node scripts/testing/suites.mjs quality` | yes |
| verify | `npm run verify` | yes |
