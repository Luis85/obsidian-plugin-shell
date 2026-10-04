# Deliver a change

> Type: how-to · Part of the [docs index](../README.md)

Take a change from a new branch to a green merge into `main`: a draft pull
request while you iterate (Dev tier), ready for review when it should meet the
integration bar (Integration tier), then merge. Why the tiers are arranged this
way is explained in [Delivery pipeline](DELIVERY-PIPELINE.md); every workflow and
check is listed in [GitHub Actions workflows](WORKFLOWS.md). Agents follow the
same steps through the `feature-delivery` skill
(`.claude/skills/feature-delivery/SKILL.md`).

## 1. Start a branch

From `main`:

```sh
git fetch origin
git switch -c <topic-branch> origin/main
```

To build on top of another open pull request instead (a stacked pull request),
branch from that pull request's head branch:

```sh
git fetch origin
git switch -c <topic-branch> origin/<their-branch>
```

The stacked pull request's base is `<their-branch>`, not `main`, so its diff and
its diff-scoped checks show only your commits.

## 2. Open a draft pull request early

Push the branch and open the pull request as a **draft**. Only the Dev tier runs on
drafts, so early pushes stay fast.

- GitHub CLI: `git push -u origin <topic-branch>`, then
  `gh pr create --draft --base main --fill` (use `--base <their-branch>` when stacked).
- GitHub UI: open the pull request and choose **Create draft pull request**.
- Claude Code: ask for the `feature-delivery` skill. It asks whether to branch from
  `main` or stack on a pull request, and opens the draft only after you agree.

Fill `.github/pull_request_template.md` as you go; the gate lines can say "not run"
with a reason until the change is ready.

## 3. Iterate with the Dev tier

Each push runs "Dev checks". Run the same commands locally first; replace
`origin/main` with `origin/<their-branch>` for a stacked pull request:

```sh
node bin/app check --fast --skip-suites --base origin/main
node scripts/testing/suites.mjs --check
npm run check:repository
node scripts/release/changelog.mjs check
npm run check:self-review -- --base origin/main --warn-only
```

`node bin/app check --fast --base origin/main` (without `--skip-suites`) also runs
the `node --test` suites the diff selects; `node bin/app check --plan --base origin/main`
lists every gate the diff requires without running anything. A red "Dev checks" on
GitHub shows which step failed; every step runs even after an earlier one failed.
`node bin/app ci --job dev/fast` prints the job's exact commands.

## 4. Record user-facing changes

For a change a user or a generated project would notice, add a line to
`CHANGELOG.md` under `## [Unreleased]`, in the matching `### Added`, `### Changed`,
`### Deprecated`, `### Removed`, `### Fixed` or `### Security` group (Keep a
Changelog 1.1.0). Write what changed for the reader, not the commit history.
`node scripts/release/changelog.mjs check` validates the structure; the release
cut later turns `[Unreleased]` into the version's notes. Internal refactors and
test-only changes need no entry.

## 5. Prepare for review

Before you mark the pull request ready, run the Integration gates that apply to
your change and paste their real output into the template:

```sh
node bin/app check
npm run verify -- --json --keep-going
npm run check:self-review -- --base origin/main
node scripts/testing/suites.mjs <suite>
npm run test:e2e
```

- Choose the suites from `node bin/app check --plan --base origin/main` or the
  [test suites](../testing/TEST-SUITES.md) table; `--list` shows them all.
- `npm run test:e2e` is for served UI changes and needs a provisioned Chromium.
  Native smoke runs only in its explicitly provisioned scratch vault.
- Reproduce a specific Integration job with `node bin/app ci --job <workflow>/<job>`
  (dry run) and, where allowed, `--execute` in a scratch copy.
- Agents run the `self-review` skill here. A gate you did not run is "not run" with
  the reason, never "passed".

## 6. Mark it ready for review

- GitHub CLI: `gh pr ready <number>`.
- GitHub UI: **Ready for review** at the bottom of the pull request.

The `ready_for_review` event starts the Integration tier: `ci.yml` with every gate
job, the blocking self-review guard, and each other pull-request workflow whose
path filters match. Pushes after this point rerun the Integration tier, so batch
fixes where you can. Converting back to a draft (`gh pr ready --undo`) returns to
the Dev tier when you need to iterate freely again.

## 7. Fix failures

1. Open the failing job's log and the artifacts it uploaded (`reports/` evidence).
2. Reproduce it: `node bin/app ci --job <workflow>/<job>` prints the exact commands;
   a computed matrix needs `--matrix os=ubuntu-24.04` or similar.
3. Fix the cause in your change and push. A failing test is a finding, not a flake,
   until a rerun of the same commit and a reason show otherwise; do not weaken a
   threshold, skip a test or add a suppression to get green.
4. When a failure comes from outside your change (a runner outage, an upstream
   registry error in the live audit), say so in the pull request with the output.

"CI result" is the one Integration check branch protection requires; it fails when
any gate job failed or was cancelled. The informational security audit can fail
without failing "CI result".

## 8. Merge the green pull request

Merge when "Dev checks", "CI result" and the other triggered workflows are green
and review is complete. This repository merges with a merge commit
("Merge pull request #N from ..."): use **Create a merge commit** in the UI or
`gh pr merge <number> --merge`. Delete the topic branch afterwards
(`--delete-branch`).

For a stacked pull request, merge the lower pull request first. Then retarget the
upper one: GitHub retargets it to `main` automatically when the lower branch is
deleted on merge; otherwise use **Edit** on the pull request or
`gh pr edit <number> --base main`. If the lower pull request changed during review,
update the upper branch (`git merge origin/main`) and push; its checks run again.

A release pull request (`release/X.Y.Z`) is different: never merge it yourself.
Publish merges it; see [Cut and publish a release](CUT-AND-PUBLISH-A-RELEASE.md).
