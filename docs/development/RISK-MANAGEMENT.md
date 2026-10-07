# Manage risks

> Type: how-to guide and format reference · Part of the [docs index](../README.md)

`node bin/app risk` keeps a risk register as plain Markdown: one note per risk, with YAML frontmatter that Obsidian
shows as properties, in a configurable folder (default `docs/risks`). The CLI creates, edits, reviews, checks and
reports on those notes. Every write is a reviewed, hash-approved file plan, and notes changed by hand are never
overwritten.

Risks are the first collection of the generic [note-collection engine](NOTE-COLLECTIONS.md). Everything about the
risk format (statuses, transitions, dimensions, categories, scales, thresholds, register columns) is data in
[`configs/collections/risk.json`](../../configs/collections/risk.json).

## Quick start

```sh
node bin/app risk new                     # guided: form, note preview, default-No review
node bin/app risk edit --id RISK-0001     # pre-filled form; without --id you pick a risk
node bin/app risk review                  # walk open high/critical or overdue risks
node bin/app risk list --json             # filter with --status, --dimension, --category, --level, --overdue
node bin/app risk check --json
node bin/app risk report --base --json    # plan; then the same command with --apply <planHash>
```

`risk new`, `risk edit` and `risk review` are interactive (a TTY, no `CI`, `--json` or `--input`). Agents and scripts
use the machine commands below.

## Choose the folder

The folder is the user setting `paths.risks`, edited with `node bin/app settings` (field **Risk register folder**) or:

```sh
node bin/app settings --input settings.json --json   # {"schemaVersion":1,"paths":{"risks":"governance/risks"}}
```

- The path is validated like every other settings path: relative, portable, inside the project, outside protected
  folders (`.git`, `node_modules`, the vault configuration folder) and not overlapping another configured path.
- Like `paths.design`, it is optional. Without it, `docs/risks` is used and existing settings files and saved setup
  state keep their exact bytes. The settings form shows the default; leaving it unchanged does not write it.
- In a project that is already set up, moving the folder is a reviewed file migration that moves every file in it:
  `node bin/app settings migrate --input paths.json --json`.

Every `risk` command reads the folder from settings; there is no per-command override.

## Machine commands

| Command | Does |
| --- | --- |
| `risk list [--status <id>] [--dimension <id>] [--category <id>] [--level <id>] [--overdue] --json` | Readable risks in report order (level, score, id), plus `needsAttention` and `ignored` files. Unknown filter values fail. |
| `risk show --id <id> --json` | One note: path, state, `sha256`, values (derived score/level included), overdue, issues and the full Markdown. |
| `risk new --input risk.json --json` | Plans a new note with the next free id. `--apply <planHash>` writes it. |
| `risk update --id <id> --input changes.json --json` | Plans the changed fields and a status transition. `--apply <planHash>` writes it. |
| `risk check --json` | Every issue; `status` is `failed` only for errors. |
| `risk report [--base] --json` | Plans `<folder>/risk-register.md` and, with `--base`, `<folder>/risks.base`. |
| `risk model --json` | The effective collection definition and whether it is built in or the project's. |

`--as-of <YYYY-MM-DD>` replaces today (local date) as the reference date for `created`/`updated`/review stamps and
for overdue checks, so plans and reports are reproducible. A plan made on one day cannot be applied on the next
without `--as-of`, because its bytes, and therefore its `planHash`, change.

### Input

`risk.json` uses the input names of the definition's fields (`next-action` becomes `nextAction`):

```json
{
  "title": "Vendor API delivered late",
  "description": "The payment vendor may ship its v2 API after our integration window.",
  "nextAction": "Ask the vendor for a committed date",
  "due": "2026-10-20",
  "dimension": "schedule",
  "category": "external",
  "probability": 3,
  "impact": 4,
  "owner": "Alex",
  "status": "identified",
  "identified": "2026-10-01",
  "mitigation": "Keep the v1 adapter ready as a fallback.",
  "notes": "Raised in the weekly sync."
}
```

