# Your first increment

> Type: tutorial · Part of the [docs index](../README.md)

In this tutorial you plan one increment, "Export notes as JSON", and take it from
an idea to a merge into `main`: the CLI creates the documents, a kick-off draft
pull request carries them while you refine them until the Definition of Ready
passes, a change pull request stacked on the increment branch delivers the work,
and the Definition of Done closes both. Every command previews first and writes
only when you apply the plan.

You need a git work tree with at least one commit on `main`, the
`configs/delivery/` folder (the framework checkout and generated projects have it)
and, for the publishing steps, an `origin` on GitHub or Azure DevOps with `gh` or
`az` signed in. Look up any fact on the way in the
[Increments reference](INCREMENTS-REFERENCE.md) and
[Definition of Ready and Done](DEFINITION-OF-READY-AND-DONE.md).

## 1. Plan the increment

Preview what `increment new` would create:

```sh
node bin/app increment new export-notes --title "Export notes as JSON" --owner Luis --dry-run
```

The plan lists five new files and one branch step:

```text
increment new: planned
    create  docs/increments/export-notes.md
    create  docs/pull-requests/export-notes-kickoff.md
    create  docs/issues/export-notes.md
    create  tests/acceptance/export-notes/ac-1.checks.mjs
    create  tests/acceptance/export-notes/ac-2.checks.mjs
  Document     increment export-notes
  Status       New (new document)
  Creates      increment …; pullRequest …; issue …; 2 acceptance test stubs
  Branch step  create increment/export-notes from origin/main at 1a2b3c4d5e6f
Next: rerun the same command with --apply <planHash> (or --yes) to write exactly this plan
```

The Increment is the developer handoff, the kick-off pull request document plans
the pull request that will carry it, the issue tracks the work, and each acceptance
criterion of the template gets a pending test stub. Apply the plan you reviewed:

```sh
node bin/app increment new export-notes --title "Export notes as JSON" --owner Luis --apply <planHash>
```

`--apply` refuses with `PLAN_STALE` if anything changed since the preview. On a
terminal, leaving out `--title` starts a short interview instead, and
`--no-issue` or `--no-branch` skip the issue or the branch.

## 2. Read the Definition of Ready

```sh
node bin/app increment show export-notes
node bin/app increment check export-notes
```

`increment check` is blocked (exit 1): the template still holds placeholders, an
open question and an example test plan. The view lists each failing rule with its
`fix:` hint and the refinement brief, the questions to answer next:

```text
increment check: blocked
  Gate     Definition of Ready
  Result   not passed (not-ready)
  Rules    19 pass, 5 fail, 1 warn
Failing (5)
  [FAIL] DOR-04  No placeholders: 15 placeholder(s) left.
         fix: Replace every <placeholder> or to-be-decided marker with the decided content, …
  [FAIL] DOR-07  Open questions resolved: Open questions remain.
…
Refinement brief
  Skills: increment-handoff, ideation-brainstorm, ideation-concept
```

## 3. Open the kick-off pull request as a draft

The kick-off pull request merges `increment/export-notes` into `main` at the very
end. Until then it is where the increment is discussed and refined. Commit the
documents on the increment branch:

```sh
git switch increment/export-notes
git add docs/increments docs/pull-requests docs/issues tests/acceptance
git commit -m "Plan the export-notes increment"
```

Preview the publication. It reads the hosting platform, nothing else:

```sh
node bin/app pr publish export-notes-kickoff --dry-run
```

The preview shows the platform and repository, whether the head branch is already
on the remote, the steps (`push-head → create → readback → record`) and the body
size against the platform limit. Apply it when it looks right:

```sh
node bin/app pr publish export-notes-kickoff --apply <planHash>
```

The CLI pushes `increment/export-notes` (the only push it ever makes), creates the
draft pull request, reads it back, then records the binding in the kick-off
document and in `.workbench/pull-requests/export-notes-kickoff.sync.json`. Commit
both:

```sh
git add docs .workbench
git commit -m "Record the published kick-off pull request"
git push
```

## 4. Refine until the Definition of Ready passes

Answer the brief together with the reviewers, one section at a time. Write a
section in a Markdown file and replace it, or add single items:

