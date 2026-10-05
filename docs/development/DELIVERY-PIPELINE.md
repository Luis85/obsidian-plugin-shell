# Delivery pipeline

> Type: explanation · Part of the [docs index](../README.md)

This page explains how a change travels from an idea to a published release in
this framework repository, and why the checks are arranged in tiers. The facts per
workflow are in [GitHub Actions workflows](WORKFLOWS.md); the tasks are
[Deliver a change](DELIVER-A-CHANGE.md) and
[Cut and publish a release](CUT-AND-PUBLISH-A-RELEASE.md). The release cut and
publish automation is implemented and tested against fakes; it has not yet been
exercised against GitHub.

## Why progressive tiers

The complete qualification of this repository takes hours of runner time: guided
setup and the complete `verify` on Windows, three template-authoring journeys,
generated companions and starters, real Obsidian sessions and cross-OS matrices.
Running all of it on every push of an early prototype would make the first
iterations slow and expensive, and would teach people to ignore red checks.
Running too little before a merge would let regressions reach `main`.

The pipeline therefore tightens as a change matures. A draft pull request gets
fast, diff-scoped feedback. Marking it ready for review is the explicit signal
that it should now meet the integration bar, so the heavy gates start then. A
release branch runs everything, on every matrix leg, whatever the path filters
say, and only a green release can be published. No threshold is lower in an early
tier: a tier selects which gates run, it never relaxes a gate that runs.

```text
 idea ──────────► prototype ──────────► production ──────────────► release
 ideation-* skills   draft PR              ready for review           release/X.Y.Z
 (local, no CI)      Dev tier              Integration tier           Release tier
 increment new       "Dev checks"          "CI result" + workflows    "Release result"
                     "Definition of Ready" "Definition of Done"
                                           merge green PR to main     Publish: merge → tag → release → delete
```

## The four tiers

