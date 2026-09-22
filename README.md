# Obsidian Plugin Shell

A planned GitHub template for starting, maintaining, and releasing Obsidian plugins with **TypeScript, Vue 3, Pinia, Vite, Vitest, Oxlint, fallow, and Obsidian ESLint**.

> **Current status: specification only.** PRD **0.2.0** and the guides below describe the target implementation. No plugin, package scripts, frontend harness, updater, CI, or release workflow has been implemented or activated yet.

## Start here

| Document | Read it for |
| --- | --- |
| [Developer workflow](docs/development/DEVELOPER-WORKFLOW.md) | The short setup path, first feature change, browser/native development, and troubleshooting. |
| [Maintenance and release](docs/development/MAINTENANCE-AND-RELEASE.md) | Dependency updates, latest-stable support, release preparation, draft/publish stages, and initial listing. |
| [PRD 0.2](docs/product/PRD.md) | The implementation contract, architecture, quality rules, 35 acceptance scenarios, and ten work packages. |
| [Research and sources](docs/research/2026-09-22-template-research.md) | Dated findings, 35 primary-source references, alternatives, and verification limitations. |
| [Agent instructions](AGENTS.md) | Shared contributor/agent rules; [CLAUDE.md](CLAUDE.md) imports the same guidance. |
| [License](LICENSE) | Repository license. |

## Intended developer path

```text
Use template → initialize identity → run real UI → implement a feature
→ verify → test in Obsidian → create draft → approve and publish
```

The future quickstart is `npm ci`, `npm run setup`, and `npm run dev:ui`. Normal work uses `dev:local`, `verify`, `release:prepare`, and `help`. These commands do not exist in the current documentation-only repository.

The template will ship one small removable example with native settings, storage, a view, commands/ribbon, modals/notices, English/German localization, error handling, and bounded local diagnostics. UI work uses the real components in a deterministic browser harness; actual Obsidian compatibility has separate native evidence.

## Current by policy, reproducible by build

Target the **latest public/stable Obsidian**. Catalyst is optional early-warning testing, not a prerequisite. The research snapshot on 2026-09-22 found public desktop **1.13.7** and early-access **1.14.2**; implementation must re-resolve the current public target.

Use current declarative native settings rather than maintaining an unnecessary legacy tab. Select the supported Active LTS Node/toolchain, pin tested dependencies and the lockfile, then keep them current through reviewed update PRs. **Dependabot is the default; Renovate is an optional replacement.** Neither dependency updates nor agents publish releases automatically.

The intended release workflow prepares consistent metadata, builds a candidate from a fixed commit, creates a draft, collects host evidence for its exact files, and explicitly promotes those same assets. First Community directory submission remains a separate maintainer step.

## Architecture and safety

```text
presentation → application → domain → shared
infrastructure → application contracts / domain / shared
bootstrap → concrete adapters and presentation factories
main.ts → minimal host lifecycle and composition
```

Domain/application stay independent of Obsidian, Vue, Pinia, and browser/Node APIs. Each view owns its ephemeral Vue/Pinia state; application services own canonical data.

Handwritten source is limited to **400 physical lines**, tests/helpers to **450**, and composition-only `main.ts` to **100**. Count the entire Vue SFC, comments, and blanks. Configured tools and negative fixtures enforce actual boundaries rather than relying on folder names alone.

Local installation defaults to `.dev-vault/.obsidian/plugins/<plugin-id>/` inside the repository. An explicit repository-root-vault mode is also planned. Preserve existing data, notes, other plugins, and security settings; do not disable Restricted Mode automatically.

## Implementation entrypoint

Start with **WP-00** in the PRD: resolve and prove the latest-stable package/host combination, native Vite loading, declarative settings storage hooks, fallow boundary coverage, and test provisioning. Then implement the bounded packages, ending with a differently named generated repository and release rehearsal.

The research did not execute a build, benchmark, browser suite, or host test. Direct npm registry access was insufficient for a verified all-package patch-version matrix. Repository administration, update schedules, and release capabilities remain implementation/setup tasks—not claims made by these documents.
