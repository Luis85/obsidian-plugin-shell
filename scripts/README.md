# Tooling directory

> **Current contents:** This guide only. Executable setup, makers, build/verification, and release scripts have not been implemented.

All future executable tooling belongs in this directory, as specified by [TOOL-01–06](../docs/development/SETUP-AND-MAKERS.md). Root package.json commands and Actions workflows call these implementations. Conventional root Vite/Vitest/Playwright/ESLint/TypeScript configs remain declarative or thin adapters.

## Entry and responsibility map

| Location | Responsibility |
| --- | --- |
| `setup.mjs` and `setup/bootstrap/` | Dependency-free Node entry and pre-install logic; no local package imports before approved installation. |
| `setup/steps/` | Validated identity, profile, installation, provisioning, readiness, resume. |
| `make.mjs` and `make/registry.mjs` | Discovery, parsing, interactive/noninteractive dispatch. |
| `make/makers/`, `make/templates/`, `make/custom/` | Built-in recipes, local versioned boilerplate, explicit custom extensions. |
| `shared/` | Small safe-file plan, child-process, input/output utilities. |
| `build/` | Shared Vite/plugin/style configuration and output checks. |
| `dev/` | Contained staged installation and optional target-checked native CLI. |
| `quality/` | Verification orchestration and event/style/tooling checks. |
| `release/` | Version preparation, retained candidates, explicit draft/promotion operations. |
| `maintenance/` | Online dependency/host freshness and maintenance reports. |

Implementation creates files only when exercised. Runtime event contracts/implementations and style modules remain under src, not scripts. Tooling tests live under tests/tooling and use isolated temporary repositories/vaults.

Use plain .mjs with JSDoc/checkJs for bootstrap; no TS loader may be necessary to start `npm run setup`. Do not connect setup to install/prepare lifecycle hooks. Arguments are not shell expressions. Standard tooling does not elevate privileges, install globals, modify personal vaults, or publish implicitly.

Handwritten scripts follow the 400-physical-line limit; test helpers/specifications follow 450. Maker-generated application code becomes ordinary maintained source. Generation must be planned, collision-safe, registered, and verified; marking all outputs as dynamic or generated is not a quality exemption.

See the [setup/maker contract](../docs/development/SETUP-AND-MAKERS.md), [event bus](../docs/architecture/EVENT-BUS.md), [style pipeline](../docs/architecture/STYLES.md), and [release guide](../docs/development/MAINTENANCE-AND-RELEASE.md).
