# Obsidian Plugin Shell

**Runtime authoring milestone — event contracts and reference items, version 0.4.0.**

A TypeScript/Vue/Pinia plugin with typed entity definitions, separate document
recipes, Markdown CRUD and explicit plugin-data entities. Task is an optional example;
Project proves reuse with number/boolean fields. The existing native view, typed
events, shared preferences, scoped Nuxt UI styling and real-component harness
remain. This is a template-foundation milestone, not completion of the full PRD.

## Build on the template

Start in [src/features](src/features/README.md). Define business data and actions;
the shared services own persistence, native integration, feedback and cleanup.

| Concern | Author-facing entry point |
| --- | --- |
| Entities and repositories | [Build a feature](docs/development/BUILD-A-FEATURE.md), `src/features/api.ts`, and `src/bootstrap/features.ts` |
| Obsidian commands and ribbon icons | [Commands and ribbon](docs/development/COMMANDS-AND-RIBBON.md), feature command factories, and `src/bootstrap/commands.ts` |
| Native dialogs and notices | [Modal and notice services](docs/development/MODALS-AND-NOTICES.md): `services.modals` and `services.notices` |
| Logging and debugging | [Logging and debugging](docs/development/LOGGING-AND-DEBUGGING.md): `services.logger`, typed catalogs and explicit debug commands |
| Vue markup and TypeScript behavior | [Presentation structure](docs/development/PRESENTATION-STRUCTURE.md): components, composables, stores and context |
| Scaffolding and identity | [Authoring tools](docs/development/AUTHORING-TOOLS.md) and [reviewed setup](docs/development/SETUP-IDENTITY.md) |
| Plugin-data entities | [Typed CRUD and shared persistence](docs/development/PLUGIN-DATA-ENTITIES.md) |
| Event contracts and subscriptions | [Typed event authoring](docs/architecture/EVENT-BUS.md), `events:catalog` and `events:check` |
| Removing demonstrations | [Reviewed example removal](docs/development/EXAMPLE-REMOVAL.md) |
| Maintenance and packaging | [Freshness reporting](docs/development/MAINTENANCE-OPERATIONS.md) and [fixed-candidate rehearsal](docs/development/RELEASE-REHEARSAL.md) |

**Qualification:** See the [runtime-authoring record](docs/testing/RUNTIME-AUTHORING.md)
and historical [iteration 04 verification record](docs/testing/ITERATION-FOUR.md)
for actual execution scope. Whole-production coverage is a blocking gate,
with an independent stricter domain/application/features gate. The official Obsidian lint
integration still installs nested ESLint 9.39.5; zero audit findings do not close
that [upstream support exception](docs/development/ITERATION-TWO-DEPENDENCY-EXCEPTION.md).
Iteration 03 was merged as PR #3 on 2026-09-23. No public release was published.

## Open it in Obsidian

Use the selected Node **24.21.0** and npm **11.19.1** (check both independently), open the repository directory, and run:

```sh
npm run setup
```

Setup starts without dependencies, reviews identity and file changes, installs the
exact lockfile, and runs verification. The default profile is browser-first. To
also install the three assets into the contained test vault, use:

```sh
npm run setup -- --profile native
```

The native profile copies only `main.js`, `manifest.json`, and `styles.css` into:

```text
.dev-vault/.obsidian/plugins/<your-plugin-id>/
```

Open `.dev-vault` in desktop Obsidian, deliberately enable your plugin, then run
**Open capability showcase** or use the Blocks ribbon button. The initial identity
is Plugin Shell. The host minimum remains **1.13.7**, desktop-only pending mobile
qualification. Setup does not change Restricted Mode or create Task notes.

Identity flags, data-only answers, dry-run/JSON, `--resume`, and explicit
disabled-plugin data migration are documented in [Setup and identity](docs/development/SETUP-IDENTITY.md).
View/DOM/CSS/storage namespaces follow the manifest identity. Setup preserves user
files, notes, unrelated plugins and Git remotes.

For a prebuilt ZIP, read its plugin ID from the packaged `manifest.json`, disable
that installation, and replace only its three assets in
`<test-vault>/.obsidian/plugins/<manifest-id>/`. Preserve `data.json`, notes and
unrelated plugin files. Renaming the folder alone does not migrate plugin identity.
Do not confuse the source ZIP with the installable plugin.

