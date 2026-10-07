# Workbench

**Focus on your idea. Save time. Not quality.**

Workbench is a developer-focused tool to create and manage declarative user interfaces for **webapps and Obsidian plugins**. Its product direction connects interface definitions, previews, generated source and documentation so developers can focus on product-specific behavior instead of repeating setup and translating the same decisions between tools.

The three promises are **saving time without sacrificing quality**, **documenting along the way**, and **putting developer experience first**. Creation is only the beginning: reuse, understandable changes and safe regeneration matter too.

Start with the [product vision](docs/product/PRODUCT-VISION.md), [product principles](docs/product/PRODUCT-PRINCIPLES.md) and [documentation map](docs/product/README.md). The [product and delivery overview](SHELL-FIRST-OVERVIEW.md) connects the available entry points; the [2026-09-29 vision review](docs/_archive/product/PR5-VISION-REVIEW.md) distinguishes inspected implementation from intended direction.

**Developers:** the [developer guide](DEVELOPER_GUIDE.md) lists every requirement first, then setup and everyday workflows for improving or extending the project. CLI development lives in `src/cli`; `npm run app:dev -- <command>` runs that source. `npm run build:cli` builds the complete, portable `bin` folder. Keep the whole folder together and run `node bin/app` with a compatible Node.js.

**Implementation boundary:** Workbench builds on the reusable shell, CLI, compiler and authoring concept in PR #5. A generated scaffold is not a finished application, and the browser authoring concept is not the fully accepted native product. The supported CLI entry is `node bin/app`; package/manifest IDs, schema names and `companion` paths remain unchanged. Generated projects retain the user's chosen identity.

## Companion and UI-feature starters

The current Companion build opens without a preloaded project or starter library.
Choose **Start Blank** or import a separately installed starter JSON, review its
inputs, then enter setup. `configs/starters/companion-plugin.json` is the canonical
Companion development model; `configs/starters/feature-showcase.json` exercises the
catalogued visual controls and actions with explicit mock scenarios.

Run `node bin/app starters coverage feature-showcase --json` to inspect model
coverage. This is not native acceptance: the golden Companion still has unbound
business interactions and missing native authoring adapters. See the
[Companion starter guide](docs/development/COMPANION-STARTERS.md) for the exact
workflow, generated checks, fixture boundaries and remaining parity work.

## Reusable Obsidian foundation

The guide below retains the existing framework checkout workflow and its milestone history. It is not the complete cross-target Workbench specification. Evidence remains tied to the dates and candidates in its linked records.

**Framework lifecycle and recovery increment, version 0.4.0.**

## Start a new plugin

From this checkout (after `npm ci` and `npm run build:cli`), create an independent project from one of
the reviewed starters. The target must be a new or empty folder outside this checkout.

```sh
npm run new -- --list                                   # starters: id, difficulty, summary
npm run new -- ../my-plugin --starter quick-capture     # preview only; nothing is written
npm run new -- ../my-plugin --starter quick-capture --id my-capture --name "My Capture" --yes
npm run new -- ../my-plugin --starter blank --yes --install --trust-processes   # explicitly run the JSON first-run recipe
npm run new -- ../my-plugin --from my-plugin.companion.json   # any project JSON exported by the companion
```

