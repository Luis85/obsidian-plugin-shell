# Obsidian Plugin Shell

A planned GitHub template for starting, maintaining, and releasing Obsidian plugins with **TypeScript, Vue 3, Pinia, Vite, Vitest, Oxlint, fallow, and Obsidian ESLint**.

> **Status: specification only.** PRD **0.4.0** defines the intended plugin, guided setup/makers, typed events, composed CSS, entity-driven Markdown creation, and release workflows. These npm commands and runtime services are not implemented yet. scripts/ currently contains its guide only.

## Start here

| Document | Purpose |
| --- | --- |
| [Developer workflow](docs/development/DEVELOPER-WORKFLOW.md) | Short setup, maker/manual changes, browser/native development and troubleshooting. |
| [Setup and makers](docs/development/SETUP-AND-MAKERS.md) | Dependency-free bootstrap, script structure, safe generators and extensions. |
| [Entity document recipe](docs/development/ENTITY-DOCUMENTS.md) | Define Task properties and create a Markdown note through one service. |
| [DocumentCreationService](docs/architecture/DOCUMENT-CREATION.md) | Entity/projection/serialization/path/write/preview/event contracts. |
| [Typed events](docs/architecture/EVENT-BUS.md) / [modular styles](docs/architecture/STYLES.md) | Shared native integration, ownership, and composed stylesheet. |
| [Maintenance and release](docs/development/MAINTENANCE-AND-RELEASE.md) | Current dependencies/host support, fixed candidates and publication. |
| [PRD 0.4](docs/product/PRD.md) | Complete contract, 62 acceptance scenarios and ten work packages. |
| [Agent instructions](AGENTS.md) / [scripts guide](scripts/README.md) | Contributor and tooling entrypoints. |

Primary-source records are in the [baseline research](docs/research/2026-09-22-template-research.md), [setup/event/style supplement](docs/research/2026-09-22-setup-makers-events-styles.md), and [entity-document research](docs/research/2026-09-22-entity-documents.md).

## Intended first run

Obtain the template, install the documented Node/npm prerequisites, and run:

```sh
npm run setup
```

The checked-in Node-only wizard starts before node_modules exists. It reviews identity, selected downloads/local development, performs locked installation, builds/checks the selected profile, and prints next actions. No separate npm ci is needed to start it; CI/reinstall can still use npm ci directly.

Then the intended developer interface includes:

```sh
npm run make -- feature tasks
npm run make -- entity task --feature tasks --document
npm run dev:ui
npm run verify
```

Makers generate normal registered source/tests, not real notes in a user's vault. Plans, dry runs, collisions, safe reruns, custom recipes, and finite machine modes are part of the contract.

## Entity-backed Markdown

Define an entity's input fields/defaults/validation separately from its document mapping, destination, filename, and body. The shared **DocumentCreationService** then handles validation, preview, safe complete creation, a typed receipt, and a documents.created event.

The Task recipe includes `type`, stable `id`, `schema_version`, `title`, `status`, optional `due`, and `tags`. A note-backed Task lives in Markdown, not as a second authoritative copy in data.json. Invalid input and conflicts do not overwrite files. Creation is separate from later opening/indexing, and an open failure must not trigger duplicate creation.

The service does not implement a complete Todo app, ORM, automatic migration engine, or arbitrary executable template system. New entity/document definitions reuse it without modifying its core. See the [Task example and intended API](docs/development/ENTITY-DOCUMENTS.md).

## Architecture, events, and styles

```text
presentation → application → domain → shared
infrastructure → application contracts / domain / shared
bootstrap → concrete adapters and presentation factories
main.ts → minimal lifecycle and composition
```

Application contracts and domain values remain independent of host/UI APIs. Each view owns ephemeral Vue/Pinia state; canonical data stays in its declared persistence boundary. The typed bus is scoped to one runtime, publishes facts after successful work, and maps native events without leaking host objects. It is not a command pipeline or replay database.

Handwritten source, CSS, definitions and scripts: **400 physical lines**. Tests/helpers: **450**. main.ts: **100**, composition only. Generated scaffolds obey normal source rules.

```text
ordered CSS modules + compiled Vue SFC styles → dist/styles.css
                                  ↓
                    native installation and release
```

Use one shared Vite style pipeline, native namespaces/theme variables, maker-integrated modules, and exact-candidate style evidence. Never hand-edit the composed stylesheet. Its output-size policy is separate from per-source LoC. Task forms reuse this pipeline.

## Current, safe, releasable

Target latest public/stable Obsidian; Catalyst is optional. Distinguish app/API/installer/mobile/toolchain versions. Use current declarative settings and a shared writer. Exact qualified dependencies remain reproducible while reviewed Dependabot updates keep them current; Renovate may replace, not duplicate it.

Local development defaults to .dev-vault/.obsidian/plugins/<plugin-id>/ with explicit repository-root support. Preserve user data/notes/other plugins/security; never automatically disable Restricted Mode or seed Tasks on load/setup.

Release preparation is not publication. Build a fixed-commit candidate, test its exact JS/CSS/manifest, create a draft, and explicitly publish those same assets. First directory approval remains a separate maintainer action.

## Implementation

Start with WP-00 and deliver bounded packages. Qualification includes fresh dependency-free setup, generated entity/event/style integration, actual Markdown from the real service, native Properties/no-overwrite tests, and release rehearsal.

This iteration did not implement/run these capabilities, install dependencies, create user notes, activate bots, or publish releases. Research is not runtime evidence.

[License](LICENSE)