```sh
node bin/app increment edit export-notes --section Summary --input summary.md --yes
node bin/app increment scope add export-notes "The export command and its JSON shape" --yes
node bin/app increment out-of-scope add export-notes "Importing JSON back into a vault" --yes
node bin/app increment ac set export-notes AC-1 --text "Given two notes When they are exported Then the JSON file lists both" --yes
node bin/app increment check export-notes
```

`increment ac add` adds a criterion together with its stub. Commit and push after
each round; the "Definition of Ready" check on the draft pull request reruns on
every push. When `increment check` passes, move the increment to Ready:

```sh
node bin/app increment status export-notes Ready --dry-run
node bin/app increment status export-notes Ready --yes
```

The Ready transition runs the same check and refuses with `INCREMENT_NOT_READY`
while a rule fails. Ready is the agreement to start implementing.

## 5. Stack a change pull request on the increment branch

Plan the first change pull request. It delivers both criteria and gets its own
branch from the increment branch's latest commit:

```sh
node bin/app pr new export-notes --title "Export command" --delivers AC-1,AC-2 --switch --dry-run
node bin/app pr new export-notes --title "Export command" --delivers AC-1,AC-2 --switch --yes
node bin/app pr task add export-notes-1 "Write the exporter" --yes
node bin/app pr scope add export-notes-1 "The export command" --yes
node bin/app pr out-of-scope add export-notes-1 "Import" --yes
```

You are now on `pr/export-notes/export-notes-1`, whose base is
`increment/export-notes`. Implement the change and turn the stubs
`tests/acceptance/export-notes/ac-1.checks.mjs` and `ac-2.checks.mjs` into real
tests: replace each `test.todo(...)` with assertions. A stub is the criterion's
evidence, so it must prove the criterion.

Commit, then publish this pull request the same way as the kick-off
(`pr publish export-notes-1 --dry-run`, then `--apply`). Publishing the first pull
request of a Ready increment moves the increment to In progress in the same plan.

## 6. Pass the Definition of Done of the change

Tick what is finished and run the change's Definition of Done against the
increment branch:

```sh
node bin/app pr task set export-notes-1 T-1 --status done --yes
node bin/app increment ac set export-notes AC-1 --status done --yes
node bin/app increment ac set export-notes AC-2 --status done --yes
node scripts/delivery/done.mjs --base origin/increment/export-notes
node scripts/delivery/done.mjs --base origin/increment/export-notes --write
```

A change pull request is checked against its PullRequest document: its tasks are
done, its delivered criteria are ticked with existing evidence, the stubs hold
assertions and the increment is still In progress. `--write` adds its Completion
record. If the increment says `e2e: required`, add the `e2e` label to the pull
request. Mark the pull request ready for review on the platform, let the checks
run and merge it into `increment/export-notes` with a merge commit. Then bring
the documents up to date:

```sh
node bin/app pr sync export-notes-1 --yes
```

`pr sync` pulls the Merged status, any tasks or amendments reviewers added on the
platform, and pushes your local task changes to the description.

## 7. Complete the increment and merge the kick-off

Switch back to the increment branch, update it and run the increment's Definition
of Done against `main`:

```sh
git switch increment/export-notes
git pull
node bin/app increment check export-notes --gate done --base origin/main
node scripts/delivery/done.mjs --base origin/main --write
```

On the kick-off, the whole increment must be complete: every criterion ticked with
evidence, every other pull request merged or closed, every issue done or
cancelled. `--write` generates the Completion record, the `## [Unreleased]`
entries from the Changelog section, the docs index rows of new pages, and sets
`status: Done`. (`node bin/app increment complete export-notes --dry-run` plans the
same outputs as a reviewed plan; the still-open kick-off does not block it.) Review the diff, commit, push, mark the kick-off ready
for review and merge it into `main` when "Dev checks", "Definition of Ready",
"CI result" and "Definition of Done" are green. Finish with
`node bin/app pr sync export-notes-kickoff --yes`.

## What you did

You planned an increment as reviewed documents, refined it in a draft pull request
until the Definition of Ready passed, delivered it through a change pull request
stacked on the increment branch, and closed it with the Definition of Done before
merging into `main`. For everyday tasks, such as conflicts during sync, issues,
amendments and Azure DevOps, continue with [Manage increments](MANAGE-INCREMENTS.md).
