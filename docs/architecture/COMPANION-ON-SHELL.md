# Architecture contract: the companion is a shell consumer

**Status:** Proposed implementation contract, 2026-09-24. No production conversion is claimed. The [delivery strategy](../product/DELIVERY-STRATEGY.md) governs sequencing; [CP-001](../tasks/companion/CP-001.md) is the explicit integration task.

## Dependency direction

```text
Independent plugin composition ─┐
Companion product composition ──┼──> shared shell public APIs/runtime
Browser harness composition ────┘

CLI ────────────────────────────┐
Companion operation adapter ────┼──> shared tooling contracts/planner/makers
Contract test runner ───────────┘
```

The shell never imports the companion. Generated plugins never import the companion. The concept's virtual files, global state and simulated receipts are not production services.

## Existing extension points to preserve

Start from `src/features/api.ts`, explicit `src/bootstrap` registries, `src/application`, `src/domain`, infrastructure adapters, and `scripts` tooling. Keep the current Vue/Vite/Pinia/Nuxt UI foundation; this is not a Nuxt-framework migration. Use logical product composition before requiring a repository-wide package move.

| Responsibility | Owner |
| --- | --- |
| Entity schemas, generic repositories, document recipes, shared settings writer | Shell runtime |
| Lifecycle, host views, commands, native dialogs/notices, logging and typed events | Shell runtime/adapters |
| Styles, namespace containment, token contracts and generic exporters | Shell style/tooling APIs |
| Operation catalog, plan/apply, locking, recovery, receipts and maker composition | Shared standalone tooling |
| Design record types and source/action contracts usable by compiler and UI | Framework-free shared contracts with explicit versions |
| Requirements, sitemap, entity/source/component editors and project UX | Companion features and presentation |
| Definition-specific fixtures, screen compositions and product help | Each consumer, using shell extension points |

Domain/application contracts do not import Obsidian, Vue, Pinia, Node or browser globals. Main remains lifecycle composition within existing code-line limits. Presentation components bind composables/stores; feature factories use injected services. Preserve dependency-direction, coverage, analyzer and source limits.

## Real reuse, not a copy

Compose the companion from the same maintained foundation revision used by standalone exports. Do not create a duplicate DocumentCreationService, saveData writer, event bus, notification store, theme engine or installer. Missing generic behavior becomes a shell task and independent-consumer regression before companion adoption.

Product identity, settings, commands, styles and view IDs must be isolated. Installing/testing one composition cannot replace another's assets or data. The root manifest is unchanged by planning; distribution identity is a later explicit decision.

The native entry slice must register and dispose through shell APIs, save one real project record through the shared repository/document service, and reopen that record. Later tasks integrate the full accepted concept scope. The HTML may remain as a design fixture, but must not be shipped as an iframe/webview application or used as the persistence authority.

## Storage and operation boundaries

Canonical note-backed design data is Markdown with stable IDs and validated owned fields. Preserve manual bodies and unrelated properties. Plugin preferences contain preferences, not another design database. Machine-local approvals and logs are not portable authorizations. Multiple leaves share committed data and one operation owner, while retaining independent drafts.

The primary standalone development project is the extracted framework directory and need not be inside a vault. The companion may retain its one-project-per-authoring-vault and optional same-vault source route. These are distinct host-root selections; portable JSON never chooses an absolute source root. Source/test folders resolve relative to the explicitly selected project root. The isolated test vault is a separate runtime context. Resolve and protect the actual host config directory; `.obsidian` is not universal. Preserve old `.dev-vault` locations; introduce the new-kit `.test-vault` default through reviewed configuration/migrations, not silent movement.

UI and CLI consume one versioned protocol and coordinate locks. Data-only discovery must not evaluate arbitrary project configuration. Process execution uses typed operations, explicit arguments, bounded output and reviewed capabilities, never arbitrary shell forms. Safe argument handling is not a sandbox for project scripts. A user-run CLI handoff must remain viable.

## Generation and extension contracts

Normalize stable design IDs, selected scope, actions, entities, source usages and component bindings into a shared intermediate representation. Separate native containers, internal screens and embedded components. Layout/selection changes do not affect generation fingerprints. Unsupported mappings remain visible, not silent omissions.

Generation plans record ownership and exact preimages. Preserve customized files. First generation, additive feature generation, template upgrades and runtime-data migration are different operations. Do not promise arbitrary bidirectional code/design synchronization.

Data generators implement the same source operation contracts as real adapters. Seed, clock, locale and version are fixed for reproducibility. Test providers and production providers are explicit modes; no mock silently substitutes for an unavailable production adapter. Design tokens/exporters must work for a standalone consumer without the companion editor.

## Mandatory proof

For framework readiness, run minimal/richer independent consumers and the headless companion adapter; a native companion is not required. After conversion, also run the actual companion against the shipped framework. Remove the companion and maintainer workspace and still install/build/verify the exported consumer. Detect companion imports, unpublished workspace dependencies, retained approvals and concept assets in exports. Repeated view open/close, multiple leaves, restart and failure paths must exercise actual shell services.

Each acceptance record distinguishes contract, filesystem, generated consumer, browser, native, manual accessibility and performance evidence. Successful composition is not publication approval.

## CLI and companion adapter refinement — 2026-09-24

The [framework CLI/generator plan](../development/FRAMEWORK-CLI-GENERATOR-PLAN.md) controls the first shipment. Author CLI and shared tooling in TypeScript; distribute a compiled bootstrap runnable before dependency installation. CLI, setup wizard, individual makers, JSON compiler and companion adapter call shared operations rather than parse human output or fork behavior. Keep Node/process dependencies outside the native runtime bundle.

SH-033 qualifies a headless consumer of discovery, request/plan/apply/progress/result/recovery contracts before native conversion. It covers capabilities, protocol compatibility, source-bound receipts, denied execution, cancellation and fallback to a user-run CLI. Direct host execution is not assumed to be policy-approved or universally available. CP-004/CP-008 implement native presentation only after SH-022, SH-034 and CX-007.

Preserve the [existing read-only v1 handoff](../development/COMPANION-PROJECT-JSON.md). Deep semantic validation, imported settings reconciliation and shared deterministic maker composition are required before any new writer. A transfer envelope, plan or receipt is data, not authorization.
