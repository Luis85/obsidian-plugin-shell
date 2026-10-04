# GitHub Actions workflows

> Type: reference · Part of the [docs index](../README.md)

Every workflow under `.github/workflows/`, the tier it belongs to, what starts it,
its jobs, permissions and retained artifacts. The YAML files are the source of
truth; this page was derived from them. Why the tiers exist and how they hand off
is explained in [Delivery pipeline](DELIVERY-PIPELINE.md); the task guides are
[Deliver a change](DELIVER-A-CHANGE.md) and
[Cut and publish a release](CUT-AND-PUBLISH-A-RELEASE.md).

## Tiers at a glance

| Tier | Starts on | Workflows | Check that gates it |
| --- | --- | --- | --- |
| Dev | every `pull_request` event (`opened`, `synchronize`, `reopened`, `ready_for_review`), drafts included | `dev.yml` | **Dev checks** (required) |
| Integration | the same events on a non-draft pull request whose head is not `release/*`; pushes to `main` for `ci.yml` and the push-triggered workflows | `ci.yml` and every other pull-request workflow | **CI result** (required); the other workflows report their own job checks |
| Release | push to `release/**`, or manual dispatch on a release branch | `release.yml`, which calls every pull-request workflow with `tier: release` plus `candidate-qualification.yml` | **Release result** (Publish requires it; not a branch-protection check) |
| Publish | manual dispatch from `main` only, behind the `release` environment | `release-cut.yml`, `publish.yml` | environment reviewers' approval |
| Scheduled / manual | `schedule` or `workflow_dispatch` | `maintenance-status.yml`, `offline-qualification-inputs.yml`, `release-rehearsal.yml` | none (they gate nothing) |

## Workflow table

Top-level permissions are `contents: read` in every file. "Gate condition" is the
job-level `if:` that implements the Integration tier:
`inputs.tier == 'release' || (github.event.pull_request.draft != true && !startsWith(github.head_ref, 'release/'))`,
abbreviated **ready-gate** below. Retention is the `retention-days` of each
`actions/upload-artifact` step.

