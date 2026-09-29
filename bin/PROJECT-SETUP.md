# Existing-vault Angular project setup

## Scope and result

This extension builds on PR #5's maker, project presets, Companion v6 document,
prototype interview, dedicated compiler and ownership-aware writer. It is not a
replacement generator and does not change legacy `new`/framework `setup` behavior.

Use `project-setup` to prepare a new Angular **webapp** in an existing Git worktree
that is also an Obsidian vault. The selected preset is the existing
`webapp-vanilla` with the explicitly supported `angular` framework override.
The current catalog pins Angular 22.0.0. A release uses its tested catalog, not an
unreviewed live `latest` dependency lookup. This change does not publish a release;
use a kit built from the implementing commit until shipment is separately approved.

After approval the project has a canonical editable specification, preserved PRD
source material, a project/product brief, persisted path/preferences settings, and
optionally a prototype package and generated application source. The default first
page is **Hello world**, with an entry flag and a `/` route in the specification.
The existing Angular generator projects a navigable page list. A route, layout,
entity, data-source or journey specification is not proof that its complete business
behavior, Angular routing or visual design has been implemented.

Preparation does not install dependencies, open a browser, run an AI provider,
activate an Obsidian plugin, modify Git configuration or claim a working build.
The final development-readiness check remains explicit: install, typecheck, test,
build/start, and inspect the application in a browser.

## Human workflow

Keep the downloaded/extracted CLI kit intact, for example under
`<project>/tools/shell-cli/`. From the **project root**, run:

```sh
node tools/shell-cli/shell.mjs project-setup --root .
```

From a source checkout instead, run `node shell.mjs project-setup --root <vault>`.
Use the qualified Node 24.21.0/npm 11.19.1 toolchain. Source checks require the locked
repository TypeScript 6.0.3; release kits carry compiled CLI modules and do not
require an implicit npm install to discover commands or prepare a plan.

The wizard checks the selected folder is itself the Git working-tree root and has
an existing, non-symlink `.obsidian` directory. Git worktree `.git` files are accepted.
It cannot prove that Obsidian currently has the vault open. It never initializes
Git, edits `.obsidian`, enables plugins or changes Restricted Mode.

The interview proceeds through paths/preferences, project/product description,
PRD scan or add, optional prototype interview, optional application bricks,
optional boilerplate, and a final combined file-plan review. Optional preparation
and write approvals default to No; recursive scanning retains the saved preference.
Scan prints imported/ignored counts. Invalid input or cancellation does not
silently create partial setup files. Cancellation exits the wizard; there is no
persisted partially answered wizard or cross-session step-resume in this extension.
An approved setup can be inspected with `project-setup status`.

When boilerplate was selected:

```sh
cd apps/product
npm install
npm run typecheck
npm test
npm start
```

Replace `apps/product` with the configured path. `npm install` is a deliberate
network/dependency execution step: review the package first. The generated lock is
root-only, not a resolved graph; inspect and commit the resolved lock before using
`npm ci` in another environment. `npm start` builds and serves the browser output
on `127.0.0.1:4173`; `PORT` can override that port. The server refuses an occupied
port, has no public-network binding, and stops on SIGINT/SIGTERM. Restart to rebuild
after editing source: this is **not** a hot-reload development server.

## Settings contract

`configs/user-settings.json` is created by the approved setup or settings command,
not by schema discovery, scans or previews. See [the full example](examples/user-settings.json).

| Key | Default | Meaning |
| --- | --- | --- |
| `paths.prds` | `docs/prds` | Typed Markdown intake folder |
| `paths.project` | `design/project.json` | Canonical Companion v6 specification |
| `paths.prototypes` | `prototypes/project` | Prepared prototype package |
| `paths.app` | `apps/product` | Generated application source |
| `paths.brief` | `docs/project-brief.md` | Project/product brief |
| `preferences.author` | `Your name` | Default author on a new project |
| `preferences.ui` | `auto` | `auto`, `tui` or `plain` presentation |
| `preferences.scanRecursive` | `true` | Include PRD subfolders |

The schema has `schemaVersion: 1`. Partial settings requests merge over current
settings; a missing file uses defaults. Unknown keys, corrupt JSON and future
versions fail without resetting or overwriting the original bytes. A caller's
explicit CLI options override saved defaults for that invocation, without changing
the file. UI selection also respects `SHELL_UI` before the saved UI preference.

All configured paths are portable, non-overlapping, project-relative paths. Absolute
paths, `..`, backslashes, whitespace normalization, reserved Windows names, case
collisions, protected host/dependency/Git directories and symbolic links are refused.
The fixed discovery/metadata files are `configs/user-settings.json`,
`configs/project-setup.json` and `project.config.json`; they cannot relocate themselves.
There are no provider secrets or arbitrary executable commands in the settings.
Host/plugin `data.json`, project target selection, prototype answers and transient
terminal state retain their own existing contracts; they are not duplicated here.

```sh
node tools/shell-cli/shell.mjs settings
node tools/shell-cli/shell.mjs settings show --json
node tools/shell-cli/shell.mjs settings schema --json
node tools/shell-cli/shell.mjs settings --input settings-change.json --json
```

A settings mutation is a preview until repeated with its reviewed `--apply` hash.
Once setup metadata exists, changing configured paths requires an explicit migration
outside this feature; the settings command does not move files or leave stale
references. Preferences remain editable. Saved author changes affect future project
creation, not existing identity. Existing projects without the settings file retain
their legacy default paths.

## PRD intake contract

Copy typed Markdown into the configured intake folder. A minimal record is:

```markdown
---
type: prd
id: PRD-ISSUES
title: Issue desk
---

# Requirements

Preserve this text and all other frontmatter as source material.
```