## Hide or restore the native header

Open **Preferences → Hide Obsidian view header**. It defaults to off, persists, and
affects only this plugin's leaves. Restore it here, through the plugin's named
native settings section (**Plugin Shell** before renaming), or with **Toggle
Obsidian view header** in the command palette. The plugin breadcrumb and **View
actions** menu remain visible; workspace tabs and OS controls are untouched.

## Develop in the browser

```sh
npm run dev:ui
```

Open the printed loopback address at `/harness/app/`. This runs the same Vue/Nuxt UI components, application services, event bus, and styles with synthetic browser-backed storage and host adapters. It does not access your personal vault. Use `npm run dev` for complete staged rebuilds without installation, or `npm run dev:local` for successful-build installation into the development vault, then reload the plugin manually.

## Explore four panels

| Panel | Working behavior |
| --- | --- |
| Overview | Nuxt UI capability cards, environment information, and entry to document creation/native modal. |
| Documents | Preview/create a Task note; load existing notes, edit title/status/due/tags with revision checks, and explicitly move a note to reversible trash. |
| Events & feedback | Inspect safe event/diagnostic summaries, show owned feedback/native notices, and try info, confirmation and validated text-prompt dialogs without changing notes. |
| Preferences | English/German, Task folder, routine-success notices and **Hide Obsidian view header** through one validated writer. The header toggle applies immediately. Native settings use the same service. |

Markdown is canonical for note-backed entities. Explicit plugin-data entities share
one serialized writer with preferences, without duplicating note-backed records.
The Documents panel also contains the optional **Items** example: create, rename
and permanently delete plugin-data items with stable IDs and trimmed 1–120-character
labels. Views keep separate drafts and refresh committed rows through typed facts.
Reload and review stale edits; an uncertain save requires investigation and a
runtime restart before another deliberate write. Items never create vault notes.
Preview never writes. Editing preserves the note path, ID, creation time,
handwritten body and unrelated properties. Stale revisions require explicit reload;
uncertain outcomes are never blindly retried. Native trash is reversible but has no
cross-process compare-and-delete transaction. Views own drafts and cleanup;
repositories/events are runtime-scoped.

Start building in [src/features](src/features/README.md): define business fields,
an optional document recipe, and add one typed registration entry. The template
wires repositories and lifecycle for you. See [Build a feature](docs/development/BUILD-A-FEATURE.md),
the [API/compatibility guide](docs/development/ITERATION-THREE.md)
and [implementation plan](docs/development/ITERATION-THREE-PLAN.md). No generic service
needs a Task-specific branch.

## Verify

```sh
npm run verify
npm run test:coverage
npm run test:coverage:production
node node_modules/@playwright/test/cli.js install chromium
npm run test:e2e
npm run check:security
```

The current `verify` runs the build, strict runtime/Vue/harness/test types, both
linters, source/locale/architecture/presentation checks, the zero-finding analyzer,
Vitest and coverage gates, token/artifact checks, the retained repeated Node
baseline, and harness build. Served E2E is explicit and separate. This is not the
complete PRD release gate. See the [current test record](docs/testing/ITERATION-FOUR.md)
for actual execution results and coverage scope.

`npm run help` lists commands. Setup dry-run works without project dependencies and
does not write, install or access the network. `--yes --no-interaction` applies the
reviewed options; `--no-local` remains a browser-profile alias.

After setup, generate ordinary feature source and real CRUD tests:

```sh
npm run make -- feature bookmarks --entity bookmark --dry-run
npm run make -- feature bookmarks --entity bookmark --yes --no-interaction
npm run entities:catalog
```

The catalog includes composed features, entities, views, components, stores,
usecases, commands, modals, settings, events, listeners, styles, locale drafts and
explicit local custom makers. They preserve edited files and never create user notes.
See [Authoring tools](docs/development/AUTHORING-TOOLS.md) for the supported catalog.
The [runtime services](docs/development/RUNTIME-SERVICES.md) include eight normalized
host mappings, notification timing/queues and validated recovery actions.

The command registry also supplies **Toggle debug logging** and **Inspect debug
report**. Debug mode is opt-in per runtime. Reports contain declared log codes,
bounded safe metadata and diagnostic totals, without raw note content, causes,
paths, credentials or automatic network reporting.

## Implementation boundaries

