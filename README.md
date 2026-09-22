# Obsidian Plugin Shell

A developing GitHub template for maintainable Obsidian plugins using TypeScript, Vue 3, Pinia, Vite, Vitest, Oxlint, fallow, and Obsidian ESLint.

> **Current state:** PRD **0.5.0**, an original modular host-stylesheet specimen, its loopback server, and focused tests. The plugin runtime, npm setup/makers, full Vite harness, ErrorService/NotificationService, DocumentCreationService, and release automation remain specified but unimplemented. There is no package.json yet.

## Available now: inspect the host stylesheet

With Node installed, run:

```sh
node scripts/harness/serve-style-fixture.mjs --port 4174
```

Open the loopback address printed by the server. The specimen provides light/dark themes, narrow layouts, settings/inputs, modal appearance, validation messages, and notice examples. It writes no notes or preferences. Stop the server with Ctrl+C.

Run its focused tests:

```sh
node --test tests/harness-styles/server.test.mjs
```

This is an **original host simulation**, not copied Obsidian app.css, a running plugin, or native compatibility proof. See [provenance and coverage](harness/styles/README.md) and the [actual review evidence](docs/reviews/2026-09-22-product-review.md).

## Start here

| Document | Purpose |
| --- | --- |
| [Current PRD](docs/product/PRD.md) | Short authoritative entrypoint; all existing requirements retained plus 20 new acceptance cases, 82 specified in total. |
| [Product review](docs/reviews/2026-09-22-product-review.md) | Twenty findings across product/developer/UX/architecture/testing/privacy/release perspectives and their actual status. |
| [Developer workflow](docs/development/DEVELOPER-WORKFLOW.md) | What runs now, intended setup/maker path, first feature, testing and release boundaries. |
| [Errors and notifications](docs/architecture/ERRORS-AND-NOTIFICATIONS.md) | Shared outcome model, feedback surfaces, native/harness sinks, retries, ownership and captured-error evidence. |
| [Harness styles and evidence](docs/testing/HARNESS-STYLES.md) | Original host CSS, fidelity modes, fault matrix and qualification. |
| [Setup and makers](docs/development/SETUP-AND-MAKERS.md) | Dependency-free guided installation and safe source generators. |
| [Entity document recipe](docs/development/ENTITY-DOCUMENTS.md) / [service](docs/architecture/DOCUMENT-CREATION.md) | Typed entities, explicit frontmatter, preview, safe complete note creation. |
| [Events](docs/architecture/EVENT-BUS.md) / [plugin CSS composition](docs/architecture/STYLES.md) | Scoped typed integration and one composed plugin stylesheet. |
| [Maintenance and release](docs/development/MAINTENANCE-AND-RELEASE.md) | Reviewed current dependencies and exact-candidate draft/promotion. |
| [Agent instructions](AGENTS.md) / [tooling](scripts/README.md) | Shared contributor rules and actual/planned commands. |

The previous complete PRD is preserved without changes as [BASELINE-0.4.md](docs/product/BASELINE-0.4.md). Its numbered requirements remain incorporated; its historical status text is not the current implementation state. The new PRD explains precedence rather than silently dropping existing capabilities.

## Intended complete-template workflow — not implemented yet

```sh
npm run setup
npm run make -- feature tasks
npm run make -- entity task --feature tasks --document
npm run dev:ui
npm run verify
```

Setup must start without node_modules using checked-in Node-only code, install the qualified lockfile after review, and finish with honest readiness. Makers generate readable source, explicit wiring, tests, events, locales and styles—not notes in a personal vault.

Domain/application remain independent of UI/host APIs. Each view owns Vue/Pinia and disposables; application services own canonical data. The typed bus distributes committed facts, not commands or durable replay. Note-backed entities live in Markdown rather than a duplicate data.json database.

Handwritten source/CSS/tooling: **400 physical lines**. Tests/helpers: **450**. Composition-only main.ts: **100**. Generated application scaffolds follow the same rules.

## Feedback that preserves the truth

Validate beside fields, retain essential recovery in the owning view, update one progress/notice per operation, and handle duplicate or stale actions safely. A document that was created but could not be opened stays created; retry opening, not creation. Unknown write outcomes must not trigger unsafe blind retries.

The future harness must inspect captured Vue/application failures as well as console/page errors. A useful fallback screen cannot hide a defect from tests. Error and notification services are specified in this pass, not implemented by the specimen buttons.

## Two different stylesheets

```text
harness/styles/obsidian.css       original host simulation, harness only
src CSS + compiled Vue styles    → dist/styles.css, actual plugin output
```

The real-component harness will load host styling before the actual plugin stylesheet. Releases include only the plugin output; never deploy the host shim. CSS scoping, dark/light behavior and exact-candidate parity require their own tests.

## Next implementation milestone

Continue WP-00/01 qualification, then implement the real shell/services and integrate the fixture into the existing Vite/Vitest/Playwright workflow. The product review records what was and was not exercised; no native host/device or release tests ran in this iteration.

[License](LICENSE)
