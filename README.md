# Obsidian Plugin Shell

A planned current Obsidian plugin template using TypeScript, Vue 3, Pinia, Vite, Vitest, Oxlint, fallow and Obsidian ESLint.

> **Current status — PRD 0.6:** The original host-style specimen and its verification baseline run now. The actual plugin, guided npm setup/makers, DocumentCreationService, production feedback/bus, complete toolchain and native release workflow remain specified, not implemented.

**Selected UI direction:** Nuxt UI with Tailwind CSS through the plain Vue/Vite integration, not the Nuxt application framework. The [implementation plan](docs/development/NUXT-UI-IMPLEMENTATION-PLAN.md) defines ten planned work packages, host-safe CSS/runtime adapters and explicit acceptance gates. This is a researched implementation direction, not an installed or verified integration.

## Start here

| Document | Purpose |
| --- | --- |
| [Nuxt UI implementation plan](docs/development/NUXT-UI-IMPLEMENTATION-PLAN.md) | Selected architecture, prerequisites, target files, dependencies, ten work packages and review gates. |
| [Nuxt UI research](docs/research/2026-09-22-nuxt-ui-integration.md) | Primary-source findings, release/source identities, runtime-style and shared-state risks. |
| [Nuxt UI acceptance matrix](docs/testing/NUXT-UI-ACCEPTANCE.md) | 34 planned cases and concrete verification designs; not executed evidence or a change to today's 90-case inventory. |
| [Test strategy](docs/testing/TEST-STRATEGY.md) | Risk, levels, determinism, evidence, coverage, release and ownership policy. |
| [Test concept](docs/testing/TEST-CONCEPT.md) | Exact runnable commands, files, fixtures, reports and implementation plan. |
| [Machine test plan](docs/testing/test-plan.json) | 90 acceptance cases with risk/owner/modes/current evidence gaps. |
| [Current PRD](docs/product/PRD.md) | Product contract and honest capability status. |
| [Developer workflow](docs/development/DEVELOPER-WORKFLOW.md) | Intended setup, maker and feature-development path. |
| [Setup/makers](docs/development/SETUP-AND-MAKERS.md) | Dependency-free wizard and safe source generators. |
| [Entity documents](docs/development/ENTITY-DOCUMENTS.md) | Typed entities to Markdown through the shared service. |
| [Errors/notifications](docs/architecture/ERRORS-AND-NOTIFICATIONS.md) | Effect-aware outcomes, feedback ownership and recovery. |
| [Events](docs/architecture/EVENT-BUS.md) / [styles](docs/architecture/STYLES.md) | Runtime-scoped typed events and one composed plugin stylesheet. |
| [Maintenance/release](docs/development/MAINTENANCE-AND-RELEASE.md) | Current dependencies, fixed candidates and explicit publication. |

## Run what exists today

With Node available, no project dependency installation is needed for:

```sh
node scripts/testing/verify-baseline.mjs --repeat 3
```

It checks the actual baseline through 40 Node tests, each run three times in fresh processes with no retries. Reports include exact test IDs, source/input hashes, JSON, JUnit, a readable summary and unverified acceptance gaps. This is NOT full `npm run verify` or measured production coverage.

The optional native-readiness guard is intentionally blocked:

```sh
node scripts/testing/verify-baseline.mjs --profile release --json
```

It exits 2 without publication, because the actual native-candidate validator and evidence do not exist yet.

Inspect the original stylesheet specimen with:

```sh
node scripts/harness/serve-style-fixture.mjs --port 4174
```

For an explicitly preprovisioned Playwright/browser environment, `node scripts/testing/check-browser-specimen.mjs --mode served` runs eight browser checks. Missing dependencies/environment fail rather than silently install. Inline diagnostic mode is available explicitly and cannot establish served CSS/CSP or native behavior. See the test concept and [execution record](docs/testing/2026-09-22-verification-record.md).

## Intended complete template

```text
Get template → npm run setup → npm run make → develop
→ full verification → test exact candidate in Obsidian → approve release
```

The future setup starts with Node-only checked-in scripts before node_modules exists. Makers generate ordinary source with explicit wiring and tests; no note creation during setup/scaffolding. Domain/application code stays independent of host/UI APIs. main.ts remains composition-only and at most 100 physical lines; other handwritten source/CSS/tooling at most 400, tests/helpers at most 450.

Each view owns Vue/Pinia state and disposables; canonical data lives in its defined store. Note-backed Tasks use Markdown, not a duplicate data.json database. The bus carries typed committed facts and normalized native events. Source CSS modules and compiled SFC styles produce one plugin styles.css; the host shim never ships with it.

Preserve user data, use contained test vaults, keep exact qualified dependencies current through reviewed updates, and publish only accepted fixed-commit assets. Browser specimen evidence cannot establish native/mobile compatibility.

## Verification maturity

The read-only Linux/Windows baseline workflow is included with pinned official actions. Its configured Node 24.21.0 environment is a CI qualification target; local testing used Node 22.16.0. No hosted/Windows result is inferred from local Linux execution. The complete Vitest/Vite/Playwright Test matrix still needs WP-00 qualification; this dependency-free bridge does not replace it.

[Agent instructions](AGENTS.md) · [Tooling guide](scripts/README.md) · [License](LICENSE)
