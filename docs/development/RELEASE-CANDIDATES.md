# Manage release items and release candidates

> Type: how-to guide and format reference · Part of the [docs index](../README.md)

A **release candidate** is a proposed product release: a version, a selection of **release items** (the product changes
it ships) and the documents a team reviews before deciding to release. `node bin/app release-item` keeps the release items,
`node bin/app candidate` assembles, freezes and documents candidates. Both store plain Markdown with YAML frontmatter
that Obsidian shows as properties, and every write is a reviewed, hash-approved file plan.

Release items are not the Increment documents of `node bin/app increment` ([manage increments](MANAGE-INCREMENTS.md)),
which plan delivery work, its pull requests and the Definition of Ready and Done. A release item records one product
change that a release candidate ships.

```text
release item notes ──candidate add──▶ candidate README ──status frozen──▶ release-approval process ──status qualified/released
(docs/releases/items)          (docs/releases/candidates/<version>/README.md)      (node bin/app process run)
                                                                                         repository release tooling (separate, maintainers)
```

Candidates document **product** release items. They never run the repository release tooling (`npm run release:cut`,
`npm run release:publish`), never tag, publish or push, and never edit `CHANGELOG.md`; the candidate README holds a
changelog *draft* that a maintainer copies by hand. Release authorization stays a separate, explicit decision.

## Quick start

```sh
node bin/app release-item new                         # guided: form, note preview, default-No review
node bin/app release-item edit --id ITEM-0001          # proposed → ready once acceptance criteria exist
node bin/app candidate new                         # version, target date, owner, ready release items, goal
node bin/app candidate add --version 1.0.0 --item ITEM-0002 --json          # plan; then --apply <planHash>
node bin/app candidate status --version 1.0.0 --to frozen --json
node bin/app process run --name release-approval   # the team's approval walk
node bin/app candidate status --version 1.0.0 --to qualified --json
node bin/app candidate docs --version 1.0.0 --json # regenerate the generated README blocks
node bin/app candidate check --json
```

`release-item new|edit|review` and `candidate new` are interactive (a TTY, no `CI`, `--json` or `--input`). Agents and
scripts use the machine commands below; every write prints a plan with a `planHash` and writes only when the same
command runs again with `--apply <planHash>`.

## Release items

Release items are a collection of the generic [note-collection engine](NOTE-COLLECTIONS.md), like the
[risk register](RISK-MANAGEMENT.md) and [learnings](LEARNINGS.md). The format is data in
[`configs/collections/release-item.json`](../../configs/collections/release-item.json): notes with `type: ReleaseItem`, ids
`ITEM-0001`, in the folder `paths.releaseItems` (default `docs/releases/items`).

| Field | Kind | Notes |
| --- | --- | --- |
| `title`, `summary` | text | Required; the summary is the changelog line |
| `kind` | choice | `feature`, `fix`, `improvement`, `docs`, `chore` (required) |
| `priority` | choice | `low`, `medium`, `high` (optional; high-priority open release items are reviewed) |
| `sources` | list | Where it came from: project paths such as `prototypes/<slug>`, `docs/design/<prototype>`, `brainstorms/<slug>/feature.definition.json`, a PRD such as `docs/prds/<name>.md`, or `RISK-`, `LRN-` and `ITEM-` ids. Paths must be portable, project-relative and outside protected folders (`.git`, `.obsidian`, `node_modules`, …); an id-shaped value must use one of those prefixes. Only the format is checked. |
| `acceptance` | list | Acceptance criteria; required while the release item is `ready` or `included` |
| `risks` | list | `RISK-0001` ids; summarized in the candidate README |
| `owner` | text | Optional |
| `proposed`, `target` | date | `proposed` defaults to today; a `ready` or `included` release item past `target` is overdue |
| `candidate` | text | **Managed**: the version that includes it, set only by `candidate` commands |
| `reviewed`, `shipped` | date | Stamps: the review walk and shipping date the notes |

| Status | Who sets it | Next (people) |
| --- | --- | --- |
| `proposed` | people (initial) | ready, dropped |
| `ready` | people | proposed, dropped |
| `included` | `candidate new`, `candidate add` | — (only `candidate remove` or abandoning returns it to ready) |
| `shipped` | `candidate status --to released` | — |
| `dropped` | people | proposed |