- Required: `title`, `description`, `dimension`, `category`, `probability`, `impact`.
- While the risk is open (`identified`, `assessed`, `mitigating`), `nextAction` and `due` are required too.
- `status` defaults to `identified`; `identified` defaults to the reference date.
- `mitigation` and `notes` fill body sections and are accepted only by `new`.
- `score`, `level`, `reviewed`, `closed`, `id`, `created` and `updated` are never input.

`changes.json` for `update` holds only what changes. `null` (or `""`) removes an optional value such as `owner`.
Unknown keys, values outside the model and transitions the model does not allow fail with a clear message, and
nothing is written. An update that changes nothing fails with `COLLECTION_UNCHANGED`.

## Note format

```markdown
---
type: "Risk"
id: "RISK-0001"
title: "Vendor API delivered late"
status: "mitigating"
created: "2026-10-04"
updated: "2026-10-05"
description: "The payment vendor may ship its v2 API after our integration window."
next-action: "Build the v1 fallback switch"
due: "2026-10-18"
identified: "2026-10-04"
dimension: "schedule"
category: "external"
probability: 4
impact: 4
score: 16
level: "critical"
owner: "Alex"
schema_version: 1
---

# Vendor API delivered late

## Description
…
## Mitigation
…
## Notes
```

| Property | Rules |
| --- | --- |
| `type` | Always `Risk`. Markdown in the folder without it is ignored (listed under `ignored`). |
| `id` | `RISK-` and at least four digits. Allocated as one above the highest id found in any note's `id`, any file name in the folder (subfolders included) and the generated register, so ids are not reused while those survive. Close risks instead of deleting their notes. |
| `title`, `description`, `next-action`, `owner` | Single-line text. |
| `status` | A status of the model; see transitions below. |
| `created`, `updated`, `identified`, `due`, `reviewed`, `closed` | Dates written as `YYYY-MM-DD`. `updated` is set on every write; `reviewed` by `risk review`; `closed` when the risk enters `closed`, removed when it is reopened. |
| `dimension`, `category` | Ids from the model's vocabularies. |
| `probability`, `impact` | Whole numbers on the model's 1–5 scales. |
| `score`, `level` | Derived: `probability × impact` and the highest threshold reached. Written by the CLI; a hand-authored or generated note may omit them, and then they are computed on read. If present, they must match. |
| `schema_version` | `1`. A note with a higher version is reported as `COLLECTION_FUTURE` and never changed. |

The file name is `<id>-<slugged title>.md` and never changes, even when the title does. The body is rendered once
from the definition's `body` template and afterwards belongs to you.

### What an update keeps

An update patches only the changed properties (plus `updated` and the derived values) inside the existing YAML. The
path, the id, `created`, `identified`, every other property (including ones the CLI does not know), YAML comments and
the body bytes stay exactly as they were. The candidate file is parsed again and compared before review. The plan
records the hash of the bytes that were read, and applying it fails with `PLAN_STALE` if the note changed since.

### Reading is safe

The YAML reader matches the plugin's note repository: core schema, unique keys, no aliases, tags or prototype keys,
at most 1 MB per note. Malformed, non-UTF-8, future and invalid notes are reported (`needsAttention` and
`risk check`), stay byte-for-byte untouched, and cannot be updated until fixed. Symbolic links and hidden entries in
the folder are refused or skipped.

## Model

| Part | Default |
| --- | --- |
| Statuses | `identified` → assessed, mitigating, accepted, closed; `assessed` → mitigating, accepted, closed; `mitigating` → assessed, accepted, closed; `accepted` → assessed, mitigating, closed; `closed` → identified. The first three are open. |
| Dimensions | schedule, cost, scope, quality, security, compliance, people |
| Categories | technical, external, organizational, project-management |
| Probability | 1 Rare, 2 Unlikely, 3 Possible, 4 Likely, 5 Almost certain |
| Impact | 1 Negligible, 2 Minor, 3 Moderate, 4 Major, 5 Severe |
| Score | `probability × impact` (the `risk.scoring` hook) |
| Levels | low 1–4, medium 5–9, high 10–14, critical 15–25 |
| Review | Open risks at level high or critical, and open overdue risks |

