# Increments and pull requests

Plan work as an **increment**: a Markdown document that states the outcome, scope,
acceptance criteria, test plan, docs and changelog impact of one deliverable
change. The CLI keeps the increment, its planned pull requests and its issues as
reviewed documents in the repository, checks them with the Definition of Ready
before implementation and the Definition of Done after it, and publishes planned
pull requests to GitHub or Azure DevOps only when you apply that step.

The step-by-step walk-through is the [first increment tutorial](../../development/FIRST-INCREMENT.md);
task recipes are in [Manage increments](../../development/MANAGE-INCREMENTS.md); the
document formats, statuses and codes are in the
[Increments reference](../../development/INCREMENTS-REFERENCE.md); every rule is in
[Definition of Ready and Done](../../development/DEFINITION-OF-READY-AND-DONE.md).

## The model

| Piece | Where | Purpose |
| --- | --- | --- |
| Increment | `docs/increments/<id>.md`, branch `increment/<id>` | The handoff the Definition of Ready and Done check. |
| Kick-off pull request | `docs/pull-requests/<id>-kickoff.md`, `increment/<id>` into `main` | Carries the increment documents, is refined until Ready and merges the increment at the end. |
| Change pull requests | `docs/pull-requests/<id>-<n>.md`, `pr/<id>/<id>-<n>` into `increment/<id>` | Deliver the work, stacked on the increment branch. |
| Issues | `docs/issues/<id>.md` | Optional local breakdown of the work. |
| Acceptance stubs | `tests/acceptance/<id>/ac-<n>.checks.mjs` | One pending test per criterion, implemented as its evidence. |

## Plan and check an increment

```sh
node bin/app increment new export-notes --title "Export notes as JSON" --owner Luis --dry-run
node bin/app increment new export-notes --title "Export notes as JSON" --owner Luis --yes
node bin/app increment show export-notes
node bin/app increment check export-notes
node bin/app increment status export-notes Ready --dry-run
```

`increment new` plans the Increment, the kick-off pull request document, an issue,
the acceptance stubs and the increment branch; `--no-issue` and `--no-branch` leave
them out. `increment check` reports the Definition of Ready (or, with
`--gate done`, the Definition of Done) with each failing rule, its fix and the
refinement brief, and exits 1 until it passes.

## Plan and publish pull requests

```sh
node bin/app pr new export-notes --title "Export command" --delivers AC-1,AC-2 --switch --dry-run
node bin/app pr task add export-notes-1 "Write the exporter" --yes
node bin/app pr publish export-notes-1 --dry-run
node bin/app pr sync export-notes-1
```

`pr publish` and `pr sync` have the **remote** effect: the preview reads the
platform, and only `--apply <planHash>` or `--yes` writes it, then records the
result locally. They never mark a draft ready, merge, store tokens or replay from
a saved plan. An outcome the CLI cannot confirm exits with code 2 and is never
retried automatically; rerun the same command after inspecting the pull request.

## Safety

- Every write is a reviewed plan; `--dry-run` writes nothing.
- The documents are the source of truth; the published description is a view of
  them with tasks and amendments that sync both ways.
- AI agents run `pr publish`, `pr sync` and any push only on the user's explicit
  request.
