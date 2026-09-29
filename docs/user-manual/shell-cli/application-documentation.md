# Maintain application documentation as typed Markdown

Workbench can import application documentation into its existing project model and
export that model as a navigable Markdown tree. These operations edit the same
pages, component definitions, node-bound interactions and journeys used by the
editors and generator. They do not create a separate executable documentation model.

## Start from a configured project

Use an existing project containing `shell.config.json` and `design/project.json`.
For a new project, complete `node shell.mjs setup` first. Interactive extracted-kit
setup offers documentation import before source generation, and a separately
approved documentation export. Headless commands never prompt or install packages.

The safest first authoring step is to export the project you already have:

```sh
node shell.mjs docs export --dry-run --plan-out docs-export.plan.json --json
node shell.mjs plan inspect docs-export.plan.json
node shell.mjs plan apply docs-export.plan.json --yes
```

The saved plan binds application to the reviewed request and inputs. Alternatively,
pass the preview's `planHash` through `--apply`, with the same input/output options. `--yes` alone approves a freshly rebuilt
plan, not a previously reviewed snapshot. Saved plans also work through the existing
`--plan-out`, `plan inspect` and `plan apply` operations.

The first successful operation creates defaults in `configs/user-settings.json`
when that file does not exist. An existing settings file, including unrelated
preferences, is not rewritten. Synchronization metadata lives in
`design/docs-index.json`; keep it with the project to support conflict detection.

## Resulting structure

Default output resembles this; only nonempty entity families create documents:

```text
configs/user-settings.json
design/project.json
design/docs-index.json
docs/application/
  project.md
  pages/
  components/
  interactions/
  journeys/
  routes/
  transitions/
  layouts/
  component-revisions/
  library-components/
  features/
  prds/
  generated/index.md
```

Open `generated/index.md` for navigation. New filenames combine the title, stable
identity and a short collision-resistant suffix. Once registered, filenames do not
change on title edits. Renaming or moving a file within the configured scan roots
preserves its identity on the next import. Duplicate declarations are errors, including
single-file imports of a copy while the original registered document still exists.

A complete export verifies that its projection can reconstruct the entire validated
project. Subsystems without individual document adapters remain in the project's
explicit structured context. This preserves their data; it does not claim that
finished prose documentation was generated for every subsystem. Business actions,
acceptance criteria and implementation TODOs are never invented from prose.

## Edit and import documents

Each typed document needs `doc_schema: 1`, `type`, `id`, `project` and `title` in YAML
frontmatter. `project` must match the configured project identity. Use exported IDs
when updating existing elements. `docs schema --json` lists types and managed fields.

A minimal new page may be authored as:

```markdown
---
doc_schema: 1
type: page
id: node-40
project: documentation-demo
title: Project overview
surface_kind: view
doc_status: draft
custom_owner: Product team
---

# Project overview

## Purpose

Help the user inspect the current project.

## Acceptance criteria

Document the expected behavior here.
```

Use your actual project ID and a unique element ID. A title-only page is a design
surface, not a fabricated completed UI. Starting from an exported visual page or
component is preferable when defining layouts, props, slots, instances and events.
Simple managed values belong in frontmatter; complex values belong in one fenced
block whose exact language/info string is `yaml shell-data` or `json shell-data`.
An ordinary YAML example is not interpreted as application data.

```sh
node shell.mjs docs validate docs/application --json
node shell.mjs docs import docs/application --dry-run --plan-out docs-import.plan.json --json
node shell.mjs plan apply docs-import.plan.json --yes
```

One file, multiple files, or folders may be supplied. Omitting paths scans configured
documentation locations. Discovery indexes all identities before resolving references.
Import is additive: selecting a folder or omitting a file does not delete project
elements. A malformed declared document fails rather than being silently skipped.

Unrelated Markdown notes are reported as skipped. Importing an external folder
copies selected documentation, ordinary notes and supported assets into the project,
preserving relative structure and leaving originals untouched. Asset types are PNG,
JPEG, WebP, GIF, SVG and PDF. They are copied as bytes, never rendered or executed.
Referenced remote resources are not fetched, and links outside the selected folder
are not automatically copied. Review external destination collisions explicitly.

## Identity and model mapping

