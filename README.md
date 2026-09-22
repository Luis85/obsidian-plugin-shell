# Obsidian Plugin Shell

**Iteration 01 — runnable Nuxt UI capability showcase, version 0.1.0.**

A TypeScript/Vue/Pinia plugin with a native Obsidian view, Task Markdown creation, typed events, persisted preferences, localized feedback, scoped Nuxt UI styling, and a real-component browser harness. This is the first working slice, not completion of the full template PRD.

## Open it in Obsidian

Use the qualified Node **24.21.0** with npm, open the repository directory, and run:

```sh
npm run setup
```

Review and confirm the installer plan. It installs the lockfile, builds, type-checks, runs service tests, and copies only `main.js`, `manifest.json`, and `styles.css` into:

```text
.dev-vault/.obsidian/plugins/plugin-shell/
```

Open `.dev-vault` as a vault in desktop Obsidian, deliberately enable **Plugin Shell**, then run **Open capability showcase** from the command palette or use the Blocks ribbon button. The manifest minimum is **1.13.7** and the plugin is intentionally desktop-only pending mobile qualification. Setup does not change Restricted Mode or create Task notes.

For a prebuilt ZIP, place its three files in `<test-vault>/.obsidian/plugins/plugin-shell/` and follow the same enable/open steps. Do not confuse the source ZIP with the installable plugin.

## Develop in the browser

```sh
npm run dev:ui
```

Open the printed loopback address at `/harness/app/`. This runs the same Vue/Nuxt UI components, application services, event bus, and styles with synthetic browser-backed storage and host adapters. It does not access your personal vault. Use `npm run dev:local` for successful-build installation into the development vault, then reload the plugin manually.

## Explore four panels

| Panel | Working behavior |
| --- | --- |
| Overview | Nuxt UI capability cards, environment information, and entry to document creation/native modal. |
| Documents | Validate title/due/tags, preview exact Markdown and destination, explicitly create a Task note, and open the created note separately. |
| Events & feedback | Publish typed events, inspect recent events/diagnostics, show/dismiss owned feedback and native notices, open a native modal. |
| Preferences | English/German, Task folder, and routine-success notifications saved through the shared writer. Native settings use the same service. |

Markdown is canonical for Tasks; plugin data stores preferences rather than a second Task database. No file is created by preview. A created file remains successful if opening it fails. Views own independent Vue/Pinia state and cleanup, while repositories/events are runtime-scoped.

## Verify

```sh
npm run verify
npm run test:coverage
node node_modules/@playwright/test/cli.js install chromium
npm run test:e2e
```

The current `verify` performs the iteration's build, strict runtime/Vue/harness/test type checks, Oxlint, Obsidian/Vue ESLint, source/locale/architecture gates, Vitest tests, token/artifact checks, retained repeated Node baseline, and harness build. Served E2E is explicit and separate. This is not yet the complete PRD release gate. See the [test record](docs/testing/ITERATION-ONE.md) for exact execution results and coverage scope.

`npm run help` lists commands. `npm run setup -- --dry-run` works without project dependencies and does not write or install. `--yes --no-interaction` accepts a reviewed setup plan; `--no-local` selects browser-only setup. The full rename/resume wizard and `make` catalog remain planned; this installer intentionally uses the fixed showcase identity.

## Implementation boundaries

Nuxt UI **4.11.2** is integrated through Vue/Vite, not the Nuxt framework. It uses explicit component imports, local SVG icons, host-owned theme roles, no Tailwind Preflight, and a source-hash-guarded adaptation of two runtime global-style modules. Plugin CSS is composed into one `styles.css`; the extracted Obsidian stylesheet remains harness-only. Dependency notices are retained in the native bundle; no font binaries are shipped.

`main.ts` is nine lines of lifecycle composition. Domain/application remain independent of Obsidian/Vue/Pinia. Handwritten runtime/CSS/scripts stay within 400 physical lines and tests/helpers within 450.

Still pending: complete generators/identity migration, broader host events/entity configurations/notification timing policies, full coverage and analyzer gates, expanded Nuxt UI component qualification, mobile/device acceptance, and public release promotion. No public release was published by this milestone.

## Documentation

| Document | Purpose |
| --- | --- |
| [Iteration-one guide](docs/development/ITERATION-ONE.md) | Installation, architecture decisions, current commands, dependency exceptions and limits. |
| [Iteration-one test record](docs/testing/ITERATION-ONE.md) | Actual tests, native/served evidence and remaining gaps. |
| [PRD](docs/product/PRD.md) | Complete product requirements and retained baseline. |
| [Nuxt UI implementation plan](docs/development/NUXT-UI-IMPLEMENTATION-PLAN.md) | Full integration roadmap; this milestone qualifies only the selected subset. |
| [Test strategy](docs/testing/TEST-STRATEGY.md) / [test concept](docs/testing/TEST-CONCEPT.md) | Required evidence model and verification architecture. |
| [Setup/makers](docs/development/SETUP-AND-MAKERS.md) | Future complete wizard and generator contract. |
| [Entity documents](docs/development/ENTITY-DOCUMENTS.md) | Full entity-to-Markdown contract. |
| [Errors/notifications](docs/architecture/ERRORS-AND-NOTIFICATIONS.md) | Canonical outcomes, recovery and notification roadmap. |
| [Obsidian tokens](docs/design/OBSIDIAN-TOKENS.md) | Native tokens, aliases and pinned host fixture provenance. |
| [Maintenance/release](docs/development/MAINTENANCE-AND-RELEASE.md) | Full update/candidate/promotion contract. |

[Agent instructions](AGENTS.md) · [License](LICENSE)
