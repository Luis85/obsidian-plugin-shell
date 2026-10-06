# Feature delivery: Definition of Ready and Definition of Done

Both checks read the increment of the pull request, `docs/increments/<slug>.md` (created by `node bin/app increment new` from `configs/delivery/increment-handoff.template.md`), and the PullRequest and Issue documents the diff changes. Every rule is listed in `docs/development/DEFINITION-OF-READY-AND-DONE.md`. Their rules live in `configs/delivery/definition-of-ready.json` and `configs/delivery/definition-of-done.json`; the workflows are listed in `docs/development/WORKFLOWS.md`. The configuration is the source of truth for which rules apply; this page explains when each check runs and what to do with its result.

## When each check runs

| Moment | Local command | Pull request check | Workflow |
| --- | --- | --- | --- |
| Before implementation, before and after opening the draft | `node bin/app increment check <slug>`, or `node tooling/delivery/ready.mjs --handoff docs/increments/<slug>.md` or `--base origin/<base>` | "Definition of Ready" (drafts included) | `definition-of-ready.yml` |
| After implementation, before marking ready and before merging | `node tooling/delivery/done.mjs --base origin/<base>`, or `node bin/app increment check <slug> --gate done --base origin/<base>` | "Definition of Done" (skips drafts) | `definition-of-done.yml` |

The Definition of Done is kind-aware. A change pull request (base `increment/<slug>`) is checked against its PullRequest document: its tasks done, the criteria it `delivers` ticked with evidence and their stubs implemented, the increment still In progress. The kick-off pull request (`increment/<slug>` into `main`) is checked against the whole increment: every criterion, every other pull request merged or closed, every issue done or cancelled, status Done.

Both commands exit 0 when the rules pass, 1 when they do not, and 2 on a usage or configuration error. `--json` prints machine output; `--summary <file>` writes the Markdown report CI shows as the job summary. Without `--write` both are read-only.

Required checks on `main`: "Dev checks" and "Definition of Ready" for drafts, "CI result" and "Definition of Done" for ready pull requests. Setting them as required is the owner's decision in the repository settings.

## Definition of Ready is red

The report lists each failing rule with a hint and a refinement brief: questions per failed rule and the skill that should answer them. Do not start implementation.

1. Read the report (local output or the job summary).
2. Switch to the `increment-handoff` skill. It turns the brief into question rounds, plans only the affected edits with `node bin/app increment edit`, `scope add` or `ac add|set` and reruns the check.
3. When the brief says the problem or scope itself is unclear, that skill escalates to `ideation-brainstorm` or `ideation-concept`, or splits the increment.
4. Push the updated handoff; the check reruns on push and when the pull request body is edited.

`node tooling/delivery/ready.mjs --write` only adds missing section scaffolds to the handoff and never overwrites authored text. Scaffolds are not answers.

## Definition of Done is red

Typical findings: an acceptance criterion not checked or without existing evidence, source changes without test changes (and no stated reason in the Test plan), a user-facing change without an Unreleased entry, a Docs impact target not changed or missing its Diataxis `> Type:` marker, a new doc page not indexed in `docs/README.md`, added debug or focus markers, or a diff that escapes the handoff's affected areas.

1. Fix the cause in the change: write the missing test or doc, implement the pending acceptance stub, tick a task (`node bin/app pr task set <pr-id> T-<n> --status done`) or a criterion (`node bin/app increment ac set <slug> AC-<n> --status done --evidence <path>`) only when it is really done and its evidence exists.
2. Generate the documentation the rules expect: `node tooling/delivery/done.mjs --base origin/<base> --write` writes the handoff's completion record (changed files by area, criterion-to-evidence table, gates), the `## [Unreleased]` entry from the handoff's Changelog line and the docs index rows for new pages.
3. Review the generated diff with `git diff`; correct anything wrong in the handoff, not in the generated output, and rerun. Commit on the user's approval.
4. In CI the check is read-only: it puts the same generated content in the job summary and an artifact so it can be applied locally with `--write`.

When the scope really changed, update the handoff (and rerun the Definition of Ready) instead of forcing the old criteria through.

## Exempt pull requests

`release/*` branches and the configured bot actors are exempt and pass with a notice. Release pull requests use `.github/PULL_REQUEST_TEMPLATE/release.md` and the `release` skill; `release.yml` reports "Definition of Ready" and "Definition of Done" aliases after "Release result".

## Never

- Edit `configs/delivery/**`, disable a rule or lower a size budget to get green; that is an owner decision in its own pull request.
- Tick a criterion, write evidence paths that do not exist, or hand-edit the generated completion record to satisfy the check.
- Treat a green Definition of Ready as permission to implement, or a green Definition of Done as permission to mark ready or merge. Each step still needs the user's explicit request.
