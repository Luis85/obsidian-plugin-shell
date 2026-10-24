---
type: Increment
id: obsidian-workflows-adoption
title: "Adopt the Obsidian community workflows for generated plugins"
owner: "Claude"
size: M
status: In progress
e2e: none
refs: []
pullRequests: [obsidian-workflows-adoption-kickoff, obsidian-workflows-adoption-1, obsidian-workflows-adoption-2]
branch: "increment/obsidian-workflows-adoption"
base: main
---

# Adopt the Obsidian community workflows for generated plugins

<!-- Developer handoff for one pull request. `npm run dor` checks it before implementation,
`npm run dod` after it. Replace every <placeholder>; delete these comments when done. -->

## Summary

Generated Obsidian plugin projects adopt the official `obsidianmd/obsidian-workflows` action (v1.2.3, pinned to commit `8167caed39664214d82c86fdfa32e06d8d55f61d`): an advisory community-directory validation step in the generated `ci.yml`, followed by a manually dispatched `obsidian-release.yml` that validates a tag with the community scanner rules, attests `main.js` and `styles.css` and creates a draft GitHub release. GitHub hosting only; the shell's own pipeline is unchanged.

## Outcome

A plugin author who creates a project with `node bin/app new` (GitHub hosting) sees on every pull request the same manifest, versions, README, license, build-artifact and lint findings the Obsidian community directory reports, as warnings that do not fail CI. When ready to publish, they push an `X.Y.Z` tag, run "Obsidian release" on that tag, approve the `release` environment and get a draft release with attested `main.js`, `manifest.json` and `styles.css` to review and publish.

## Scope

### In scope

- Delivered in two stacked change pull requests: first the validation step, then the release workflow and its policy change.
- `templates/companion/devkit/workflow-ci.yml.tmpl`: an advisory step in the `check` job that runs the action in `pr` mode with `strict: false` and `build: 'false'`, after `verify:artifacts` has built `dist/`.
- `templates/companion/devkit/workflow-obsidian-release.yml.tmpl` (new), emitted as `.github/workflows/obsidian-release.yml`: `workflow_dispatch` only, runs only on a tag ref, installs with the pinned npm, builds, copies `dist/main.js` and `dist/styles.css` to the project root (the action reads release assets from the root and runs its build command without a shell) and runs the action in `release` mode with `build: 'false'`.
- The hosting table emits `obsidian-release.yml` for `github` only.
- `tooling/quality/workflow-policy.mjs`: `obsidian-release.yml` joins the privileged workflows, under the unchanged rules (dispatch-only, every write job behind the `release` environment, no reusable workflow calls).
- Tests for the generated files, the hosting matrix and the policy, and the docs and changelog entries.

### Out of scope

- The shell's own `.github/workflows` and its release-cut and publish pipeline.
- The standalone projects under `projects/` and already generated projects; they adopt the workflows by regenerating or copying them.
- An Azure DevOps or `none`-hosting equivalent; the action is GitHub-only.
- Making the validation strict, removing the existing `check:submission` step, and the reusable `release.yml@v1` workflow (it pulls unpinned actions).
- Creating tags, bumping versions, publishing the draft release and submitting to `obsidian-releases`.
- Creating or protecting the `release` environment in a generated repository (owner setting, documented).

## Acceptance criteria

<!-- One `- [ ] AC-n: text` per criterion. At completion tick it and add
`Evidence: \`path\`` (a test file, doc or report that exists). -->

- [x] AC-1: A project generated with `github` hosting has, in the `check` job of `.github/workflows/ci.yml`, a step using `obsidianmd/obsidian-workflows@8167caed39664214d82c86fdfa32e06d8d55f61d` with `mode: pr`, `strict: 'false'`, `build: 'false'` and `continue-on-error: true`, placed after `verify:artifacts`; the workflow passes `inspectWorkflow` and keeps top-level `contents: read`.
  Evidence: `tests/acceptance/obsidian-workflows-adoption/ac-1.checks.mjs`
- [x] AC-2: A project generated with `github` hosting has `.github/workflows/obsidian-release.yml`, triggered only by `workflow_dispatch`, whose job is skipped unless `github.ref` starts with `refs/tags/`, grants only `contents`, `id-token` and `attestations` write behind `environment: release`, copies `dist/main.js` and `dist/styles.css` to the root before running the pinned action with `mode: release` and `build: 'false'`, and passes `inspectWorkflow`.
  Evidence: `tests/acceptance/obsidian-workflows-adoption/ac-2.checks.mjs`
- [x] AC-3: The workflow policy accepts write scopes in `obsidian-release.yml` only under the existing privileged rules; a fixture with a `push` trigger, one without the `release` environment and one with a reusable workflow call each fail with their existing policy codes.
  Evidence: `tests/acceptance/obsidian-workflows-adoption/ac-3.checks.mjs`
- [x] AC-4: Projects generated with `azure-devops` or `none` hosting contain neither `.github/workflows/obsidian-release.yml` nor the action reference, and switching an existing project to `github` with `node bin/app hosting set github` plans `obsidian-release.yml` without overwriting an existing file.
  Evidence: `tests/acceptance/obsidian-workflows-adoption/ac-4.checks.mjs`
