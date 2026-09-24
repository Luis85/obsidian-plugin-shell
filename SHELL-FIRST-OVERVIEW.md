# Shell-first delivery overview

A reusable TypeScript/Vue/Pinia/Nuxt UI foundation for building Obsidian plugins, with guided setup, shared runtime services, generators and verification tooling.

## Delivery order: shell first

**First qualify and ship the framework developer kit: shell, project generator and TypeScript CLI. Then convert the evolving companion concept on that shipped framework. Publish the companion last.**

| Product | Current boundary | Next priority |
| --- | --- | --- |
| Plugin Shell | Implemented foundation with evidence-bound gaps; not fully release-qualified | Complete and verify reusable features for standalone consumers and the future companion. |
| Shell Workbench companion | Interactive browser concept and proposed product contracts; features are still being developed | Continue concept work, then implement the agreed scope on the qualified shell. |
| Framework distribution | Planned compiled developer-kit archive; not yet qualified/shipped | SH-022 technical readiness → separately approved SH-034 shipment, before native conversion. |
| Companion distribution | Future milestone, not an available native installation route | CP-010 → separately authorized PUB tasks; do not delay the first framework release here. |

The companion is not feature-complete or an installable native product merely because its browser concept works. This documentation update does not change runtime code, manifests, versions, dependency pins or release authorization.

Start with the [CLI/generator implementation plan](docs/development/FRAMEWORK-CLI-GENERATOR-PLAN.md), [PR #5 framework review](docs/development/PR5-FRAMEWORK-READINESS-REVIEW.md), [delivery strategy](docs/product/DELIVERY-STRATEGY.md), [revised improvement plan](docs/product/COMPANION-IMPROVEMENT-PLAN.md) and [individual task backlog](docs/tasks/README.md). These establish the current execution order; earlier companion-first scheduling recommendations are superseded, not the retained functional requirements.

## Primary release journey — planned

Download the framework release asset → extract into a new project folder → run the bundled console setup → configure project/plugin → import project JSON → review/generate → develop/build/test → publish the generated plugin with explicit approval → maintain. No installed companion, source checkout or global CLI is required. Direct Node and npm entry points use the same TypeScript-authored operations. The project root need not be an Obsidian vault. This is the SH-023–SH-034 implementation target, not an available release claim.

## Use the shell today

Read the [current template guide](README.md), [framework guide](docs/development/FRAMEWORK-GUIDE.md), [parent PRD](docs/product/PRD.md), [authoring tools](docs/development/AUTHORING-TOOLS.md) and [readiness ledger](docs/development/TEMPLATE-READINESS-LEDGER.md). The root README remains the current operational guide, including lifecycle ownership, recovery contracts and qualification limits. The [original template guide](TEMPLATE-GUIDE.md) remains a historical snapshot; use the current guide for development.

From a dedicated development checkout, use the repository-selected toolchain and exact lockfile:

```sh
npm run setup
```

For the existing native setup profile:

```sh
npm run setup -- --profile native
```

The existing contained target is `.dev-vault`; open it separately and deliberately enable the generated plugin. Do not use a personal vault for development. Installing assets is not enabling a plugin. Follow [setup and identity](docs/development/SETUP-IDENTITY.md) for plans, profiles, resume and protected data.

| Need | Start here |
| --- | --- |
| Build a business feature | [Feature guide](docs/development/BUILD-A-FEATURE.md), [public authoring API](src/features/api.ts) |
| Generate source | [Authoring tools](docs/development/AUTHORING-TOOLS.md) |
| Documents and persistence | [Document creation](docs/architecture/DOCUMENT-CREATION.md), [plugin-data entities](docs/development/PLUGIN-DATA-ENTITIES.md) |
| Events, feedback and UI | [Events](docs/architecture/EVENT-BUS.md), [errors and notifications](docs/architecture/ERRORS-AND-NOTIFICATIONS.md), [styles](docs/architecture/STYLES.md) |
| Test and qualify | [Test strategy](docs/testing/TEST-STRATEGY.md), [test concept](docs/testing/TEST-CONCEPT.md), [executable qualification](docs/testing/EXECUTABLE-QUALIFICATION.md) |

## Explore the companion concept

Open the [concept guide](docs/concepts/companion/README.md) and [interactive HTML](docs/concepts/companion/index.html). This is a browser concept with simulated host and development operations, not the native companion installation.

Its eventual journey remains: install the companion in a dedicated authoring vault, design one project without developer tools, optionally add the shell template, generate reviewed boilerplate, and continue independently through an editor and CLI. That user journey is not the repository's implementation order.

The [concept roadmap](docs/concepts/companion/ROADMAP.md) keeps feature exploration open. The explicit [native conversion task](docs/tasks/companion/CP-001.md) is blocked until shell readiness, separately authorized framework shipment and an agreed conversion scope are evidenced. It requires genuine reuse of shell services and public APIs, not an iframe, a webview wrapper or a privately copied foundation.

## Contribute and track progress

Read [AGENTS.md](AGENTS.md) and select a task from [docs/tasks](docs/tasks/README.md). Tasks record dependencies, acceptance criteria and required evidence. A planned task does not mean its entire capability is missing: inspect existing implementation and close only the demonstrated gap.

Shell work has highest priority. Concept improvements may continue without displacing shell prerequisites. Native conversion follows technical readiness and framework shipment; companion publication follows native qualification and separate owner authorization. Existing release tooling is retained, but this plan neither runs it nor authorizes tags, publishing, directory submissions or permission changes.
