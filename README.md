# Obsidian Plugin Shell

A planned GitHub template for maintainable, agent-ready Obsidian plugins built with TypeScript, Vue 3, and Pinia.

> **Current status: specification only.** The repository contains the product requirements and contributor/agent entrypoints. It does not yet contain an implemented plugin, `package.json`, runnable npm scripts, a frontend harness, or CI workflows. Requirements describe the target product, not verified capabilities of the current repository.

## Start here

| Document | Purpose |
| --- | --- |
| [Product requirements](docs/product/PRD.md) | Scope, researched decisions, architecture, functional requirements, quality policy, command contracts, 24 acceptance scenarios, and ten implementation work packages. |
| [Agent instructions](AGENTS.md) | A concise entrypoint for coding agents and contributors; links to the authoritative requirements. |
| [Claude Code entrypoint](CLAUDE.md) | Imports the same agent instructions rather than maintaining a second policy. |
| [License](LICENSE) | Repository license. |

## Intended foundation

The template will integrate **Vite, Vitest, Oxlint, fallow, TypeScript, Vue 3, Pinia, and `eslint-plugin-obsidianmd`**. Vue I18n and Playwright are the proposed localization and browser-testing additions. Exact compatible versions are selected and proved in the first implementation package, not inferred from this list.

The supplied plugin will demonstrate settings, durable storage, vault-local preferences, a view shell, commands, a ribbon action, native modals, notices, localization, error handling, and bounded local diagnostics through one small removable example feature.

### Architecture

```text
presentation -> application -> domain -> shared
infrastructure -> application contracts / domain / shared
bootstrap -> concrete adapters and presentation factories
main.ts -> minimal host lifecycle and composition
```

Domain and application code remain independent of Obsidian, Vue, Pinia, Node, and browser APIs. Application-owned repositories hold canonical data; each view owns its Vue app and ephemeral Pinia state. Dependency directions must be enforced, including aliases, re-exports, Vue files, and unclassified source files.

### Quality and evidence

Handwritten source files are limited to **400 physical lines** and test files to **450**, counting comments and blank lines. The PRD additionally proposes a **100-line composition-only `main.ts`**. The whole Vue Single-File Component counts toward its limit.

Verification will combine type checking, complementary Oxlint/ESLint rules, full and production-scoped fallow analysis, architecture checks, coverage, localization checks, artifact validation, and browser tests. Deliberately invalid fixtures must prove that important gates actually reject the defects they claim to detect.

The frontend harness will run the real presentation and application code with explicit fixture adapters. Playwright tests will assert behavior and retain useful failure evidence. A harness pass will not be represented as proof of real Obsidian compatibility; native-host and mobile evidence have separate requirements.

### Local testing

The planned default development vault is inside the repository:

```text
.dev-vault/.obsidian/plugins/<plugin-id>/
```

An explicit repository-root-vault mode will also be supported. Installation must preserve plugin data, notes, unrelated plugins, and security settings. Build scripts must not disable Restricted Mode or silently replace malformed vault configuration.

The future command interface—including `build`, `build:local`, `test-build`, `harness:dev`, `test:e2e`, `verify`, and `verify:release`—is specified in **PRD section 15.3**. These commands do not exist yet.

## Implementation entrypoint

Begin with **WP-00 — Compatibility and decisions** in PRD section 20: prove the package-version combination, the Obsidian-loadable Vite output, the native settings API and minimum host version, fallow enforcement behavior, and the chosen host-testing approach.

Then implement the dependency-ordered packages incrementally. Each package identifies its deliverables and exit evidence. Do not implement the entire PRD as one unreviewed change or weaken a gate merely to make a package appear complete.

## Research and limitations

The PRD includes primary-source references for Obsidian, Vue, Pinia, Vite, Vitest, Oxlint, fallow, Playwright, and agent workflows, plus selected source-file observations from `Luis85/renovation-planner` and `Luis85/backlog-view`. The review is not a full audit of those repositories.

English/German localization, npm, the example-item feature, additional coverage/complexity thresholds, and initial performance budgets are explicitly proposed defaults. No runtime benchmark, plugin host test, or package compatibility experiment has been performed as part of the documentation delivery.

GitHub's **Template repository** setting and generated-repository administration are maintainer setup tasks described by the PRD; documentation files alone do not configure them.