| File (name) | Tier | Triggers | Jobs (gate) | Artifacts (days) |
| --- | --- | --- | --- | --- |
| `dev.yml` (Dev) | Dev | `pull_request` | `fast` "Dev checks", ubuntu-24.04, 20 min, no gate | none |
| `ci.yml` (CI) | Integration | `pull_request`, push `main`, `workflow_call` (`tier`), `workflow_dispatch` (`tier`) | `baseline` (ubuntu-24.04, windows-latest), `showcase` (pull request: windows-latest; otherwise ubuntu-24.04 + windows-latest), `renamed-feature`, `source-archive`, `example-removal`: ready-gate. `framework-cli` (Linux; all three OSes for `tier: release`), `real-obsidian`, `generated-companion`, `starter` (3 groups): ready-gate and not on push. `self-review`, `security-audit` (continue-on-error, informational): pull requests only, not draft, not `release/*`. `ci-result` "CI result": `always()`, `checks: read`; on a `release/*` head green only after "Release result" succeeded on that commit | `baseline-<os>-<attempt>`, `showcase-<os>-<attempt>`, `renamed-template-authoring`, `template-authoring-source-archive`, `template-authoring-example-removal`, `framework-cli-<os>`, `real-obsidian-evidence`, `project-generator-evidence`, `starters-<group>-evidence` (7); `ui-review-gallery`, `security-audit` (14) |
| `airship-compatibility.yml` | Integration | `pull_request`, `workflow_call`, `workflow_dispatch` (`tier`) | `contracts`: ready-gate; Linux, all three OSes for `tier: release` | `airship-compatibility-<os>` (7) |
| `angular-setup-acceptance.yml` | Integration | `pull_request`, `workflow_call`, `workflow_dispatch` (`tier`) | `generated-app`: ready-gate; Linux, all three OSes for `tier: release` | `angular-setup-acceptance-<os>` (7) |
| `application-docs.yml` (Typed Markdown documentation) | Integration | `pull_request` (20 path filters), `workflow_call`, `workflow_dispatch` (`tier`) | `qualify` (ubuntu-24.04, windows-latest), `site` "Command handbook site" (needs `qualify`): ready-gate | `shell-cli-manual-markdown-<os>`, `application-docs-qualification-<os>` (7); `shell-cli-manual-site` (14) |
| `companion-concept-verification.yml` | Integration | `pull_request` and push `main` (34 path filters), `workflow_call`, `workflow_dispatch` (`tier`) | `source`, `browser`, `journey-editor`, `journey-native`, `jev-typescript6`: ready-gate | `companion-review-source`, `companion-browser-evidence`, `companion-mvp-authoring`, `generated-journey-native-evidence`, `jev-typescript6-evidence` (7) |
| `compiler-qualification.yml` | Integration | `pull_request`, `workflow_call`, `workflow_dispatch` (`tier`) | `contracts`: ready-gate; Linux, all three OSes for `tier: release` | `compiler-qualification-<os>` (7) |
| `hindsight-tooling.yml` (Optional memory tooling contracts) | Integration | `pull_request` and push `main` (13 path filters), `workflow_call`, `workflow_dispatch` (`tier`) | `contracts`: ready-gate; Linux, all three OSes for `tier: release` | none |
| `interactive-maker.yml` | Integration | `pull_request`, `workflow_call`, `workflow_dispatch` (`tier`) | `maker`: ready-gate; Linux, all three OSes for `tier: release` | `maker-qualification-<os>` (7) |
| `native-integration-verification.yml` | Integration | `pull_request` (11 path filters), `workflow_call`, `workflow_dispatch` (`tier`) | `contracts-and-adapters`, `generated-starters` (2 starters): ready-gate | `native-starter-<starter>` (7) |
| `optional-storybook.yml` | Integration | `pull_request` (12 path filters), `workflow_call`, `workflow_dispatch` (`tier`) | `optional-workspace`: ready-gate | `optional-storybook-evidence` (7) |
| `project-starter-qualification.yml` | Integration | `pull_request`, `workflow_call`, `workflow_dispatch` (`tier`) | `generated-project` (4 groups), `project-handoff`: ready-gate | `project-starters-<group>`, `project-handoff-<starter>` (7) |
| `setup-compatibility.yml` (Setup npm policy compatibility) | Integration | `pull_request` and push `main` (12 path filters), `workflow_call`, `workflow_dispatch` (`tier`) | `setup`: four legs (Node 24.15.0/npm 12.0.2 and Node 24.21.0/npm 11.19.1 on ubuntu-24.04 and windows-latest), ready-gate | `setup-policy-<os>-npm-<npm>` (7) |
| `starter-distribution.yml` (Independent Workbench distributions) | Integration | `pull_request` (21 path filters), `workflow_call`, `workflow_dispatch` (`tier`) | `package`: ready-gate | `companion-starter-evidence-<sha>`, `workbench-distributions-<source>` (14) |
| `candidate-qualification.yml` | Integration (post-merge) and Release | push `main` (all paths except narrative docs), `workflow_call`, `workflow_dispatch` | `candidate`: fixed-source rehearsal, repeated runtime suites, coverage, served browser, three native sessions, blocking live audit; no gate | `candidate-recovery-source`, `retained-build`, `qualified-candidate` (7) |
| `release.yml` (Release) | Release | push `release/**`, `workflow_dispatch` | `metadata` "Release metadata"; 14 reusable calls (below); `release-result` "Release result"; aliases `dev-checks` "Dev checks" and `ci-result` "CI result" | the called workflows' artifacts, in this run |
| `release-cut.yml` (Release cut) | Publish | `workflow_dispatch` (`version`) | `cut` "Cut release branch", `environment: release` | `release-cut-<version>-<attempt>` (30) |
| `publish.yml` (Publish) | Publish | `workflow_dispatch` (`version`) | `publish` "Publish release", `environment: release` | `publish-<version>-<attempt>` (30) |
| `release-rehearsal.yml` | manual | `workflow_dispatch` (`source_commit`, `version`, `draft_snapshot`) | `rehearsal` | `release-rehearsal-<version>-<sha>`, `release-qualification-<version>-<sha>` (repository default) |
| `maintenance-status.yml` | scheduled | `schedule` (Mondays 07:17 UTC), `workflow_dispatch` | `discover` | `maintenance-status` (14) |
| `offline-qualification-inputs.yml` | scheduled | `schedule` (Mondays 06:41 UTC), `workflow_dispatch` | `inputs`, `angular-inputs` | `linux-qualification-inputs`, `angular-offline-inputs` (3) |

