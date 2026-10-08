# Deliver a change

> Type: how-to · Part of the [docs index](../README.md)

Take a change from a new branch to a green merge into `main`: a draft pull
request while you iterate (Dev tier), ready for review when it should meet the
integration bar (Integration tier), then merge. Why the tiers are arranged this
way is explained in [Delivery pipeline](DELIVERY-PIPELINE.md); every workflow and
check is listed in [GitHub Actions workflows](WORKFLOWS.md). Agents follow the
same steps through the `feature-delivery` skill
(`.claude/skills/feature-delivery/SKILL.md`).

## 1. Start from an increment

Every pull request carries an increment: the documents that the "Definition of
Ready" and "Definition of Done" checks read. Plan a new one, or a change pull
request of an existing one:

```sh
node bin/app increment new <id> --title "<title>" --owner <name> --dry-run
node bin/app pr new <id> --title "<title>" --delivers AC-1 --switch --dry-run
```

Rerun with `--yes` (or `--apply <planHash>`) after reviewing the plan.
`increment new` creates the increment branch `increment/<id>` and the kick-off
pull request document; `pr new` creates a change pull request on
`pr/<id>/<pr-id>` from the increment branch, so its base is `increment/<id>`.
The full walk-through is [Your first increment](FIRST-INCREMENT.md); a small fix
without an increment workflow can still branch by hand as below, but the
Definition of Ready needs its Increment document in the diff or a `Handoff:` line
in the pull request body.

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
- Workbench CLI: `node bin/app pr publish <pr-id> --dry-run`, then
  `--apply <planHash>`. It pushes the head branch if it is missing on the remote,
  creates the draft with the managed description (including the `Handoff:` line)
  and records it in the PullRequest document and its sync record; commit both.
- Claude Code: ask for the `feature-delivery` skill. It asks whether to branch from
  `main` or stack on a pull request, and opens the draft only after you agree.

Fill `.github/pull_request_template.md` as you go; the gate lines can say "not run"
with a reason until the change is ready.

## 3. Iterate with the Dev tier

Each push runs "Dev checks". Run the same commands locally first; replace
`origin/main` with `origin/<their-branch>` for a stacked pull request:

```sh
node bin/app check --fast --skip-suites --base origin/main
node tooling/testing/suites.mjs --check
npm run check:repository
node src/cli/tooling/release/changelog.mjs check
npm run check:self-review -- --base origin/main --warn-only
node bin/app increment check <id>
```

Each push also runs "Definition of Ready". Do not start implementing while it is
red: answer its refinement brief in the increment and push again (see
[Definition of Ready and Done](DEFINITION-OF-READY-AND-DONE.md)). Once it passes,
set the increment to Ready with `node bin/app increment status <id> Ready --yes`.

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
`node src/cli/tooling/release/changelog.mjs check` validates the structure; the release
cut later turns `[Unreleased]` into the version's notes. Internal refactors and
test-only changes need no entry.

## 5. Prepare for review

Before you mark the pull request ready, run the Integration gates that apply to
your change and paste their real output into the template:

```sh
node bin/app check
npm run verify -- --json --keep-going
npm run check:self-review -- --base origin/main
node tooling/testing/suites.mjs <suite>
npm run test:e2e
```

- Choose the suites from `node bin/app check --plan --base origin/main` or the
  [test suites](../testing/TEST-SUITES.md) table; `--list` shows them all.
- `npm run test:e2e` is for served UI changes and needs a provisioned Chromium.
  Native smoke runs only in its explicitly provisioned scratch vault. End-to-end
  tests are opt-in until the Release tier: run them locally when your change
  touches served UI, browser or host behaviour, or opt the pull request in (next
  step); record "not run" otherwise.
- Reproduce a specific Integration job with `node bin/app ci --job <workflow>/<job>`
  (dry run) and, where allowed, `--execute` in a scratch copy.
- Run the Definition of Done for this pull request:
  `node tooling/delivery/done.mjs --base origin/<base>` (`--write` generates the
  Completion record, the Unreleased entries and the docs index rows; review them
  before committing). A change pull request is checked against its PullRequest
  document, the kick-off against the whole increment.
- Agents run the `self-review` skill here. A gate you did not run is "not run" with
  the reason, never "passed".

## 6. Mark it ready for review

- GitHub CLI: `gh pr ready <number>`.
- GitHub UI: **Ready for review** at the bottom of the pull request.

The `ready_for_review` event starts the Integration tier: `ci.yml` with every gate
job, the blocking self-review guard, "Definition of Done", and each other
pull-request workflow whose path filters match. Pushes after this point rerun the Integration tier, so batch
fixes where you can. Converting back to a draft (`gh pr ready --undo`) returns to
the Dev tier when you need to iterate freely again.

End-to-end steps (served UI in Chromium, browser suites, real Obsidian; the list is
in [GitHub Actions workflows](WORKFLOWS.md#end-to-end-opt-in)) are skipped unless
you opt in. Add the `e2e` label (`gh pr edit <number> --add-label e2e`) when the
change touches served UI, browser or host behaviour, and always when its
increment says `e2e: required` (the Definition of Done fails without the label). Adding the label starts only the jobs that hold
end-to-end steps, reported as "E2E result"; while the label stays, every later
push runs them inside "CI result". The Release tier runs them all regardless.

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
without failing "CI result". An `e2e` label run reports "E2E result" instead, so it
never replaces "CI result"; treat a red "E2E result" as a finding like any other.

## 8. Merge the green pull request

Merge when "Dev checks", "Definition of Ready", "CI result", "Definition of Done"
and the other triggered workflows are green
(with the `e2e` label, "E2E result" too) and review is complete. This repository merges with a merge commit
("Merge pull request #N from ..."): use **Create a merge commit** in the UI or
`gh pr merge <number> --merge`. Delete the topic branch afterwards
(`--delete-branch`).

For a stacked pull request, merge the lower pull request first. Then retarget the
upper one: GitHub retargets it to `main` automatically when the lower branch is
deleted on merge; otherwise use **Edit** on the pull request or
`gh pr edit <number> --base main`. If the lower pull request changed during review,
update the upper branch (`git merge origin/main`) and push; its checks run again.

A change pull request merges into its increment branch; afterwards run
`node bin/app pr sync <pr-id> --yes` so its document records the merge. The
kick-off pull request merges the increment branch into `main` last, once the
whole increment passes its Definition of Done.

A release pull request (`release/X.Y.Z`) is different: never merge it yourself.
Publish merges it; see [Cut and publish a release](CUT-AND-PUBLISH-A-RELEASE.md).
