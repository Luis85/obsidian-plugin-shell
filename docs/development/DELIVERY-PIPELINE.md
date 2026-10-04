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
                     "Dev checks"          "CI result" + workflows    "Release result"
                                           merge green PR to main     Publish: merge → tag → release → delete
```

## The four tiers

| Tier | Trigger | What runs | Gate |
| --- | --- | --- | --- |
| Dev | Every pull-request event (`opened`, `synchronize`, `reopened`, `ready_for_review`), drafts included | `dev.yml` "Dev checks" on ubuntu-24.04 (about ten minutes): `node bin/app check --fast --skip-suites` against the base branch (typecheck, lint and eslint on changed files, related Vitest tests, the maker type-check), suite registration, repository policy, changelog structure and the self-review guard in `--warn-only` mode | "Dev checks", required by branch protection |
| Integration | The same events on a pull request that is not a draft and whose head is not `release/*`; pushes to `main` | `ci.yml` and every other pull-request workflow; three-OS matrices run their Linux leg only; `ci.yml` adds the blocking self-review guard and an informational live audit | "CI result", required by branch protection, plus each workflow's own job checks |
| Release | Push to `release/**`, or a manual dispatch on that branch | `release.yml`: release metadata, every pull-request workflow called with `tier: release` (all matrix legs, path filters ignored), and `candidate-qualification.yml` (fixed-source rehearsal, served browser, three native sessions, the blocking live audit) | "Release result", which Publish requires |
| Publish | Manual dispatch from `main` by the owner, after the `release` environment's reviewers approve | `release-cut.yml` (cut the release branch) and `publish.yml` (merge, tag, release, delete) | Environment approval |

The `node --test` suites a diff selects are listed as skipped in the Dev tier, not
silently dropped: they take minutes each and run in the Integration tier through
`verify` and the path-filtered workflows.

## How the gating works

Every Integration workflow keeps its `pull_request` trigger with the four event
types, so it starts on drafts too, but each job carries the condition:

```yaml
if: inputs.tier == 'release' || (github.event.pull_request.draft != true && !startsWith(github.head_ref, 'release/'))
```

On a draft the jobs skip; "CI result" counts a job skipped by its own condition as
passing, so a draft shows green Integration checks with nothing run. A draft
cannot be merged, and marking it ready fires `ready_for_review`, which runs every
gate on the current head. On a push to `main` there is no pull request, so the
condition is true and the push-triggered jobs run as before.

The same files declare `on.workflow_call` with a `tier` input (default
`integration`), and `workflow_dispatch` with a `tier` choice. `release.yml` calls
each of them with `tier: release`. That input bypasses the draft and release-head
condition and widens the matrices, for example
`fromJSON(inputs.tier == 'release' && '["ubuntu-24.04", "windows-latest", "macos-latest"]' || '["ubuntu-24.04"]')`.
A called workflow runs no path filter, so a release always runs the whole set.
Reusable calls receive no secrets and keep read-only permissions.

## Release pull requests and the alias checks

The release pull request is the only pull request whose Integration jobs always
skip (its head is `release/*`): the Release tier qualifies that head instead.
Two consequences follow.

First, a skipped-everything `ci.yml` run would report a green "CI result" long
before the Release tier finished. So when `ci.yml` does run on a release pull
request (after a push by a person, or when `RELEASE_TOKEN` opened it), its
"CI result" fails on purpose with "Release pull requests are gated by the Release
workflow". It stays red until the Release workflow reports.

Second, a pull request opened with `GITHUB_TOKEN` starts no workflows at all, so
"Dev checks" and "CI result" would never report and the required checks would
block Publish's merge. `release.yml` therefore ends with two alias jobs named
exactly "Dev checks" and "CI result". They pass only when "Release result"
succeeded. The Release tier is a strict superset of both tiers (it runs `ci.yml`
in full plus every other workflow), so the aliases say nothing that was not
checked. The design relies on the alias, reported after the failing run on the
same head commit, being the latest check of that name, which unblocks the merge.
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
| Prototype | Local, then a draft pull request | `ideation-design`, `ideation-prototype`, `ideation-boilerplate`, then `feature-delivery` | Dev tier |
| Production | Pull request marked ready for review, merged into `main` | `feature-delivery`, `self-review` | Integration tier |
| Release | `release/X.Y.Z` branch and its draft release pull request | `release` skill, Release cut and Publish workflows | Release tier, then environment approval |

The skills live in `.claude/skills/` (chain overview:
`.claude/skills/ideation-journey/references/chain.md`). They never dispatch a
release workflow, merge or publish without the user's explicit request in the
conversation, and loading a skill authorizes nothing.
