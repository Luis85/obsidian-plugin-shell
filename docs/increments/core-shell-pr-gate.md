---
type: Increment
id: core-shell-pr-gate
title: "Pull requests run the core shell gate; generators run on their inputs and nightly"
owner: "Luis85"
size: M
status: Ready
e2e: none
refs: []
pullRequests: [core-shell-pr-gate-kickoff]
branch: "increment/core-shell-pr-gate"
base: main
---

# Pull requests run the core shell gate; generators run on their inputs and nightly

<!-- Developer handoff for one pull request. `npm run dor` checks it before implementation,
`npm run dod` after it. Replace every <placeholder>; delete these comments when done. -->

## Summary

Every ready pull request ran the full Integration breadth whatever it touched: the Windows complete verify (Showcase / windows-latest, about 80 minutes) and a dozen jobs that generate, install, build and test separate consumer projects (project starters, the generated companion, example removal, compiler, Airship, Angular setup, maker, project-starter and native-integration qualification). Owner decision: pull requests run the core shell gate; generator and starter qualification runs when its inputs change; the Windows complete verify and the full breadth run nightly on main and, unchanged, in the Release tier.

## Outcome

A pull request that does not touch the generator machinery finishes its Integration tier in about 30 minutes (the complete Ubuntu verify in Template authoring / renamed feature is the longest job) instead of about 80, while main is qualified at full breadth every night and every release keeps the full Release tier.

## Scope

### In scope

- `configs/quality/ci-scope.json`: the one list of generator inputs.
- `tooling/quality/ci-scope.mjs`: a dependency-free classifier of a pull request's changed files against that list (every other event counts as in scope).
- `.github/workflows/ci.yml`: a `scope` job gating example removal, the generated companion and the starters; "CI result" depends on it; Showcase no longer runs on pull requests or pushes.
- The six consumer-qualification workflows trigger on pull requests only for the generator inputs.
- `.github/workflows/nightly.yml`: a daily schedule (and dispatch) calling CI and every workflow the Release tier calls except Candidate qualification, with tier integration.
- Tests, the workflow and delivery documentation and the changelog.

### Out of scope

- The Release tier, Candidate qualification and every gate, threshold or suite content.
- The core pull-request jobs: Baseline, Framework CLI, Template authoring / renamed feature and source archive, self-review, the Definitions of Ready and Done and the already path-filtered workflows.
- Auto-merge, notifications for nightly failures and the e2e opt-in policy.

## Acceptance criteria

<!-- One `- [ ] AC-n: text` per criterion. At completion tick it and add
`Evidence: \`path\`` (a test file, doc or report that exists). -->

- [ ] AC-1: `node tooling/quality/ci-scope.mjs` reports `generators=false` for a pull request that changes only files outside `configs/quality/ci-scope.json`'s generator inputs, `generators=true` when one input changes and for every event other than `pull_request`, and in `ci.yml` the example-removal, generated-companion and starter jobs run only when the scope job says so (or the e2e label is present), while "CI result" depends on the scope job. Evidence: `tests/acceptance/core-shell-pr-gate/ac-1.checks.mjs`
- [ ] AC-2: The Airship, Angular setup, compiler, interactive maker, project starter and native integration workflows trigger on pull requests exactly for the generator inputs followed by `!projects/**`. Evidence: `tests/acceptance/core-shell-pr-gate/ac-2.checks.mjs`
- [ ] AC-3: Showcase (the Windows complete verify) runs on no pull request or push to main, but on dispatch, in the Release tier and in the nightly run; `nightly.yml` runs on a daily schedule and on dispatch and calls `ci.yml` and every workflow `release.yml` calls except Candidate qualification, with tier integration. Evidence: `tests/acceptance/core-shell-pr-gate/ac-3.checks.mjs`

## Affected areas

<!-- One backticked repository path or glob per line; new files must sit under an allowed root. -->

- `configs/quality/ci-scope.json`: the generator inputs.
- `tooling/quality/ci-scope.mjs`: the classifier.
- `tooling/tests/**`: the classifier and CI scope tests.
- `tests/suites.json`: the new test file's suite.
- `.github/workflows/**`: CI, the six consumer-qualification workflows and the nightly workflow.
- `docs/development/WORKFLOWS.md`: the workflow reference.
- `docs/development/DELIVERY-PIPELINE.md`: the Integration tier.
- `CHANGELOG.md`: the user-facing entry.
- `docs/*/core-shell-pr-gate*.md`: this handoff and its kick-off record.
- `tests/acceptance/core-shell-pr-gate/`: the acceptance tests.

## Test plan

<!-- Lines: - Suite `name`: …  - Gate `command`: …  - New test `tests/…`: …
     - No test change — reason   - E2E: reason for the e2e decision in the frontmatter -->

- New test `tooling/tests/ci-scope.checks.mjs`: the classifier (inputs, outside files, other events, a failed diff) and that every path-filtered consumer workflow lists exactly the config's inputs.
- Suite `quality`: the updated CI scope invariants in `tooling/tests/qualification-ci-scope.checks.mjs` and the e2e opt-in policy.
- Suite `acceptance`: AC-1 to AC-3 run the classifier and read the shipped workflows.
- Gate `node tooling/quality/check-repository.mjs`: every workflow passes the repository, e2e and permission checks.
- Gate `node bin/app check --fast --skip-suites --base origin/main`: types, lint and diff-scoped tests.
- E2E: none; no user interface changes and the e2e steps keep their opt-in conditions.

## Docs impact

<!-- - `docs/path.md` (how-to): what changes   — or —   None — reason -->

- `docs/development/WORKFLOWS.md` (reference): the scope job, the path-filtered consumer workflows, Showcase and the nightly workflow.
- `docs/development/DELIVERY-PIPELINE.md` (explanation): what the Integration tier runs and what moves to nightly.

## Changelog

<!-- - Added: text  (Added, Changed, Deprecated, Removed, Fixed or Security)  — or —  None — reason -->

- Changed: Ready pull requests run the core shell gate; generator and starter qualification runs only when its inputs change, and the full breadth, including the Windows complete verify, runs nightly on main and in every Release run.

## Risks and rollback

Risk: a plugin or CLI change that breaks a generated project or only fails on Windows is caught by the nightly run (at most a day later) or the Release tier instead of its own pull request; the release preflight and nightly keep that window short, and dispatching CI with tier release requalifies a branch at full breadth. A generator input missing from the list has the same effect. Rollback: revert the commit.

## Dependencies

None.

## Open questions

<!-- "None" when ready. Each open question blocks the Definition of Ready. -->

None. The owner approved running only the core shell gate on pull requests, path filters for generator qualification, and moving the Windows complete verify to a nightly run.

## Pull requests

<!-- wb:pull-requests generated by node bin/app; edits here are replaced -->
- [[docs/pull-requests/core-shell-pr-gate-kickoff|Kick-off: Pull requests run the core shell gate; generators run on their inputs and nightly]] · New
<!-- /wb:pull-requests -->