| Tier | Trigger | What runs | Gate |
| --- | --- | --- | --- |
| Dev | Every pull-request event (`opened`, `synchronize`, `reopened`, `ready_for_review`), drafts included | `dev.yml` "Dev checks" on ubuntu-24.04 (about ten minutes): `node bin/app check --fast --skip-suites` against the base branch (typecheck, lint and eslint on changed files, related Vitest tests, the maker type-check), suite registration, repository policy, changelog structure and the self-review guard in `--warn-only` mode; `definition-of-ready.yml` checks the increment documents (seconds, no install) | "Dev checks" and "Definition of Ready", required by branch protection |
| Integration | The same events on a pull request that is not a draft and whose head is not `release/*`; pushes to `main` | `ci.yml` and every other pull-request workflow; three-OS matrices run their Linux leg only; `ci.yml` adds the blocking self-review guard and an informational live audit; end-to-end steps only when opted in ([below](#end-to-end-tests-opt-in-mandatory-in-release)); `definition-of-done.yml` checks the increment against the diff | "CI result" and "Definition of Done", required by branch protection, plus each workflow's own job checks |
| Release | Push to `release/**`, or a manual dispatch on that branch | `release.yml`: release metadata, every pull-request workflow called with `tier: release` (all matrix legs, path filters ignored, every end-to-end step), and `candidate-qualification.yml` (fixed-source rehearsal, served browser, three native sessions, the blocking live audit) | "Release result", which Publish requires |
| Publish | Manual dispatch from `main` by the owner, after the `release` environment's reviewers approve | `release-cut.yml` (cut the release branch) and `publish.yml` (merge, tag, release, delete) | Environment approval |

The `node --test` suites a diff selects are listed as skipped in the Dev tier, not
silently dropped: they take minutes each and run in the Integration tier through
`verify` and the path-filtered workflows.

## Increments: Definition of Ready before work, Definition of Done before merge

Tiers decide how much runs; they do not say whether the work itself is
understood or finished. That is what an **increment** records: a Markdown
document (`docs/increments/<id>.md`) with the outcome, scope, acceptance criteria,
affected areas, test plan, docs and changelog impact of one deliverable change.
Two deterministic, dependency-free checks read it on every pull request: the
**Definition of Ready** before implementation (drafts included, so refinement gets
feedback early) and the **Definition of Done** when the pull request is ready for
review. Both take seconds, need no install and fail with a hint per rule, so a red
result is a finding about the documents or the diff, never a flake.

The documents are the source of truth and live in the repository, next to the
code they describe; `node bin/app increment`, `pr` and `issue` edit them through
reviewed plans. One increment is delivered through a small stack of pull
requests:

```text
 main ◄──────────── kick-off pull request (increment/<id>) ◄──── change pull requests (pr/<id>/<id>-n)
       merged last:   carries the increment documents,          deliver the work, each with its own
       DoD = whole    refined until the DoR passes              PullRequest document; DoD = its tasks
       increment                                                and delivered criteria
```

The kick-off pull request is opened first, as a draft, so the increment can be
refined in review until the Definition of Ready passes. Change pull requests then
stack on the increment branch, so each sees the increment's latest state and its
diff shows only its own work. Their Definition of Done checks only what they
deliver; the kick-off's checks the whole increment, which is why it merges last.
Each acceptance criterion starts as a generated pending test stub, which makes
"is it tested?" a mechanical question. Publishing a planned pull request or
syncing it with the platform is an explicit, reviewed remote write; the
description on GitHub or Azure DevOps is a view of the documents in which only
tasks and amendments flow both ways. The rules are listed in
[Definition of Ready and Done](DEFINITION-OF-READY-AND-DONE.md); the walk-through
is [Your first increment](FIRST-INCREMENT.md).

## How the gating works

Every Integration workflow keeps its `pull_request` trigger with the four event
types (plus `labeled` where it holds end-to-end steps), so it starts on drafts too,
but each job carries the condition:

```yaml
if: inputs.tier == 'release' || (github.event.pull_request.draft != true && !startsWith(github.head_ref, 'release/'))
```

On a draft the jobs skip; "CI result" counts a job skipped by its own condition as
passing, so a draft shows green Integration checks with nothing run. A draft
cannot be merged, and marking it ready fires `ready_for_review`, which runs every
gate on the current head. On a push to `main` there is no pull request, so the
condition is true and the push-triggered jobs run as before, without their
end-to-end steps. `ci.yml` leaves out the jobs that would only requalify the tree
its pull request's merge-ref run already qualified (framework CLI, generators,
the three template-authoring journeys and the Ubuntu showcase leg); see
[Workflows](WORKFLOWS.md).

The same files declare `on.workflow_call` with a `tier` input (default
`integration`), and `workflow_dispatch` with a `tier` choice. `release.yml` calls
each of them with `tier: release`. That input bypasses the draft and release-head
condition and widens the matrices, for example
`fromJSON(inputs.tier == 'release' && '["ubuntu-24.04", "windows-latest", "macos-latest"]' || '["ubuntu-24.04"]')`.
A called workflow runs no path filter, so a release always runs the whole set.
Reusable calls receive no secrets and keep read-only permissions.

## End-to-end tests: opt-in, mandatory in Release

End-to-end tests drive a real browser or a real Obsidian host: the served UI in
Chromium (`npm run test:e2e`), the UI review gallery, the browser suites of the
companion, starters and generated outputs, the real-Obsidian suites and the
candidate's browser and native evidence (the
[classification](WORKFLOWS.md#end-to-end-opt-in) lists them). They are the
slowest and most host-sensitive checks, so, at the owner's request, they are
opt-in during development and mandatory in the Release tier. This changes when
they run, never what they assert.

| Where | End-to-end steps run | How to opt in |
| --- | --- | --- |
| Local loop and Dev tier | never by themselves: `node bin/app check` and `npm run verify` exclude them | `npm run test:e2e` (or the suite) with provisioned Chromium |
| Integration (ready pull request) | only when opted in | add the `e2e` label: the e2e jobs start at once, and every later push runs them while the label stays |
| Push to `main` | no | dispatch the workflow with the `e2e` input (or `tier: release`) |
| Release | always | nothing: `tier: release` makes every e2e step mandatory |

Every e2e step, or a job that holds only e2e work, carries the same signal:

```yaml
if: inputs.tier == 'release' || inputs.e2e == true || contains(github.event.pull_request.labels.*.name, 'e2e')
```

A job that also does non-e2e work keeps its setup, `verify`, generation and builds
unconditional and gates only its e2e steps; qualifiers that build and then smoke
a browser run with `--no-browser` (the cloud-session handoff with `--skip-e2e`)
when not opted in. Playwright browser installs and native-host provisioning
follow the same signal, so a run without the opt-in downloads no browser.

Adding the label fires a `labeled` event, which only the workflows holding e2e
steps listen to. On that event every job without e2e steps skips (and every job
skips when another label is added), so a label run never repeats the
Integration gates, and its concurrency group includes the label name, so it never
cancels the full run in progress. In `ci.yml` the label run's aggregator reports
as "E2E result", never as "CI result": a run with the gates skipped must never
become the latest required check on that head. "E2E result" is not a
branch-protection check; once the label is set, every later full run includes the
e2e steps in its "CI result". When a task handoff says `e2e: required`, the
`feature-delivery` skill adds the label before the pull request is marked ready.

`npm run check:repository` enforces this with `scripts/quality/e2e-policy.mjs`:
each e2e step must be false for a ready pull request, a push to `main` and a
dispatch without `e2e`, true for the `e2e` label or input, and true for
`tier: release`, evaluated with the same three-valued evaluator as
`node bin/app ci`, so an undecidable gate fails too. `release.yml` must call every
workflow that holds e2e work with an effective tier of release (Candidate
qualification is called without inputs, so its call tier defaults to release).
Negative fixtures are in `tests/tooling/qualification-e2e-opt-in.checks.mjs`.

## Release pull requests and the alias checks

The release pull request is the only pull request whose Integration jobs always
skip (its head is `release/*`): the Release tier qualifies that head instead.
Two consequences follow.

First, a skipped-everything `ci.yml` run would report a green "CI result" long
before the Release tier finished. So when `ci.yml` does run on a release pull
request (after a push by a person, or when `RELEASE_TOKEN` opened it), its
"CI result" looks up the "Release result" check on the same head commit (read-only
`checks: read`) and passes only when that check succeeded. Before the Release tier
finished it fails with "Release pull requests are gated by the Release workflow", so
a release pull request never shows an early green required check; a run after a
successful Release tier (for example when the pull request is marked ready) is green.

Second, a pull request opened with `GITHUB_TOKEN` starts no workflows at all, so
"Dev checks" and "CI result" would never report and the required checks would
block Publish's merge. `release.yml` therefore ends with two alias jobs named
exactly "Dev checks" and "CI result". They pass only when "Release result"
succeeded. The Release tier is a strict superset of both tiers (it runs `ci.yml`
in full plus every other workflow), so the aliases say nothing that was not
checked. Whichever "CI result" reports last on the head commit, it is green only
after "Release result" succeeded there.
Both aliases use `if: always()`, because a skipped required check would count as
passing.

## Tokens: GITHUB_TOKEN and the optional RELEASE_TOKEN

Pushes, pull requests and tags made with the built-in `GITHUB_TOKEN` start no
further workflow runs (only `workflow_dispatch` and `repository_dispatch` are
exempt). The pipeline is built to work with that token alone:

- Release cut pushes `release/X.Y.Z` and opens the draft release pull request, then
  dispatches `release.yml` on the branch itself (`actions: write`), because its
  push started nothing.
- The aliases above report the required checks on the release head.
- Publish's merge commit on `main` starts no push workflow, and the tag starts
  nothing; no workflow listens to tags.

The optional `RELEASE_TOKEN` secret (a fine-grained personal access token or a
GitHub App token with contents, pull requests and actions write on this repository)
replaces `GITHUB_TOKEN` in both jobs. With it the cut's push and pull request start
the normal push and pull-request workflows too, the merge commit runs `main`'s push
workflows, and it can merge when branch protection does not let `GITHUB_TOKEN`
merge. A fix-forward push by a person always starts the push and pull-request
workflows, whatever token opened the pull request.

## Approvals: the release environment

Both write jobs declare `environment: release`. With required reviewers configured
on that environment, each dispatch waits until a reviewer approves it, so cutting
and publishing need two deliberate human decisions: the dispatch and the approval.
The environment must exist with its reviewers before the first dispatch; GitHub
creates a missing environment on first use without any protection rule. The
workflows also refuse a dispatch from any ref other than `main` and a version that
is not `X.Y.Z`.

## The scoped write policy

Until this pipeline, every workflow was read-only and `npm run check:repository`
rejected any write scope. The owner-requested exception is narrow and checked in
code (`scripts/quality/workflow-policy.mjs`):

- only `release-cut.yml` and `publish.yml` may grant job-level write scopes;
- both must be `workflow_dispatch`-only, keep read-only top-level permissions and
  call no reusable workflow;
- every job with a write scope must target the `release` environment;
- every other workflow, including `starter-distribution.yml`, stays read-only, and
  reusable calls must target an existing callable workflow and pass no secrets.

Negative fixtures in `tests/tooling/repository.checks.mjs` prove each rule fails.
The full rule list is in [GitHub Actions workflows](WORKFLOWS.md#repository-policy-npm-run-checkrepository).

## Why publish merges before it tags

Publish runs five resumable steps on the tested release head commit: mark the
pull request ready, merge it into `main` with a merge commit pinned to that SHA,
create tag `X.Y.Z` at that SHA, create the GitHub release (draft, upload
`main.js`, `manifest.json` and `styles.css`, then publish), and delete the release
branch. The order matters:

- A tag or release must never point at a commit that is not on `main`. The
  existing release tooling enforces that invariant
  (`SOURCE_NOT_ON_DEFAULT_BRANCH`), and the Obsidian community directory reads the
  manifest from the default branch, so `main` must contain the released metadata
  before anyone can install the release.
- The merge commit keeps the tested release head as a parent, so the tag names the
  exact commit "Release result" qualified, not a new merge commit that no workflow
  tested.
- The branch is deleted last, and only while its head is still that SHA, so a
  failure earlier leaves everything needed to resume.

Each step reads remote state first and is skipped when already done. A failed
write is reported as uncertain (exit 2) rather than retried blindly: the operator
inspects the pull request, tag and release, then reruns the same command. Publish
never moves a tag, replaces an asset or edits a published release.

## Versions and tags

Versions are stable `X.Y.Z` only (no pre-release suffix) and must be newer than the
current version. Tags are the bare version, `1.2.3`, not `v1.2.3`: Obsidian matches
the release tag to the `version` in `manifest.json`. Release preparation bumps
`package.json`, the lockfile, `manifest.json` and `versions.json`, and promotes the
`## [Unreleased]` section of `CHANGELOG.md` (Keep a Changelog 1.1.0) into
`## [X.Y.Z] - YYYY-MM-DD`; that section becomes the release notes.

## What the pipeline does not change

The blocked release profile (`verify-baseline --profile release` and its
`releaseDecision`) stays blocked. It records the PRD's complete release gate,
which is not met; it is not a gate of this pipeline and a green "Release result"
does not unblock it. A published GitHub release is also not an Obsidian community
directory submission, which remains a separate owner decision
([maintenance and release](MAINTENANCE-AND-RELEASE.md#8-first-community-directory-submission)).
The manual and offline release tools ([rehearsal](RELEASE-REHEARSAL.md),
[operation plans](RELEASE-OPERATION-PLANS.md), [execution](RELEASE-EXECUTION.md))
remain available for retained-candidate work outside this path.

## From idea to release

| Stage | Where it happens | Tool | Checks |
| --- | --- | --- | --- |
| Idea | Local session | `ideation-journey`, `ideation-brainstorm`, `ideation-concept` skills | none in CI |
| Prototype | Local, then a draft pull request | `ideation-design`, `ideation-prototype`, `ideation-boilerplate` | Dev tier |
| Increment | `node bin/app increment new`, the kick-off draft pull request | `increment-handoff` | Dev tier, "Definition of Ready" |
| Production | Change pull requests on the increment branch, marked ready for review and merged; the kick-off merges into `main` last | `feature-delivery`, `self-review` | Integration tier, "Definition of Done" |
| Release | `release/X.Y.Z` branch and its draft release pull request | `release` skill, Release cut and Publish workflows | Release tier, then environment approval |

The skills live in `.claude/skills/` (chain overview:
`.claude/skills/ideation-journey/references/chain.md`). They never dispatch a
release workflow, merge or publish without the user's explicit request in the
conversation, and loading a skill authorizes nothing.