`included` and `shipped` are **managed statuses**: `release-item new|update --input` and the edit form refuse them,
and the `candidate` field is never accepted as input. That keeps the release item notes and the candidate READMEs in step.

```sh
node bin/app release-item list [--status ready] [--kind fix] [--priority high] [--overdue] --json
node bin/app release-item show --id ITEM-0001 --json
node bin/app release-item new --input release-item.json --json       # then --apply <planHash>
node bin/app release-item update --id ITEM-0001 --input changes.json --json
node bin/app release-item check --json
node bin/app release-item report --base --json                    # <releaseItems>/release-items.md and release-items.base
```

`release-item.json` uses input names: `{"title":"Checkout redesign","summary":"A two-step checkout.","kind":"feature",
"status":"ready","sources":["prototypes/checkout","RISK-0001"],"acceptance":["Payment completes in two steps"]}`.

## Release candidates

Each candidate is one folder named after its version in `paths.releaseCandidates` (default `docs/releases/candidates`):
`docs/releases/candidates/1.0.0/README.md`. Versions are strict `x.y.z` or `x.y.z-rc.N` without leading zeros
(`1.0.0`, `1.2.0-rc.1`). Other files in the folder (notes, attachments) are yours and never read or changed.

### README format

```yaml
---
type: "ReleaseCandidate"
version: "1.0.0"
status: "frozen"
created: "2026-10-04"
updated: "2026-10-05"
target-date: "2026-11-01"
owner: "Alex"
items:
  - "ITEM-0001"
  - "ITEM-0002"
schema_version: 1
frozen: "2026-10-05"
---
```

`frozen` is dated when a draft is frozen (and removed when it returns to draft); `released` is dated on release.
Unknown properties are kept. A newer `schema_version` makes the candidate read-only.

The body has authored sections (**Goal**, **Notes** and anything you add) and four generated blocks between
hash-stamped markers, under the headings **Release items**, **Risks**, **Release checklist** and **Changelog draft**:

| Block | Contents |
| --- | --- |
| `candidate-items` | Status line, then a table of each release item: id (linked to its note), title, kind, status, summary, sources, acceptance; ids without a valid note are listed as not found |
| `candidate-risks` | The `RISK-` ids the release items link, with title, status and level from the risk notes in `paths.risks`; missing ids and open high or critical risks are called out |
| `candidate-checklist` | Computed checks: release items present and valid, acceptance criteria, sources, linked risks, `candidate check` errors, frozen, qualified through the release-approval process, released by the separate repository tooling |
| `candidate-changelog` | A [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) draft: `feature` → Added, `fix` → Fixed, other kinds → Changed |

Regeneration (`candidate docs`, and every `add`, `remove` and `status` plan) replaces only those blocks; text outside
the markers keeps its exact bytes, and unchanged frontmatter keeps its formatting. A block whose text no longer matches
its hash was edited by hand: the plan stops (`COLLECTION_REGISTER_EDITED`) and nothing is written. Move your text
outside the markers or restore the block. A missing block is appended at the end.

### Lifecycle

| Status | Release items | Next |
| --- | --- | --- |
| `draft` | `add` and `remove` allowed | frozen, abandoned |
| `frozen` | locked | draft, qualified, abandoned |
| `qualified` | locked | released, frozen, abandoned |
| `released` | moved to `shipped` (dated) in the same plan | — |
| `abandoned` | its included release items return to `ready` without a candidate | — |

Freezing needs at least one release item. Freezing, qualifying and releasing are refused while `candidate check` reports
an error for the candidate (for example a listed release item that is missing or names another candidate). Released and
abandoned candidates are records: `candidate docs` refuses to regenerate them.

### Commands

```sh
node bin/app candidate new --version 1.0.0 [--input candidate.json] --json
node bin/app candidate list --json
node bin/app candidate show --version 1.0.0 --json
node bin/app candidate add --version 1.0.0 --item ITEM-0001 --json
node bin/app candidate remove --version 1.0.0 --item ITEM-0001 --json
node bin/app candidate status --version 1.0.0 --to <draft|frozen|qualified|released|abandoned> --json
node bin/app candidate docs --version 1.0.0 --json
node bin/app candidate check --json
```

