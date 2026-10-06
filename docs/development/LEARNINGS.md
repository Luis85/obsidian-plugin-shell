# Manage learnings

> Type: how-to guide and format reference · Part of the [docs index](../README.md)

`node bin/app learning` keeps lessons learned as plain Markdown: one note per learning, with YAML frontmatter that
Obsidian shows as properties, in a configurable folder (default `docs/learnings`). The CLI creates, edits, reviews,
checks and reports on those notes. Every write is a reviewed, hash-approved file plan, and notes changed by hand are
never overwritten.

`learning` (lessons learned) is not `learn`: `node bin/app learn` runs the step-by-step learning paths in
`configs/learning`. The two roots share no files, settings or tests.

Learnings are a collection of the generic [note-collection engine](NOTE-COLLECTIONS.md), like the
[risk register](RISK-MANAGEMENT.md). Everything about the format (statuses, transitions, categories, tags, impact,
register columns, review rules) is data in [`configs/collections/learning.json`](../../configs/collections/learning.json);
no hook is needed.

## Quick start

```sh
node bin/app learning new                     # guided: form, note preview, default-No review
node bin/app learning edit --id LRN-0001      # pre-filled form; without --id you pick a learning
node bin/app learning review                  # walk validated high-impact or overdue learnings
node bin/app learning list --json             # filter with --status, --category, --impact, --overdue
node bin/app learning check --json
node bin/app learning report --base --json    # plan; then the same command with --apply <planHash>
```

`learning new`, `learning edit` and `learning review` are interactive (a TTY, no `CI`, `--json` or `--input`). Agents
and scripts use the machine commands below.

## Lifecycle

| Status | Open | Meaning | Next |
| --- | --- | --- | --- |
| `draft` | no | Captured, not yet agreed | validated, archived |
| `validated` | yes | Agreed; it owes a follow-up action with a due date | applied, superseded, archived, draft |
| `applied` | no | The follow-up is done (`applied` is dated on entry) | validated, superseded, archived |
| `superseded` | no | Replaced by a newer learning (`superseded-by: LRN-…`) | validated, archived |
| `archived` | no | No longer relevant | draft |

Only `validated` is open. That is what makes the engine enforce the follow-up: validating a learning (on `new` or
`update`) requires `followUp` and `due`; a validated note edited by hand without them is reported by `learning check`
as `COLLECTION_OPEN_FIELD`; a validated learning whose `due` has passed is `COLLECTION_OVERDUE`. Drafts are never
overdue and are not in the review walk; triage them with `learning list --status draft`.

## Choose the folder

The folder is the user setting `paths.learnings`, edited with `node bin/app settings` (field **Learnings folder**) or:

```sh
node bin/app settings --input settings.json --json   # {"schemaVersion":1,"paths":{"learnings":"team/learnings"}}
```

It is validated like every settings path (relative, inside the project, outside protected folders, not overlapping
another path such as `paths.risks`), optional (without it `docs/learnings` is used and existing settings keep their
bytes), and moving it in a set-up project is a reviewed migration: `node bin/app settings migrate --input paths.json --json`.

## Machine commands

| Command | Does |
| --- | --- |
| `learning list [--status <id>] [--category <id>] [--impact <id>] [--overdue] --json` | Readable learnings in report order (status, impact, observed date, id), plus `needsAttention` and `ignored` files. Unknown filter values fail. |
| `learning show --id <id> --json` | One note: path, state, `sha256`, values, overdue, issues and the full Markdown. |
| `learning new --input learning.json --json` | Plans a new note with the next free id. `--apply <planHash>` writes it. |
| `learning update --id <id> --input changes.json --json` | Plans the changed fields and a status transition. `--apply <planHash>` writes it. |
| `learning check --json` | Every issue; `status` is `failed` only for errors. |
| `learning report [--base] --json` | Plans `<folder>/learnings.md` and, with `--base`, `<folder>/learnings.base`. |
| `learning model --json` | The effective collection definition and whether it is built in or the project's. |

`--as-of <YYYY-MM-DD>` replaces today as the reference date for `created`/`updated`/`observed` defaults, stamps and
overdue checks, so plans and reports are reproducible.

### Input

`learning.json` uses the input names of the fields (`follow-up` becomes `followUp`, `related-risks` `relatedRisks`):

```json
{
  "title": "Pin the toolchain",
  "context": "CI broke after a silent npm upgrade on the shared runner.",
  "insight": "Pin exact Node and npm versions and check them before installing.",
  "category": "tooling",
  "impact": "high",
  "tags": ["ci", "dependencies"],
  "source": "PR #65",
  "appliesTo": ["CI", "setup"],
  "relatedRisks": ["RISK-0003"],
  "observed": "2026-09-30",
  "status": "validated",
  "followUp": "Add an engines check to setup",
  "due": "2026-10-20",
  "owner": "Alex",
  "evidence": "Build log of 2026-09-30, job 4411."
}
```