Nuxt UI **4.11.2** is integrated through Vue/Vite, not the Nuxt framework. It uses explicit component imports, local SVG icons, host-owned theme roles, no Tailwind Preflight, and a source-hash-guarded adaptation of two runtime global-style modules. Plugin CSS is composed into one `styles.css`; the extracted Obsidian stylesheet remains harness-only. Dependency notices are retained in the native bundle; no font binaries are shipped.

`main.ts` is lifecycle composition. Domain/application remain independent of Obsidian/Vue/Pinia. Handwritten runtime/CSS/scripts stay within 400 code lines, tests/helpers within 450, and `main.ts` within 100. The gate excludes comments and blank lines and counts all code in a Vue SFC. Executable files are named by purpose; iteration names are reserved for historical planning/evidence documents.

Vue markup lives in `presentation/components`; TypeScript behavior, state and
injection live in `composables`, `stores` and `context`. Components retain minimal
bindings, enforced by `npm run check:presentation`. See
[Presentation structure](docs/development/PRESENTATION-STRUCTURE.md).

Use `npm run examples:remove -- --dry-run` to review removal of the showcase,
Task, Project and Items while retaining the foundation and your own features. Edited
example files conflict instead of being deleted. Follow the
[removal guide](docs/development/EXAMPLE-REMOVAL.md), then verify your resulting plugin.

Maintenance and release preparation use `maintenance:status`, `release:prepare`
and `release:rehearse`. They report discovery failures and retained asset identity;
they do not publish. Expanded native/device, manual accessibility and public
release promotion require separate evidence and authorization.

## Documentation

| Document | Purpose |
| --- | --- |
| [Iteration-four plan](docs/development/ITERATION-FOUR-PLAN.md) | Baseline gaps, coordinated ownership and acceptance order. |
| [Iteration-four review](docs/development/ITERATION-FOUR-REVIEW.md) | Independent findings, fixes and remaining limitations. |
| [Iteration-three guide](docs/development/ITERATION-THREE.md) | Executable entity/repository API, compatibility, safety and remaining scope. |
| [Iteration-three review](docs/development/ITERATION-THREE-REVIEW.md) | Independent findings, regression fixes and improvement pass. |
| [Iteration-two guide](docs/development/ITERATION-TWO.md) | Historical layout/header operation, build/install and dependency decisions. |
| [Iteration-two review](docs/development/ITERATION-TWO-REVIEW.md) | Evidence, fixes, regressions and remaining risks. |
| [Iteration-one guide](docs/development/ITERATION-ONE.md) | Historical installation and architecture context; the iteration-three guide supplies current capabilities. |
| [Current test record](docs/testing/ITERATION-FOUR.md) | Actual tests, coverage denominators, native/served evidence and remaining gaps. |
| [PRD](docs/product/PRD.md) | Complete product requirements and retained baseline. |
| [Nuxt UI implementation plan](docs/development/NUXT-UI-IMPLEMENTATION-PLAN.md) | Full integration roadmap; this milestone qualifies only the selected subset. |
| [Test strategy](docs/testing/TEST-STRATEGY.md) / [test concept](docs/testing/TEST-CONCEPT.md) | Required evidence model and verification architecture. |
| [TypeScript quality-tool research](docs/research/2026-09-23-typescript-quality-tools.md) | Repository-specific assessment, compatibility caveats and primary sources. |
| [Quality-tool adoption plan](docs/development/TYPESCRIPT-QUALITY-TOOLS-PLAN.md) | Proposed additional tools, negative controls and CI placement; not blanket implementation claims. |
| [Setup/makers](docs/development/SETUP-AND-MAKERS.md) | Retained full contract; the authoring guide states executable recipes and limitations. |
| [Entity documents](docs/development/ENTITY-DOCUMENTS.md) | Full entity-to-Markdown contract. |
| [Errors/notifications](docs/architecture/ERRORS-AND-NOTIFICATIONS.md) | Canonical outcomes, recovery and notification roadmap. |
| [Obsidian tokens](docs/design/OBSIDIAN-TOKENS.md) | Native tokens, aliases and pinned host fixture provenance. |
| [Maintenance/release](docs/development/MAINTENANCE-AND-RELEASE.md) | Full update/candidate/promotion contract. |

[Agent instructions](AGENTS.md) · [License](LICENSE)