Concurrency: each workflow uses its own group keyed by `github.ref` (Release uses
`release-tier-<ref>`, distinct from every called workflow, because a shared group
between caller and callee would deadlock) and cancels a superseded run, except
`release-cut`, `publish`, `maintenance-status` and `release-rehearsal`, which never
cancel, and `starter-distribution`, which cancels only on pull requests.

## Release tier calls

`release.yml` runs `metadata`, then calls each of these with `tier: release` and no
secrets: `ci`, `airship-compatibility`, `angular-setup-acceptance`,
`application-docs`, `companion-concept-verification`, `compiler-qualification`,
`hindsight-tooling`, `interactive-maker`, `native-integration-verification`,
`optional-storybook`, `project-starter-qualification`, `setup-compatibility`,
`starter-distribution`, plus `candidate-qualification` (no input). A called
workflow ignores its path filters, so every job runs. In `ci.yml` the push-skipped
jobs run, and `self-review` and `security-audit` skip (they are pull-request only;
candidate qualification runs the blocking live audit).

| Job | Does | Passes when |
| --- | --- | --- |
| `metadata` "Release metadata" | Derives `X.Y.Z` from the branch name, runs `node scripts/release/branch.mjs verify --version X.Y.Z`, prints the changelog section to the run summary. | The branch is `release/X.Y.Z` with a stable version and every verify check passes. |
| `release-result` "Release result" | Aggregates `metadata` and all 14 calls. | Every needed job is `success`; unlike "CI result", a skipped job fails it. |
| `dev-checks` "Dev checks", `ci-result` "CI result" | Report the required checks on the release head. | "Release result" succeeded. |

## Required checks

| Check | Produced by | Where it is required |
| --- | --- | --- |
| Dev checks | `dev.yml` › `fast`; on a release head also `release.yml` › `dev-checks` | Branch protection on `main` |
| CI result | `ci.yml` › `ci-result`; on a release head also `release.yml` › `ci-result` | Branch protection on `main` |
| Release result | `release.yml` › `release-result` | `scripts/release/publish.mjs` refuses without a green one on the release head |

