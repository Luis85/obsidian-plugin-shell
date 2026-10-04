# Companion concept roadmap

**Status:** Active feature development. The browser concept is not a native plugin and is not declared feature-complete. **Date:** 2026-09-24.

Read the [concept guide](README.md), current PRD (maintainer-only asset, not included), delivery strategy (maintainer-only asset, not included) and concept task lane (maintainer-only asset, not included).

## Work now versus work later

The highest-priority implementation is the reusable shell. Concept exploration may continue secondarily to clarify needed features and avoid building the wrong shared APIs. Do not convert a prototype interaction directly into a private companion-only service when a generic shell capability is missing.

A future conversion baseline selects a bounded native increment. It is not a freeze on the entire feature roadmap. Mark each capability as implemented-in-concept, proposed, revised or deferred, and separately track native implementation and qualification. Prototype assertions never change native status.

## Current feature-development tasks

| Task | Outcome |
| --- | --- |
| CX-001 (maintainer-only asset, not included) | Inventory current and requested features, unresolved decisions and shell dependencies. |
| CX-002 (maintainer-only asset, not included) | Refine the complete lifecycle, design-only entry and contextual navigation. |
| CX-003 (maintainer-only asset, not included) | Improve consistent editor interactions while preserving the recent source/relationship/selection fixes. |
| CX-004 (maintainer-only asset, not included) | Specify actions, source operations and test-data scenarios together. |
| CX-005 (maintainer-only asset, not included) | Design-system authoring with meaningful Markdown/HTML export preview. |
| CX-006 (maintainer-only asset, not included) | Review generation coverage, conflicts, ownership and recovery coherently. |
| CX-007 (maintainer-only asset, not included) | Review the explicit scope that can be converted once its shell prerequisites are ready. |

Retain one vault/one project, requirements, entity relationships, view containers/internal screens, reusable component variants, source/operation/flow distinctions, stable IDs, drafts, Undo/Redo and explicit recovery. New features need defined behavior, not just a sidebar entry.

## Shared fixtures and scenarios

Use one small Tasks design throughout welcome, project definition, editors, generation review, test-vault handoff and recovery. Add design-only, unsupported external adapter, conflicting source file, customized-code, invalid schema, deterministic fixtures and design-token export scenarios.

Missing developer tools must not block design. Examples remain explicitly requested. All acquisition, writes, builds, deployment, connection tests and receipts in the browser remain clearly simulated unless a separately implemented and qualified behavior actually exists. The existing prototype cannot establish native filesystem, concurrency, accessibility-device or performance guarantees.

## Acceptance of concept increments

Each increment records the exact concept revision and artifact, changed features, retained regressions, observed interaction tests and unresolved questions. Show empty/loading/error/conflict states, usable narrow panes and non-drag/keyboard paths. Distinguish real pointer interactions from controlled-model assertions.

Scope changes that affect source schemas, fixtures, token export or makers must update the corresponding SH task and compatibility contract. Keep generic work in the shell lane; companion screens consume it later.

## Conversion handoff

CP-001 (maintainer-only asset, not included) converts the concept to a native product on the shell only after SH-022 (maintainer-only asset, not included), SH-034 (maintainer-only asset, not included) framework shipment and CX-007. It is followed by dedicated persistence/editor/generation/test-data/design-system/run tasks, not treated as a one-step HTML packaging exercise.

Handoff includes a feature inventory, selected/deferred scope, interaction contracts, canonical records, test fixtures, shell capability mapping and explicit unsupported behavior. New feature work remains possible after handoff through reviewed changes. Publication is a separate final lane.

## Framework-first entry refinement — 2026-09-24

The first delivered user journey starts with the standalone framework archive and CLI, not this plugin. The concept remains an optional authoring interface; its exported project JSON must drive the same shared makers/compiler used by the CLI. Keep one-project-per-vault and design-only use without Node. SH-033 qualifies the framework-side operation adapter headlessly before native conversion; native process integration and policy acceptance remain explicit later work. See the implementation plan (maintainer-only asset, not included).