| Type | Managed representation |
| --- | --- |
| `page` | Surface identity/kind plus optional `visual_id`; `surface` and `visual` payloads preserve both objects. |
| `component` | Visual component identity plus `library_id` and `export_name`; library and visual payloads remain linked. |
| `interaction` | `owner_type`, `owner_id`, `source_node_id`, `event`, and ordered `position`; the payload contains actions, notes and acceptance. |
| `journey` | Ordered `steps` containing IDs, real surface references and incoming transition IDs in `via`. |

Interactions must attach to an existing event-capable UI node. They are not detached
top-level runtime records. Editable events must not be duplicated inside page or
component payloads; separate interaction documents are reassembled into their native
locations. Journey import never infers navigation from page names. Published
component revisions cannot be changed or removed by importing edited documentation.

## Preserve authored text and resolve conflicts

Custom frontmatter, comments and body prose remain in Markdown. Only managed
properties and the explicit data block are synchronized. No-op operations preserve
file bytes and modification times. Obsolete managed properties are removed when the
corresponding project field disappears, without deleting adjacent custom properties.

```sh
node shell.mjs docs status --json
```

The index records the previous semantic baseline. Markdown-only changes import;
project-only changes can export or be reconciled by import. Independent field edits
can merge. Ordered arrays are conflict units. Different changes to the same field
block writes. With no baseline, existing differences also require a decision.
An export refuses to replace Markdown that is ahead of the project: import first.
Include/exclude patterns limit discovery, not overwrite protection: an existing
output document still receives identity and conflict checks even when excluded.

The structured conflict report supplies an entity key and JSON-pointer field.
Combine them as `entity#/field` in a resolution JSON file, for example:

```json
{
  "page:node-1#/title": "markdown"
}
```

Each value must be `markdown` or `project`; there is no silent global winner.

```sh
node shell.mjs docs import --resolutions docs-resolutions.json --dry-run --plan-out docs-resolved.plan.json --json
node shell.mjs plan apply docs-resolved.plan.json --yes
```

Stale or unused resolution keys fail. Missing bound documents and edited generated
regions remain protected; field resolutions do not authorize deleting files or
claiming ownership of unrelated content. Restore a missing file or move it into a
configured scan root before retrying.

## Configure paths

Merge a `documentation` section into `configs/user-settings.json` with
`schemaVersion: 1`. Omitted settings use safe defaults:

```json
{
  "schemaVersion": 1,
  "documentation": {
    "root": "docs/application",
    "indexFile": "design/docs-index.json",
    "paths": {
      "pages": "docs/application/pages",
      "components": "docs/application/components",
      "interactions": "docs/application/interactions",
      "journeys": "docs/application/journeys",
      "prds": "docs/prds"
    },
    "recursive": true,
    "include": ["**/*.md"],
    "exclude": ["**/generated/**"],
    "linkFormat": "markdown",
    "preserveAuthoredContent": true,
    "conflictPolicy": "review",
    "deleteMissing": false
  }
}
```

`linkFormat` can also be `wikilink`. Paths are project-relative, portable and outside
protected source, test, dependency and host directories. Hidden path segments are
not supported for documentation; invalid locations fail before creating bindings.
Safety switches must be booleans (`preserveAuthoredContent: true` and
`deleteMissing: false`), not string equivalents. Source/test configuration
must still use the existing project configuration workflow. Documentation import
cannot silently relocate those roots. `docs export --out <folder>` chooses locations
for new documents/navigation but does not move registered files or rewrite settings.

## Failure and recovery

Only bounded regular files are read. Named pipes, devices, symlinks and other
non-regular inputs are refused rather than opened as documentation.

Preview performs no writes unless `--plan-out` explicitly requests a saved plan.
Apply rebuilds the plan and checks source, settings, discovery, outputs and ownership
before writing. Writes use the shared lock and preimage staging; the synchronization
index is written last. Normal write failures trigger rollback. Process termination
may leave `.codex-authoring.lock` with a documentation journal and staged preimages.

```sh
node shell.mjs docs recover --dry-run --json
```

Apply with `docs recover --apply <recoveryHash> --yes`, substituting the reported
64-character `recoveryHash`, not a generation plan hash. Recovery refuses a live
writer, changed files, missing/modified preimages or an unrelated lock. Never delete
the lock blindly to make an error disappear. This provides checked process-interruption
recovery, not a power-loss/fsync or whole-directory atomicity guarantee.

There is no implicit watcher, deletion synchronization, Markdown-to-business-code
inference, permissive ID remapping, or automatic adoption of legacy untyped notes.
These commands do not install dependencies, launch a native host, publish or merge.