`candidate.json` may hold `version` (must equal `--version` when both are given), `targetDate`, `owner`, `items`
(ready release item ids to include) and `goal` (the initial Goal section). Every write is **one** plan over the README and
each release item note it moves, applied together: `candidate add` sets the release item's `candidate` and moves it to
`included`; `remove` returns it to `ready`. If any file changed after review, the plan is refused and nothing is written.
`--as-of <YYYY-MM-DD>` fixes the reference date for reproducible plans.

### Check findings

| Code | Severity | Meaning |
| --- | --- | --- |
| `CANDIDATE_VALUE`, `CANDIDATE_UNREADABLE`, `CANDIDATE_FUTURE` | error | The README frontmatter is invalid, unreadable or newer than this tool |
| `CANDIDATE_FOLDER` | error | The folder name differs from `version` |
| `CANDIDATE_INCREMENT_MISSING` | error | A listed id has no valid release item note |
| `CANDIDATE_INCREMENT_UNLINKED` | error | A listed release item is not `included` (or `shipped` once released) in this version |
| `CANDIDATE_INCREMENT_ORPHAN` | error | A release item names a candidate that does not list it, or is included/shipped without one |
| `CANDIDATE_INCREMENT_SHARED` | error | Two live candidates list the same release item |
| `CANDIDATE_DOCS_EDITED` / `CANDIDATE_DOCS_MISSING` | error / warning | A generated block was edited by hand or is missing |
| `CANDIDATE_NO_ACCEPTANCE`, `CANDIDATE_NO_SOURCES` | warning | An included release item lacks acceptance criteria or sources |
| `CANDIDATE_RISK_MISSING`, `CANDIDATE_RISK_OPEN` | warning | A linked risk has no note, or is open at high or critical level |
| `CANDIDATE_CHANGED_AFTER_FREEZE` | warning | A release item note changed after the candidate froze |
| `CANDIDATE_OVERDUE`, `CANDIDATE_EMPTY` | warning | Past its target date, or no release items yet |

Warnings never fail a check. Abandoned candidates are historical records and are not linked to their release items.

## From candidate to release

1. **Release items.** Capture changes as release items from their origin (a prototype, design folder, brainstorm, PRD,
   risk or learning) and move them to `ready` once their acceptance criteria are agreed.
2. **Candidate.** `candidate new` selects ready release items; `add` and `remove` adjust the draft. `candidate check`
   and the computed checklist show what is missing.
3. **Freeze.** `candidate status --to frozen` locks the release item list. Later edits of an included release item are
   reported as `CANDIDATE_CHANGED_AFTER_FREEZE`.
4. **Approve.** Walk the [release-approval business process](BUSINESS-PROCESSES.md)
   (`node bin/app process run --name release-approval`): checks with honest untested scope, review, and an explicitly
   requested publication. When it approves, `candidate status --to qualified`.
5. **Release.** The repository release itself (version preparation, changelog, `release:cut`, `release:publish`) is a
   separate, maintainer-run toolchain with its own authorization; candidates never invoke it. Once the release is out,
   `candidate status --to released` ships the release items and dates the candidate, and the changelog draft is copied
   into `CHANGELOG.md` by hand if it was not already.

## Choose the folders

`paths.releaseItems` and `paths.releaseCandidates` are user settings, edited with `node bin/app settings` (fields
**Release items folder** and **Release candidates folder**) or `settings --input`. Both are optional (the defaults are
used and existing settings keep their bytes), validated like every settings path (relative, inside the project,
outside protected folders, not overlapping another path) and moved with `node bin/app settings migrate`.

## Fake data

`node bin/app fake-data --generation release-items-demo --json` plans 20 release items (proposed, ready and dropped) in
`docs/releases/items` with a `release-items.base` table; `candidate new --input` can include the ready ones.

## Engine additions

Release items needed three generic [note-collection engine](NOTE-COLLECTIONS.md) features: the `accepts` field option
(project paths, release versions and id prefixes), the `managed` field source and `managed` statuses with
`collectionManagedUpdate`, and `mergeCollectionBlock`, the register's marker merge for any named generated block.
The candidate modules are `src/cli/domain/release-candidate*.ts`, `src/cli/adapters/release-candidate-*.ts` and the
`candidate-new` wizard (`src/cli/presentation/wizards/release-candidate.ts`, `configs/wizards/candidate-new.json`,
`configs/forms/candidate.json`).
