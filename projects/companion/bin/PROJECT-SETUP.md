# Existing-vault Angular project setup

## Scope and result

This extension builds on PR #5's maker, project starters, Companion v6 document,
prototype interview, dedicated compiler and ownership-aware writer. It is not a
replacement generator and does not change framework `setup` behavior.

Use `project-setup` to prepare a new Angular **webapp** in an existing Git worktree
that is also an Obsidian vault. Setup runs the installed `webapp-angular` project
starter by ID, read from `configs/starters/` in the CLI package root like every starter;
extract the separate starters ZIP there first. Setup fails closed when that starter
is missing or does not select Angular with a webapp target. The shipped starter pins
Angular 22.0.0; `project.config.json` records the starter ID, version and SHA-256.
A release uses its tested starter definition, not an unreviewed live `latest`
dependency lookup. This change does not publish a release; use a kit built from the
implementing commit until shipment is separately approved.

After approval the project has a canonical editable specification, preserved PRD
source material, a project/product brief, persisted path/preferences settings, and
optionally a prototype package and generated application source. The default first
page is **Hello world**, with an entry flag and a `/` route in the specification.
The Angular generator compiles supported page/component definitions to standalone
AOT templates, including native elements, reusable instances, layouts, slots and
scoped interactions. Browser routes use the URL hash and restore on reload. See
[Angular application bricks](ANGULAR-BRICKS.md) for the exact supported semantics
and explicit external-adapter requirements. Entity/source/journey contracts do not
imply a backend or completed business behavior.

Preparation does not install dependencies, open a browser, run an AI provider,
activate an Obsidian plugin, modify Git configuration or claim a working build.
After successful file generation, the wizard separately offers a first run:
**Skip** (default), **Verify** (install, typecheck, test, build), or **Showcase**
(verify and serve the built app). Browser opening is an additional preference.
Execution always has its own review; file approval is not permission to run npm.
See [first-run choices and safety](FIRST-RUN.md).

## Human workflow

Keep the downloaded/extracted CLI kit intact, for example under
`<project>/tools/shell-cli/`. From the **project root**, run:

```sh
node tools/shell-cli/bin/app project-setup --root .
```

From a source checkout instead, run `node bin/app project-setup --root <vault>`.
Use the qualified Node 24.21.0/npm 11.19.1 toolchain. Source checks require the locked
repository TypeScript 6.0.3; framework kits carry compiled CLI modules and do not
require an implicit npm install to discover commands or prepare a plan.

The wizard checks the selected folder is itself the Git working-tree root and has
an existing, non-symlink vault configuration directory (`.obsidian` by default,
configurable through `preferences.vaultConfigDirectory`). Git worktree `.git` files
are accepted. Safe canonical paths handle Windows case/8.3 spellings without
accepting symbolic-link roots.
It cannot prove that Obsidian currently has the vault open. It never initializes
Git, edits `.obsidian`, enables plugins or changes Restricted Mode.

The interview proceeds through paths/preferences, project/product description,
PRD scan or add, optional prototype interview, optional application bricks,
optional boilerplate, and a final combined file-plan review. Optional preparation
and write approvals default to No; recursive scanning retains the saved preference.
Scan prints imported/ignored counts. Invalid input or cancellation does not
silently create partial setup files. At completed stages, **Save setup progress and
exit?** offers a separately reviewed checkpoint. Restart `project-setup` to resume
saved answers after settings/source fingerprints are checked; approvals are not
reused. See [checkpoint and recovery commands](CHECKPOINTS.md). An approved setup
can be inspected with `project-setup status`; execution results are in `first-run
status` rather than inferred from preparation metadata.

After selecting boilerplate, choose the separately reviewed first run in the wizard,
or start it later from the project root:

```sh
node tools/shell-cli/bin/app first-run
node tools/shell-cli/bin/app first-run status --json
```

The runner stops on the first failure and preserves generated source and completed
external effects. Showcase serves built files on localhost for a bounded foreground
session (five minutes by default), optionally opens the browser, and owns shutdown.
HTTP readiness alone is not visual or business acceptance.

Manual execution remains available instead of the managed first run:

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
| `paths.firstRunReport` | `reports/first-run.json` | Last recorded managed execution |
| `preferences.author` | `Your name` | Default author on a new project |
| `preferences.ui` | `auto` | `auto`, `tui` or `plain` presentation |
| `preferences.scanRecursive` | `true` | Include PRD subfolders |
| `preferences.vaultConfigDirectory` | `.obsidian` | Existing vault configuration directory |
| `preferences.firstRun` | See `FIRST-RUN.md` | Install strategy, browser choice, port and time bounds |
| `documentation` | Owner defaults when requested | Typed Markdown roots, per-type folders, index, scan and link preferences |