"CI result" passes when each gate job succeeded or was skipped by its own
condition, so it is green on a draft. On a `release/*` pull request it fails on
purpose until the Release alias reports (see
[Delivery pipeline](DELIVERY-PIPELINE.md#release-pull-requests-and-the-alias-checks)).
The informational `security-audit` job is not part of it.

## Inputs

| Input | Workflows | Values | Effect |
| --- | --- | --- | --- |
| `tier` (`workflow_call`) | every pull-request workflow | string, default `integration` | `release` bypasses the ready-gate and runs every matrix leg. |
| `tier` (`workflow_dispatch`) | the same | choice `integration` or `release`, default `integration` | A manual run of one workflow at either tier. |
| `version` | `release-cut.yml`, `publish.yml` | `X.Y.Z` (checked against `^[0-9]+\.[0-9]+\.[0-9]+$`) | The release to cut or publish; both also require the dispatch ref to be `main`. |
| `source_commit`, `version`, `draft_snapshot` | `release-rehearsal.yml` | full SHA, stable version, optional JSON | See [release rehearsal](RELEASE-REHEARSAL.md). |

## Permissions, secrets and environments

| Job | Job permissions | Environment | Token |
| --- | --- | --- | --- |
| `release-cut.yml` › `cut` | `contents: write`, `pull-requests: write`, `actions: write` | `release` | `GH_TOKEN: secrets.RELEASE_TOKEN \|\| github.token` |
| `publish.yml` › `publish` | `contents: write`, `pull-requests: write`, `actions: read`, `checks: read` | `release` | `GH_TOKEN: secrets.RELEASE_TOKEN \|\| github.token` |
| every other job | inherits read-only `contents: read` | none | none; reusable calls pass no secrets |

`RELEASE_TOKEN` is optional (a fine-grained token or GitHub App token with
contents, pull requests and actions write on this repository). No other secret is
referenced. Every checkout sets `persist-credentials: false`.

## Repository policy (`npm run check:repository`)

`scripts/quality/check-repository.mjs` with the scoped allowances in
`scripts/quality/workflow-policy.mjs`; negative fixtures are in
`tests/tooling/repository.checks.mjs`.

| Rule | Failure code |
| --- | --- |
| YAML parses with unique keys; a workflow has `name`, `on` and a `jobs` mapping with at least one job | `WORKFLOW_YAML_INVALID`, `WORKFLOW_SHAPE_INVALID`, `WORKFLOW_NO_JOBS` |
| Top-level `permissions` only `read` or `none` | `WORKFLOW_PERMISSIONS_NOT_READ_ONLY` |
| No `pull_request_target` trigger | `PRIVILEGED_PR_TRIGGER_FORBIDDEN` |
| Each job has `runs-on` and steps, each step exactly one of `uses` or `run` | `WORKFLOW_JOB_INVALID`, `WORKFLOW_STEP_INVALID` |
| External actions pinned to a full commit SHA | `WORKFLOW_ACTION_NOT_PINNED` |
| `actions/checkout` with `persist-credentials: false` | `WORKFLOW_PERSISTED_CREDENTIALS` |
| No `${{ github.event.pull_request\|issue\|comment.* }}` or `${{ inputs.* }}` inside `run:` text (pass them through `env:`) | `WORKFLOW_UNTRUSTED_SHELL_INTERPOLATION` |
| `./.github/actions/<name>` must exist and be a composite action with pinned uses, explicit shells and no input interpolation | `WORKFLOW_LOCAL_ACTION_MISSING`, `ACTION_NOT_COMPOSITE`, `ACTION_STEP_INVALID`, `ACTION_LAYOUT_INVALID` |
| A job-level `uses: ./.github/workflows/<file>.yml` must exist and declare `on.workflow_call` | `WORKFLOW_LOCAL_WORKFLOW_MISSING`, `WORKFLOW_LOCAL_WORKFLOW_NOT_CALLABLE` |
| A reusable call passes no `secrets` | `WORKFLOW_CALL_SECRETS_FORBIDDEN` |
| Job-level write scopes only in `release-cut.yml` and `publish.yml`; anywhere else they fail as not read-only | `WORKFLOW_PERMISSIONS_NOT_READ_ONLY` |
| Those two files: `workflow_dispatch` is the only trigger | `PRIVILEGED_WORKFLOW_TRIGGER_FORBIDDEN` |
| Those two files: every job with a write scope declares `environment: release` | `PRIVILEGED_JOB_WITHOUT_ENVIRONMENT` |
| Those two files call no reusable workflow | `PRIVILEGED_WORKFLOW_CALL_FORBIDDEN` |

The same command checks owned CSS and the local links of `README.md`, `AGENTS.md`
and `CHANGELOG.md`, then runs the retired-launcher scan (`check:docs-launchers`).
It is a focused policy, not the GitHub Actions schema or actionlint.

## Reproduce a job locally

`node bin/app ci` reads the same YAML and never contacts GitHub.

| Command | Result |
| --- | --- |
| `node bin/app ci --list` | Every workflow and job with triggers, path filters, runner/matrix and whether it is reproducible. |
| `node bin/app ci --job <file-stem>/<job-id>` | Dry run: the job's ordered shell commands, with unresolved `${{ }}` expressions flagged. |
| `node bin/app ci --job ci/baseline --matrix os=ubuntu-24.04` | Selects one matrix combination; a computed matrix (`fromJSON(...)`) needs `--matrix`. |
| `node bin/app ci --job <file-stem>/<job-id> --execute` | Runs the `run:` steps through bash, stopping at the first failure (asks for approval in `.claude/settings.json`). |

- **Dry run** (default) prints each step in order with its shell, `working-directory`, the job/workflow/step `env`
  and the `run:` text. `${{ matrix.* }}` and `${{ runner.os }}` are resolved (the runner is this machine); any other
  `${{ }}` expression stays verbatim and is flagged as unresolved. `if:` conditions are settled three-valued:
  a condition that is false here (`runner.os == 'Windows'` on Linux) is skipped, one that cannot be decided locally
  (`github.event_name`, `inputs.*`, `steps.*` outputs in a condition) is shown as unknown and not run.
- **Matrix:** without `--matrix` the first combination that targets this machine is used and the note says how many
  exist. `--matrix key=value,...` selects one combination by exact values (`group=1`); no match or more than one
  match is an error that lists the available combinations.
- **Reproducible** means every step is a `run:` step or a known setup action (`actions/checkout`,
  `actions/setup-node`, `actions/cache`, `actions/upload-artifact`: nothing to run locally). A local composite
  action such as `./.github/actions/setup-qualified` is expanded into its own steps. Any other `uses:` step is
  marked `external`, skipped and noted. Jobs behind `environment: release` (cut, publish) are never reproducible.
- **`--execute`** runs the `run:` steps sequentially through bash (default `bash -e`, explicit `shell: bash` adds
  `pipefail`; `pwsh` only when installed), in the project root with the job's literal env, `CI=true`, a scratch
  `RUNNER_TEMP` and emulated `GITHUB_ENV`, `GITHUB_OUTPUT`, `GITHUB_PATH` and `GITHUB_STEP_SUMMARY` files. It stops at
  the first failure and reports every step in the same versioned result shape as `check --json`; steps after a
  failure are `not-run`. `--timeout` applies per step (default 600000 ms).
- **Refused, with the reason printed** (`status: blocked`, `CI_EXECUTE_REFUSED`; nothing runs): `secrets.` or
  `github.token` references, publication or tagging commands (`npm publish`, `git push`, `git tag <name>`,
  `gh release|api`, `docker push`, guarded `release operate`/`--authorize`), jobs named release/publish/deploy or
  using an `environment`, container or service jobs, a runner OS other than this machine, unresolved expressions
  other than step outputs and `runner.temp`, and a missing shell. The dry run of `dev/fast` reports
  this for `github.base_ref` (run its commands by hand, see [Deliver a change](DELIVER-A-CHANGE.md)); `ci --list`
  marks `release-cut/cut`, `publish/publish`, `release/metadata`, the reusable calls and `release/release-result`
  as refused. The dry run is always available.

A dry run also notes steps that run `npm ci` or `npm install` in the project folder, because `--execute` would
replace this checkout's `node_modules`; reproduce those jobs in a scratch copy. A local run is a reproduction aid,
not proof of CI: hosted-runner images, `needs:` results, uploaded artifacts, `github.*` event data, caches and
external actions are not reproduced. Jobs that need a Windows or macOS runner can only be inspected here.