- Required: `title`, `context`, `insight`, `category`, `impact`, `tags` (at least one).
- While validated: `followUp` and `due` too.
- `status` defaults to `draft`; `observed` (when it happened) defaults to the reference date.
- `relatedRisks` holds risk ids (`RISK-` and 3–9 digits) and `supersededBy` a learning id (`LRN-…`). Only the format
  is checked; whether that risk or learning exists is not (see [limits](#limits)).
- `evidence` fills a body section and is accepted only by `new`.
- `reviewed`, `applied`, `id`, `created` and `updated` are never input.

`changes.json` for `update` holds only what changes; `null` or `""` removes an optional value.

## Note format

```markdown
---
type: "Learning"
id: "LRN-0001"
title: "Pin the toolchain"
status: "validated"
created: "2026-10-04"
updated: "2026-10-04"
observed: "2026-09-30"
context: "CI broke after a silent npm upgrade on the shared runner."
insight: "Pin exact Node and npm versions and check them before installing."
category: "tooling"
tags:
  - "ci"
  - "dependencies"
impact: "high"
source: "PR #65"
applies-to:
  - "CI"
  - "setup"
follow-up: "Add an engines check to setup"
due: "2026-10-20"
owner: "Alex"
related-risks:
  - "RISK-0003"
schema_version: 1
---

# Pin the toolchain

## Context
…
## Insight
…
## Evidence
…
## Follow-up
…
```

| Property | Rules |
| --- | --- |
| `type` | Always `Learning`. Other Markdown in the folder is ignored. |
| `id` | `LRN-` and at least four digits, one above the highest id in any note, file name or the register; never reused while those survive. Archive learnings instead of deleting them. |
| `title`, `context`, `insight`, `source`, `follow-up`, `owner` | Single-line text. |
| `observed`, `due`, `created`, `updated`, `reviewed`, `applied` | Dates written as `YYYY-MM-DD`. `reviewed` is set by `learning review`; `applied` when the learning enters `applied`, removed when it leaves. |
| `category`, `impact` | Ids from the definition: categories process, technical, tooling, testing, security, communication, planning, people; impact low, medium, high. |
| `tags` | A list of tag ids: architecture, automation, ci, dependencies, documentation, estimation, incident, onboarding, performance, release, requirements, review. |
| `applies-to` | A list of free text areas (each up to 80 characters). |
| `related-risks`, `superseded-by` | Risk ids (`RISK-0003`) and a learning id (`LRN-0002`). |
| `schema_version` | `1`. A newer version is reported as `COLLECTION_FUTURE` and never changed. |

The file name is `<id>-<slugged title>.md` and never changes. The body is rendered once from the template
(Context, Insight, Evidence, Follow-up) and afterwards belongs to you. Updates patch only the changed properties
inside the existing YAML and keep the path, id, `created`, `observed`, unknown properties, comments and body bytes;
a note changed after review is never overwritten (`PLAN_STALE`). See the
[engine guarantees](NOTE-COLLECTIONS.md#guarantees).

## Review, check and register

- `learning review` walks open (validated) learnings with impact `high`, and validated learnings whose follow-up is
  overdue. For each: record a review (follow-up, due date, status), skip or stop; each review is one reviewed write.
- `learning check` reports the engine codes listed in [risk checks](RISK-MANAGEMENT.md#checks); for learnings
  `COLLECTION_VALUE` also covers malformed risk or learning ids and tags outside the vocabulary.
- `learning report` writes `learnings.md` between `<!-- learning-register:start sha256=… -->` and
  `<!-- learning-register:end -->` (text outside the markers is yours), sorted by status, impact and observed date,
  with an overdue list and the files that need attention. `--base` adds `learnings.base` (Obsidian Bases) over the
  `type: Learning` notes; property keys with hyphens (`follow-up`, `related-risks`) are left out of the Bases view.

To customize statuses, vocabularies or columns, copy `configs/collections/learning.json` to the same path in your
project; it replaces the built-in definition completely and is validated fail-closed.

## Demo data

```sh
node bin/app fake-data --generation learnings-demo --root <scratch-folder> --json   # then --apply <planHash>
node bin/app learning check --root <scratch-folder> --as-of 2026-01-01 --json
```

The `learning` preset writes 20 notes into `docs/learnings` with draft, validated, applied and superseded learnings
and related risk ids `RISK-0001`–`RISK-0008`. Generate into a scratch `--root`; inside the framework checkout
`docs/` is a template input folder.

## Limits

- Related risk and superseded-by ids are checked for format only. A reference to a risk that does not exist (or was
  renamed) is not reported, because collection hooks are pure and never read another folder.
- Body sections are not regenerated on update; `context`, `insight` and `follow-up` in the frontmatter are the
  structured values, the body is free text.
- The interactive wizards are exercised with scripted plain prompts; the full-screen terminal UI is not separately
  tested for learnings.

## Tests

| File | Covers |
| --- | --- |
| `src/cli/tests/interactive-maker-learnings-domain.checks.mjs` | Definition validation (including `idPrefix`), reading, create/update rules, transitions and stamps, queries, review queue, register |
| `src/cli/tests/interactive-maker-learnings-command.checks.mjs` | CLI routing beside `learn`, plan/apply, preserving updates, check/list/show, report preservation, `paths.learnings` and migration, the `learnings-demo` preset passing `learning check` |
| `src/cli/tests/interactive-maker-learnings-wizard.checks.mjs` | The real `learning-new`, `learning-edit` and `learning-review` wizards with scripted plain prompts |
