# Obsidian Plugin Shell

A planned GitHub template for starting, maintaining, and releasing Obsidian plugins with **TypeScript, Vue 3, Pinia, Vite, Vitest, Oxlint, fallow, and Obsidian ESLint**.

> **Status: specification only.** PRD **0.3.0** defines guided setup, maker tooling, typed events, composed CSS, the plugin/harness, and releases. None of the npm commands or runtime capabilities described below are implemented yet. The `scripts/` directory currently contains its implementation guide only.

## Start here

| Document | Purpose |
| --- | --- |
| [Developer workflow](docs/development/DEVELOPER-WORKFLOW.md) | First run, maker-based and manual changes, browser/native development, troubleshooting. |
| [Guided setup and makers](docs/development/SETUP-AND-MAKERS.md) | Dependency-free setup, scripts layout, generator catalog, safety, extensions, and agent flags. |
| [Typed event bus](docs/architecture/EVENT-BUS.md) | Event types/catalog, publication semantics, native bridge, scopes, and tests. |
| [Modular styles](docs/architecture/STYLES.md) | CSS source modules, Vue style compilation, one composed artifact, watch/parity checks. |
| [Maintenance and release](docs/development/MAINTENANCE-AND-RELEASE.md) | Updates, current-host support, draft/promote, and initial listing. |
| [PRD 0.3](docs/product/PRD.md) | Complete contract with 49 acceptance scenarios and ten implementation work packages. |
| [Baseline research](docs/research/2026-09-22-template-research.md) / [new research](docs/research/2026-09-22-setup-makers-events-styles.md) | Dated primary-source findings and verification limits. |
| [Agent instructions](AGENTS.md) / [scripts guide](scripts/README.md) | Shared contributor/tooling rules; CLAUDE.md imports the same agent guidance. |

## Intended first run

Obtain the template, install the documented Node/npm prerequisites, open the repository directory, then:

```sh
npm run setup
```

The wizard starts without `node_modules`, reviews identity and optional development/test provisioning, installs the qualified locked dependencies, builds/checks the selected profile, and prints the next action. No separate `npm ci` is required to start setup. Explicit CI/reinstall workflows still use `npm ci`.

After setup, the intended development interface is:

```sh
npm run make -- feature tasks
npm run dev:ui
npm run verify
```

`make` supplies discoverable recipes for features, native surfaces, components, stores, use cases, events/listeners, CSS modules, locales, and custom makers. Generated code is ordinary developer-owned source with explicit registrations and tests. Dry runs, conflicts, noninteractive JSON, and safe reruns are part of the contract.

## Architecture and integration

```text
presentation → application → domain → shared
infrastructure → application contracts / domain / shared
bootstrap → concrete adapters and presentation factories
main.ts → minimal host lifecycle and composition
```

Canonical data belongs to application services; views own ephemeral Vue/Pinia state. The required typed bus is scoped to one plugin runtime. It distributes committed facts and normalized native events without carrying host objects into domain/application code. It is not a command bus, persistent log, or replay store.

Handwritten source—including CSS and tooling—is limited to **400 physical lines**, tests/helpers to **450**, and `main.ts` to **100**. Count comments, blanks, and the complete Vue SFC. Makers do not exempt their output from those rules.

## Modular CSS, one release stylesheet

```text
src/styles/index.css + imported CSS modules + compiled Vue SFC styles
                              ↓
                        dist/styles.css
                              ↓
             local plugin installation and release assets
```

Author small ordered modules, not a monolithic output file. Use the shared Vite pipeline and namespace native styles. The harness shares style sources and separately tests the exact packaged artifact. Composed output has an artifact-size budget rather than the handwritten source-line ceiling. Never hand-edit `dist/styles.css`.

## Current and releasable

Target the latest public/stable Obsidian; Catalyst is optional. Keep app/API/installer/mobile/toolchain versions distinct. Current declarative settings use the application-owned writer. Exact dependencies/lockfile stay reproducible while reviewed Dependabot updates keep them current; Renovate may replace, not duplicate, that updater.

Local development defaults to `.dev-vault/.obsidian/plugins/<plugin-id>/`, with explicit repository-root-vault support. Preserve data, notes, other plugins, and security settings. Never disable Restricted Mode automatically.

Release preparation is separate from publication. Build a fixed-commit candidate, test its exact JS/CSS/manifest, create a draft, and explicitly promote those retained files. First Community directory listing remains a separate maintainer action.

## Implementation entrypoint

Start with **WP-00** in the PRD, then deliver bounded slices. Qualification includes fresh setup without dependencies and a maker-generated feature/event/listener/style path, not just the maintainer's prepared checkout.

This iteration did not implement or execute setup, generators, the event bus, CSS builds, browser/native tests, updater configuration, or releases. Research and documented targets are not proof of runtime compatibility.

[License](LICENSE)