[Example PRD](examples/product-prd.md). The reader intentionally understands only
scalar `type`, `id` and `title` identity fields; it is not a general YAML parser.
`type: prd` is case-insensitive. JSON-compatible double quotes, YAML-style single
quotes and scalar comments are accepted. Multiline blocks, aliases, tags and
collections for identity fields fail explicitly. Additional frontmatter and body
content remain verbatim, including original BOM/newline bytes. Missing `id` and
`title` use a portable filename-derived ID and filename title. Duplicate IDs fail.

A scan ignores untyped/non-PRD Markdown and reports it; it does not guess that all
Markdown files are requirements. Explicit add requires typed PRDs. Sources from
elsewhere **inside** the selected vault are copied, not moved; imported files never
replace different existing PRDs. Agent input may instead supply inline Markdown
with a simple `.md` filename. Neither mode follows symbolic links or downloads URLs.

Current limits match the canonical project: at most **12 PRDs**, each at most
**250,000 UTF-8 bytes**, a scan of at most 2,000 directory entries and depth 20.
PRDs are stored with source path/hash provenance and `intake: unmapped`; requirement
mapping, semantic extraction and implementation are not invented by intake.

## Agent protocol and approval

All discovery/reading can run without a terminal. `--json`, `--input`, CI and
`--no-interaction` prevent prompts. Stdout contains one versioned JSON envelope;
progress/prompts use stderr. Inspect `data.status` and diagnostics, not just exit 0
(a successful preview is not an applied setup). Exit 1 indicates failure; cancellation
uses 130. No `--yes` approval bypass is added.

```sh
node tools/shell-cli/shell.mjs project-setup schema --json
node tools/shell-cli/shell.mjs project-setup guide --json
node tools/shell-cli/shell.mjs project-setup scan --json
node tools/shell-cli/shell.mjs sketch schema --json
node tools/shell-cli/shell.mjs project-setup validate --input setup.json --json
node tools/shell-cli/shell.mjs project-setup --input setup.json --json
```

Start from [the request example](examples/angular-setup.json). Set
`prototypeInterview: null` to skip preparation, or submit the discovered guide's
ID/version plus approved answers. Setting `approved: true` is an explicit design
agreement, separate from authorizing file writes. `operations: []` and
`boilerplate: false` skip their respective optional branches. Do not fabricate user
approval of a brief or file plan. The CLI does not enforce an external human identity;
agent hosts remain responsible for their permission policy.

The preview response has `data.document`, `data.changes` (paths/status/before/after
hashes), `data.planHash`, selection, source records and readiness flags. Review those
results. Repeat the same command with the same input and `--apply` set to the exact
`data.planHash` value. Stdin JSON is supported via `--input -`.

This is one composed, reviewed plan using the shared safe writer, not several wizard
writes. It preserves `.git`, `.obsidian`, PRD source bytes and unrelated files. The
writer checks preimages, refuses conflicts, serializes cooperating writers and
rolls back completed writes on failure. PRD inventory and prerequisites are checked
again before writing, including newly added/removed scan sources. It is not a claim
of universal cross-process filesystem atomicity. Inspect recovery after an uncertain
write; never blindly replay authorization.

Reapplying the identical initial request against an unchanged, approved setup yields
an unchanged plan. Changed setup requests or pre-existing project/brief conflicts
are refused rather than replacing an existing project. After editing the project,
continue authoring instead of rerunning initialization.

## Further brick authoring

```sh
node tools/shell-cli/shell.mjs sketch
node tools/shell-cli/shell.mjs sketch show --json
node tools/shell-cli/shell.mjs sketch --input changes.json --json
node tools/shell-cli/shell.mjs sketch generate --json
node tools/shell-cli/shell.mjs prototype guide --json
node tools/shell-cli/shell.mjs prototype
node tools/shell-cli/shell.mjs project-setup status --json
```

These commands use saved project/output paths, and generation/prototype preparation
retain the Angular selection. In the studio, application output and prototype output
are separate defaults. An explicit `--out` on the standalone command overrides its
default. UI and agent operations use the same clone/validate/commit executor and
canonical document. `show` exposes IDs, sitemap, entities, sources, journeys and PRDs.

The shared brick editor adds/renames pages, changes stack/row/grid layouts,
adds/renames/attaches reusable components, manages sitemap groups/parents/routes/
navigation links, adds entities and replaces their property lists, adds data-source
specifications, renames entities/sources, and adds ordered journeys. Existing page
editing continues to provide component placement/removal/reordering and interaction
editing. Not every canonical field or destructive operation has a wizard action;
this is not a full CRUD or visual-editor replacement. `sketch schema` is the exact
supported operation catalog. Transaction-local `@aliases` reference newly created
records without guessing IDs; existing records use IDs obtained from `show`.

A journey references available navigation only when unambiguous; it does not invent
working actions. A `vault`, `api` or `database` source is a specification, not an open
connection, credential store, backend or generated CRUD implementation. The complete
model remains in generated `design/project.json`, even where the starter only renders
a simpler page projection. Regeneration uses ownership receipts: it refuses to
replace edited source. After implementation changes, choose a fresh output directory
and reconcile deliberately rather than treating generation as a bidirectional editor.

## Qualification

Run `npm run typecheck:maker`, `npm run test:maker`, the compiled-kit/PTY tests,
production maker coverage, analyzer/architecture/maintainability gates and generated
Angular install/typecheck/test/build/browser checks with the qualified dependencies.
The new tests are discovered by the existing `interactive-maker-*.checks.mjs` suite;
no quality threshold is reduced. The implementation evidence is recorded separately
under `docs/testing/ANGULAR-PROJECT-SETUP.md`. Setup status records preparation, not
continuous observation of external npm commands or browser acceptance.