`npm run new` is `node bin/app new`; `node bin/app` is the only CLI entry (there is
no root launcher script). In a terminal, `npm run new` without arguments asks for the folder, starter and
identity, then shows the plan before writing. The result is scaffolding with TODO
acceptance obligations, not a finished or natively qualified plugin. Details:
[Framework CLI](docs/development/FRAMEWORK-CLI.md#start-a-new-plugin-from-a-starter).
The new project has its own README and short `AGENTS.md`, Claude Code hooks, skills
and permissions, VS Code debugging, product CI and an in-memory Obsidian example test
([what it contains](docs/development/COMPANION-GENERATOR.md#what-the-generated-project-contains)).

`node bin/app help` (the Workbench CLI; package `bin` name `obs-shell`) shows the
golden path (new, install, dev, test, check, make); `help <group>`, for example
`help framework`, lists a command group. `make` applies a reviewed plan and then
runs its planned type, generated-test, event and entity checks, reporting each
actual result. `npm run check` is the fast daily and agent gate (types, both
linters, tests and generated authoring tests; `check:fast`
covers changed files only), and `npm run check:submission` mirrors documented
Obsidian review rules locally. Neither replaces `npm run verify`. See
[the check gate](docs/development/FRAMEWORK-CLI.md#golden-path-help-and-the-check-gate).

The [framework guide](docs/development/FRAMEWORK-GUIDE.md) maps the reusable
developer API and the path from feature generation to production qualification.
The [plan](docs/_archive/development/FRAMEWORK-LIFECYCLE-PLAN.md) adds retained-action
permits, precise protected-data recovery, UTF-8 document bounds and independent
lifecycle observation. The [execution record](docs/_archive/testing/FRAMEWORK-LIFECYCLE.md)
keeps its results separate from the prior qualified persistence milestone below.

The [plan](docs/_archive/development/PERSISTENCE-LIFECYCLE-PLAN.md) focuses on
exact durable outcomes, protected data and disposed view capabilities. Its
[cross-owner review](docs/_archive/development/PERSISTENCE-LIFECYCLE-REVIEW.md) and
[bounded Windows/native investigation](docs/_archive/testing/PERSISTENCE-LIFECYCLE-NATIVE.md)
retain assertion and environment limits; qualification belongs to the
[execution record](docs/_archive/testing/PERSISTENCE-LIFECYCLE.md).

The [closure plan](docs/_archive/development/ACCEPTANCE-CLOSURE-PLAN.md) audits all 96
legacy cases against actual assertions and required modes. Previous results belong
to the [closure execution record](docs/_archive/testing/ACCEPTANCE-CLOSURE.md); the earlier
qualification and its failed native attempts remain retained separately.

Executable qualification now adds input-bound framework evidence, case-specific
acceptance reports, measured production maintainability, and explicit native
performance/resource protocols. See the [plan](docs/_archive/development/EXECUTABLE-QUALIFICATION-PLAN.md)
and [execution record](docs/_archive/testing/EXECUTABLE-QUALIFICATION.md) for actual results
and remaining scope. This does not establish complete template release readiness.

The integration baseline includes [opt-in release execution](docs/development/RELEASE-EXECUTION.md)
from a retained candidate. [Readiness ledger](docs/_archive/development/TEMPLATE-READINESS-LEDGER.md)
tracks remaining requirements. The owner-dispatched Release cut and Publish workflows
exist (see [How work flows](#how-work-flows)) but have not been exercised on GitHub;
real publication remains unqualified. No release has been published by this implementation task.

A TypeScript/Vue/Pinia plugin with typed entity definitions, separate document
recipes, Markdown CRUD and explicit plugin-data entities. Task is an optional example;
Project proves reuse with number/boolean fields. The existing native view, typed
events, shared preferences, scoped Nuxt UI styling and real-component harness
remain. This is a template-foundation milestone, not completion of the full PRD.

## Build on the template

Start in [src/plugin/features](src/plugin/features/README.md). Define business data and actions;
the shared services own persistence, native integration, feedback and cleanup.

| Concern | Author-facing entry point |
| --- | --- |
| Entities and repositories | [Build a feature](docs/development/BUILD-A-FEATURE.md), `src/plugin/features/api.ts`, and `src/plugin/bootstrap/features.ts` |
| Obsidian commands and ribbon icons | [Commands and ribbon](docs/development/COMMANDS-AND-RIBBON.md), feature command factories, and `src/plugin/bootstrap/commands.ts` |
| Native dialogs and notices | [Modal and notice services](docs/development/MODALS-AND-NOTICES.md): `services.modals` and `services.notices` |
| Logging and debugging | [Logging and debugging](docs/development/LOGGING-AND-DEBUGGING.md): `services.logger`, typed catalogs and explicit debug commands |
| Vue markup and TypeScript behavior | [Presentation structure](docs/development/PRESENTATION-STRUCTURE.md): components, composables, stores and context |
| Scaffolding and identity | [Authoring tools](docs/development/AUTHORING-TOOLS.md) and [reviewed setup](docs/development/SETUP-IDENTITY.md) |
| Plugin-data entities | [Typed CRUD and shared persistence](docs/development/PLUGIN-DATA-ENTITIES.md) |
| Event contracts and subscriptions | [Typed event authoring](docs/architecture/EVENT-BUS.md), `events:catalog` and `events:check` |
| Removing demonstrations | [Reviewed example removal](docs/development/EXAMPLE-REMOVAL.md) |
| Maintenance and packaging | [Freshness reporting](docs/development/MAINTENANCE-OPERATIONS.md) and [fixed-candidate rehearsal](docs/development/RELEASE-REHEARSAL.md) |
| Release operations | [Authenticated planning, explicit execution and recovery](docs/development/RELEASE-EXECUTION.md) |

**Qualification:** See the [runtime-authoring record](docs/_archive/testing/RUNTIME-AUTHORING.md)
and historical [iteration 04 verification record](docs/_archive/testing/ITERATION-FOUR.md)
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
| Events & feedback | Inspect safe event/diagnostic summaries, show owned feedback/native notices, and try dialogs plus a real modal-backed recovery action with delayed progress and owner cleanup, without changing notes. |
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

Start building in [src/plugin/features](src/plugin/features/README.md): define business fields,
an optional document recipe, and add one typed registration entry. The template
wires repositories and lifecycle for you. See [Build a feature](docs/development/BUILD-A-FEATURE.md),
the [API/compatibility guide](docs/_archive/development/ITERATION-THREE.md)
and [implementation plan](docs/_archive/development/ITERATION-THREE-PLAN.md). No generic service
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
complete PRD release gate. See the [test record](docs/_archive/testing/ITERATION-FOUR.md)
for actual execution results and coverage scope.

Tests are also separated by responsibility, so one part can be tested on its own:
`npm run test:suites -- --list` shows every suite, and `npm run test:cli`,
`test:generator`, `test:companion`, `test:makers`, `test:native-tooling`,
`test:setup`, `test:release`, `test:quality` or `test:test-data` runs one. Every
test file must belong to exactly one suite; see [Test suites](docs/testing/TEST-SUITES.md).

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

Nuxt UI **4.11.3** is integrated through Vue/Vite, not the Nuxt framework. It uses explicit component imports, local SVG icons, host-owned theme roles, no Tailwind Preflight, and a source-hash-guarded adaptation of two runtime global-style modules. Plugin CSS is composed into one `styles.css`; the extracted Obsidian stylesheet remains harness-only. Dependency notices are retained in the native bundle; no font binaries are shipped.

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

## How work flows

Checks tighten as a change matures, so early iteration is not slowed by the full
qualification:

| Stage | Trigger | Checks |
| --- | --- | --- |
| Draft pull request | every push | Dev tier: "Dev checks", a fast diff-scoped gate, and "Definition of Ready" |
| Ready for review | marking it ready, then every push | Integration tier: "CI result", "Definition of Done" and every pull-request workflow |
| `release/X.Y.Z` branch | owner-dispatched Release cut | Release tier: every workflow on every matrix leg; the owner-dispatched Publish then merges, tags `X.Y.Z` and creates the GitHub release |

Claude Code skills drive each stage: the ideation chain (`ideation-journey` through
`ideation-boilerplate`) from an idea to a checked prototype skeleton,
`feature-delivery` from a draft pull request to a green merge, `self-review` before
review and `release` for cut and publish. Read the
[delivery pipeline](docs/development/DELIVERY-PIPELINE.md),
[deliver a change](docs/development/DELIVER-A-CHANGE.md),
[cut and publish a release](docs/development/CUT-AND-PUBLISH-A-RELEASE.md) and the
[workflow reference](docs/development/WORKFLOWS.md).

Work is planned as **increments**: `node bin/app increment new` writes the
increment document with its acceptance criteria, a kick-off pull request plan, an
issue, one pending test stub per criterion and the branch `increment/<id>`. The
increment is refined in its kick-off pull request until the Definition of Ready
passes, then delivered by change pull requests stacked on that branch
(`node bin/app pr new`), each closed by the Definition of Done. `pr publish` and
`pr sync` turn the plans into draft pull requests on GitHub or Azure DevOps and
keep tasks and amendments in sync, only through a reviewed preview. Start with
[your first increment](docs/development/FIRST-INCREMENT.md).

Projects can live on GitHub or Azure DevOps: `setup` and `new` ask for the hosting
platform (or take `--hosting github|azure-devops|none`), and `node bin/app hosting set`
switches later. Generated projects get the matching pipeline, pull-request template and
`gh`/`az` hints; see [hosting platforms](docs/development/HOSTING-PLATFORMS.md).

## Documentation

The [docs index](docs/README.md) lists every current document by type (tutorials,
how-to guides, reference and explanation), together with plans, workspaces and the
[archive](docs/_archive/README.md) of historical plans, reviews and records. Start with:

| Document | Purpose |
| --- | --- |
| [Build a feature](docs/development/BUILD-A-FEATURE.md) | Tutorial: add a business feature on the template. |
| [Framework guide](docs/development/FRAMEWORK-GUIDE.md) | The reusable developer API, from feature to qualification. |
| [Framework CLI](docs/development/FRAMEWORK-CLI.md) | `node bin/app` reference: new, setup, the check gate and the kit workflow. |
| [Test suites](docs/testing/TEST-SUITES.md) | Every suite, its command and prerequisites, and how to add a test. |
| [Test strategy](docs/testing/TEST-STRATEGY.md) | The testing approach and the normative TST rules. |
| [Quality assurance](docs/development/QUALITY-ASSURANCE.md) | What `npm run verify` runs, partial runs and reports. |
| [Deliver a change](docs/development/DELIVER-A-CHANGE.md) | Draft pull request, Dev and Integration tiers, green merge. |
| [Framework PRD](docs/product/PRD.md) | Reusable Obsidian foundation requirements; Workbench direction is in the [product vision](docs/product/PRODUCT-VISION.md). |
| [Upstream lint dependency exception](docs/development/ITERATION-TWO-DEPENDENCY-EXCEPTION.md) | The unresolved nested ESLint 9 support criterion. |

[Agent instructions](AGENTS.md) · [License](LICENSE)

## Generate a plugin from a companion design

Export Project JSON from the companion HTML concept. From this framework checkout, run
`node bin/app generate --input /path/to/project.json --vault /path/to/vault --target projects/my-plugin`
to inspect the file plan, then repeat with `--apply <planHash>`. The npm equivalent is
`npm run companion:scaffold -- ...`. In the generated project run `npm ci`,
`npm run verify:project`, then `npm run test:tdd`. Generation performs no installation, activation or publishing.

The compiler creates the shell, entity contracts, DataSource services/Pinia stores, native hosts,
Vue detail layouts and traceable tests. Business behavior stays in explicit implementation hooks.
See [the generator guide](docs/development/COMPANION-GENERATOR.md) for supported contracts and boundaries.