### Customize the model for a project

Copy `configs/collections/risk.json` to the same path in your project (`configs/collections/risk.json` under
`--root`) and edit it. The project file replaces the built-in definition completely; `risk model --json` shows which
one is used. It is validated fail-closed: an unknown key, a transition to an unknown status, a level list that does
not match the `level` vocabulary or does not cover every possible score, or an unknown hook stops every `risk`
command with the file name before anything is read or written. `configs/schemas/collection.schema.json` gives
editor completion.

Changing vocabularies does not rewrite existing notes. Run `risk check` afterwards: notes whose values left the
model, or whose stored score/level no longer match the new thresholds, are reported, and `risk update` refuses them
until they are fixed by hand.

## Checks

| Code | Severity | Meaning |
| --- | --- | --- |
| `COLLECTION_NOTE_UNREADABLE` | error | Malformed YAML, unsafe YAML, larger than 1 MB or not UTF-8 |
| `COLLECTION_FUTURE` | error | `schema_version` newer than this tool |
| `COLLECTION_ID`, `COLLECTION_STATUS`, `COLLECTION_VALUE`, `COLLECTION_REQUIRED`, `COLLECTION_VERSION` | error | A property is missing or outside the model |
| `COLLECTION_DERIVED` | error | Stored `score` or `level` differs from the model |
| `COLLECTION_DUPLICATE_ID` | error | Two notes share an id (case-insensitive) |
| `COLLECTION_OVERDUE` | warning | An open risk's `due` is before the reference date |
| `COLLECTION_OPEN_FIELD` | warning | An open risk has no `next-action` or `due` |

## Register

`risk report` writes `<folder>/risk-register.md`:

- a table of every valid risk, sorted by level, score and id, with links to the notes;
- a probability × impact matrix of open risks, each cell showing its score, level and risk ids;
- the overdue list, and the files that need attention.

The generated part sits between `<!-- risk-register:start sha256=… -->` and `<!-- risk-register:end -->`. Write your
own text above or below the markers; it is preserved byte for byte. A register without markers gets the block
appended. If the text between the markers no longer matches its recorded hash, the report stops with
`COLLECTION_REGISTER_EDITED` and nothing is written: move your text outside the markers or restore the block.

`--base` adds `risks.base`, an Obsidian Bases table (Obsidian 1.9 or later) over the `type: Risk` notes in the folder,
in the [fake-data Bases format](FAKE-DATA.md#the-bases-file). An existing `risks.base` with other content is never
replaced.

## Demo data

```sh
node bin/app fake-data --generation risks-demo --root <scratch-folder> --json   # then --apply <planHash>
node bin/app risk check --root <scratch-folder> --json
```

The `risk` fake-data preset writes 25 notes in this format into `docs/risks` (the default folder). They omit `score` and
`level`, which are computed on read, and their due dates fall in 2026, so some are reported as overdue warnings.
Inside the framework checkout `docs/` is a template input folder; generate into a scratch `--root`.

## Tests

| File | Covers |
| --- | --- |
| `src/cli/tests/interactive-maker-risk-domain.checks.mjs` | Definition and model validation, scoring, reading, create/update rules, transitions, id allocation, queries, register merging |
| `src/cli/tests/interactive-maker-risk-command.checks.mjs` | CLI routing, plan/apply, id reservation, preserving updates, hash guards, check/list/show, report preservation, project definitions, YAML safety |
| `src/cli/tests/interactive-maker-risk-wizard.checks.mjs` | The real `risk-new`, `risk-edit` and `risk-review` wizards with scripted plain prompts, the `paths.risks` setting and migration, and the fake-data preset passing `risk check` |