- [x] AC-5: `docs/development/WORKFLOWS.md`, `docs/development/HOSTING-PLATFORMS.md` and `docs/development/COMPANION-GENERATOR.md` describe the validation step as advisory, the release workflow's tag-and-dispatch steps, the `release` environment prerequisite and that the result is a draft release the author publishes.
  Evidence: `tests/acceptance/obsidian-workflows-adoption/ac-5.checks.mjs`

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

- `templates/companion/devkit/workflow-ci.yml.tmpl`: the advisory validation step.
- `templates/companion/devkit/workflow-obsidian-release.yml.tmpl`: the new release workflow template.
- `src/shared/companion/schema/hosting.mjs`: `obsidian-release.yml` in the `github` CI files.
- `src/cli/compiler/emitters/devkit-files.ts`: the template-to-path mapping, if the hosting table does not cover it.
- `tooling/quality/workflow-policy.mjs`: the privileged-workflow allowlist.
- `tooling/tests/repository.checks.mjs`: policy fixtures for the new privileged workflow.
- `tooling/tests/project-generator-devkit.checks.mjs`: the generated workflow set.
- `tooling/tests/project-generator-hosting.checks.mjs`: the hosting matrix.
- `src/shared/tests/companion-hosting-contract.checks.mjs`: the per-platform CI files.
- `src/cli/tests/interactive-maker-compiler-emitters-kit.checks.mjs`: the emitted devkit paths.
- `tests/fixtures/compiler/starter-golden.json`: the reviewed baseline, whose origins now list `obsidian-release.yml`.
- `src/cli/adapters/framework/hosting-plan.ts`: `hosting set` entries, if the hosting table does not cover it.
- `docs/development/WORKFLOWS.md`: generated-project workflows and the policy table.
- `docs/development/HOSTING-PLATFORMS.md`: the files per platform.
- `docs/development/COMPANION-GENERATOR.md`: the generated files.
- `CHANGELOG.md`: the Unreleased entry.
- `tests/acceptance/obsidian-workflows-adoption/`: the acceptance tests.
- `docs/increments/obsidian-workflows-adoption.md`: this handoff.
- `docs/pull-requests/`: the kick-off and change pull request records.

## Test plan

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- Suite `acceptance`: one acceptance test per criterion, generating real projects through the compiler and reading the emitted workflows.
- Suite `generator`: `project-generator-devkit` and `project-generator-hosting` checks with the new workflow set and hosting matrix.
- Suite `companion`: the hosting contract check with the new `github` CI file.
- Suite `quality`: `repository.checks.mjs` with the new negative fixtures that prove the policy failures.
- Gate `npm run check`: types, lint and tests before each pull request is marked ready.
- Gate `npm run check:repository`: the workflow policy over the shell's workflows after the allowlist change.
- Gate `node tooling/testing/suites.mjs --check`: every new test file has a suite and test-pyramid level.
- Gate `node src/cli/tooling/release/changelog.mjs check`: the Unreleased changelog entry.
- Gate `npm run check:self-review`: no findings on the diff.
- E2E: none; the change is workflow templates and policy, with no plugin runtime or UI change. The generated workflows are not executed on GitHub by these tests; the first real run happens in a generated repository.

## Docs impact

<!-- - `docs/path.md` (how-to): what changes   — or —   None — reason -->

- `docs/development/WORKFLOWS.md` (reference): the generated-project workflows, the advisory validation and the privileged `obsidian-release.yml` rules.
- `docs/development/HOSTING-PLATFORMS.md` (how-to): `obsidian-release.yml` among the `github` files.
- `docs/development/COMPANION-GENERATOR.md` (reference): how a generated project cuts a draft release with the Obsidian action.

## Changelog

<!-- - Added: text  (Added, Changed, Deprecated, Removed, Fixed or Security)  — or —  None — reason -->

- Added: Generated GitHub projects run the official Obsidian community-directory validation (advisory) on pull requests and get an "Obsidian release" workflow that creates an attested draft release from a tag.

## Risks and rollback

Risk: the action's PR-mode correctness checks (an unusable manifest, a missing license) fail as errors even when `strict` is false; the step is `continue-on-error`, so CI stays green while the summary shows them. Risk: allowlisting a third privileged workflow widens the policy; the rules that guard the existing two still apply and negative fixtures prove them. Risk: the pinned action changes behavior on update; Dependabot proposes SHA updates for review. Risk: a generated repository without a protected `release` environment lets anyone with dispatch rights start a release; the docs name the owner setting. Rollback: revert either change pull request; generated projects keep whatever files they already have.

## Dependencies

None in this repository. Generated repositories need a `release` environment (ideally with required reviewers) and Actions allowed to use `obsidianmd/obsidian-workflows`.

## Open questions

<!-- "None" when ready. Each open question blocks the Definition of Ready. -->

None

## Pull requests

<!-- wb:pull-requests generated by node bin/app; edits here are replaced -->
- [[docs/pull-requests/obsidian-workflows-adoption-kickoff|Kick-off: Adopt the Obsidian community workflows for generated plugins]] · New
- [[docs/pull-requests/obsidian-workflows-adoption-1|Advisory Obsidian community validation in generated CI]] · New
- [[docs/pull-requests/obsidian-workflows-adoption-2|Obsidian draft-release workflow for generated plugins]] · New
<!-- /wb:pull-requests -->