The settings form exposes report, host-directory, first-run and documentation options
under **Configure advanced paths and first-run preferences?**. Documentation settings
share this file: maker preference updates preserve that namespace, and the existing
documentation validator checks it before writes. Typed documentation follows
`paths.project` when exporting/importing a maker project, including after migration.
Authored-content preservation, conflict review and no implicit deletion cannot be
disabled. Legacy shell configuration and native host settings retain their own
contracts; this does not silently migrate every historical CLI option.

The schema has `schemaVersion: 1`. Partial settings requests merge over current
settings; a missing file uses defaults. Unknown keys, corrupt JSON and future
versions fail without resetting or overwriting the original bytes. A caller's
explicit CLI options override saved defaults for that invocation, without changing
the file. UI selection also respects `SHELL_UI` before the saved UI preference.

All configured paths are portable, non-overlapping, project-relative paths. Absolute
paths, `..`, backslashes, whitespace normalization, reserved Windows names, case
collisions, protected host/dependency/Git directories and symbolic links are refused.
The fixed discovery/metadata files are `configs/user-settings.json`,
`configs/project-setup.json`, `configs/project-setup-draft.json` and
`project.config.json`; they cannot relocate themselves.
There are no provider secrets or arbitrary executable commands in the settings.
Host/plugin `data.json`, project target selection, prototype answers and transient
terminal state retain their own existing contracts; they are not duplicated here.

```sh
node tools/shell-cli/bin/app settings
node tools/shell-cli/bin/app settings show --json
node tools/shell-cli/bin/app settings schema --json
node tools/shell-cli/bin/app settings --input settings-change.json --json
```

A settings mutation is a preview until repeated with its reviewed `--apply` hash.
Once setup metadata exists, use a reviewed path migration rather than a settings-only
rewrite. The interactive settings form selects a migration plan when application
paths change; agents explicitly call:

```sh
node tools/shell-cli/bin/app settings migrate --input paths.json --json
# Review file moves, then repeat with --apply <current-planHash>.
```

Migration preserves binary source and updates canonical PRD provenance/setup paths.
Destinations must be empty and outside old configured locations; stale inventory
invalidates approval. Dependency/build folders are retained at the old location and
must be reinstalled/rebuilt. Arbitrary hand-written links, historical run reports and
embedded generated snapshots are not rewritten as if requalified. Documentation
folder relocation uses its documentation workflow, not automatic source migration.
Preferences remain editable. Saved author changes affect future project creation,
not existing identity. Projects without this settings file retain legacy defaults.

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
node tools/shell-cli/bin/app project-setup schema --json
node tools/shell-cli/bin/app project-setup guide --json
node tools/shell-cli/bin/app project-setup scan --json
node tools/shell-cli/bin/app sketch schema --json
node tools/shell-cli/bin/app project-setup validate --input setup.json --json
node tools/shell-cli/bin/app project-setup --input setup.json --json
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
node tools/shell-cli/bin/app sketch
node tools/shell-cli/bin/app sketch show --json
node tools/shell-cli/bin/app sketch --input changes.json --json
node tools/shell-cli/bin/app sketch generate --json
node tools/shell-cli/bin/app prototype guide --json
node tools/shell-cli/bin/app prototype
node tools/shell-cli/bin/app project-setup status --json
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
model remains in generated `design/project.json`. Supported Angular visual bricks
render directly, while `design/angular-capabilities.json` identifies unsupported
provider/framework adapters by definition/node identity. Regeneration uses ownership receipts: it refuses to
replace edited source. After implementation changes, choose a fresh output directory
and reconcile deliberately rather than treating generation as a bidirectional editor.

## Qualification

Run `npm run typecheck:maker`, `npm run test:maker`, the compiled-kit/PTY tests,
production maker coverage, analyzer/architecture/maintainability gates and generated
Angular install/typecheck/test/build/browser checks with the qualified dependencies.
The new tests are discovered by the existing `interactive-maker-*.checks.mjs` suite;
no quality threshold is reduced. The implementation evidence is recorded separately
under `docs/testing/ANGULAR-PROJECT-SETUP.md` and
the Angular rendering verification record (maintainer-only asset, not included).
Earlier records retain their original candidate and environment; passing predecessor
checks are not assigned to a later commit. Setup status records preparation, not
continuous observation of external npm commands or browser acceptance.
