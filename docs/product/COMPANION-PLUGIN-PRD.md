# PRD: Plugin Shell companion developer workbench

> **Revision:** 0.4.0 documentation contract · **Date:** 2026-09-24 · **Owner:** Luis85
> **Status:** Evolving concept and proposed native product. Not feature-complete, not a native implementation, not release-qualified.
> **Working name:** Shell Workbench; public name and ID remain subject to later review.

## Current product decision

The repository delivers a proper reusable **Plugin Shell first**. The companion is a demanding consumer of that foundation, not a shortcut around unfinished shell capabilities. After the shell meets its internal readiness gate and the conversion scope is reviewed, integrate the concept into a real Obsidian plugin using the same maintained shell runtime, feature APIs, styles and tooling. Qualify that plugin before publication.

The [delivery strategy](DELIVERY-STRATEGY.md) and [improvement plan](COMPANION-IMPROVEMENT-PLAN.md) supersede the earlier milestone ordering. They do not withdraw the retained requirements, safety rules or scope distinctions. The full previous PRD is preserved byte-for-byte as [requirements baseline 0.3](COMPANION-REQUIREMENTS-0.3.md); its FR identifiers and detailed contracts remain references. Where its historical milestone order or priority labels conflict with the current strategy, the current strategy governs scheduling. A former P0 companion requirement does not outrank shell prerequisites.

## Two sequences, deliberately different

**Repository delivery:** shell capabilities and standalone qualification → continuing concept refinement and a reviewed conversion baseline → native companion built on shell → qualification → authorized publication.

**Eventual developer journey:** install companion → define/design one project → optionally add Plugin Shell → review generated source → build/test in an isolated vault → keep developing with or without the companion.

Design-only use remains legitimate. It must not require external Node/npm/Git, a template download or an account. Plugin Shell remains independently usable without the companion. One current authoring vault contains one project and becomes its source root; another project is another vault. See [single-vault contract](../concepts/companion/SINGLE-VAULT.md).

## Feature development remains open

Requirements, sitemap/views, entities/relationships, components/variants, data sources, action contracts, test-data authoring and the design-system experience remain subject to feature development and review. No whole-product feature freeze is implied by this PRD.

The [concept tasks](../tasks/README.md#concept-development-p1) maintain an explicit inventory of implemented-in-concept, proposed, revised and deferred behavior. A conversion baseline identifies the bounded scope to implement now, retained regressions and explicit deferrals; it does not declare every future feature complete. Changes after baselining require impact analysis and, where necessary, an additional shell task before the companion can depend on the new capability.

## Required shell dependencies

The shell must provide reusable composition/lifecycle, Markdown and plugin-data persistence, settings/path configuration, events/errors/feedback/localization, scoped styles and token export, source-operation contracts, deterministic fixtures, shared operation plans and recovery, standalone template export, additive preparation, generation primitives and input-bound verification.

Design-to-code compilation belongs to shared tooling over the existing maker/planner implementation. A data-only compatibility/capability contract drives UI forms; the companion must not maintain another installer, persistence writer or generator. Not every existing capability needs rewriting: inspect the [current authoring tools](../development/AUTHORING-TOOLS.md) and [readiness ledger](../development/TEMPLATE-READINESS-LEDGER.md).

## Native conversion acceptance

[CP-001](../tasks/companion/CP-001.md) explicitly converts the concept into a real shell-based product composition. The subsequent CP tasks complete persistence, editors, preparation, generation, fixtures, design-system authoring and run/recovery integration. A native boot alone does not complete conversion.

The implementation must preserve stable IDs and authored content; replace concept-global/virtual storage with shell-backed services; keep per-view drafts and shared committed state; and use real Obsidian lifecycle, commands, settings and disposal. The HTML concept is a specification and test fixture, not the production runtime.

A separate standalone consumer must still build and run after the companion is removed. Companion code must not enter generated plugins. Shell APIs may not acquire companion-specific branches merely to make dogfooding easier. See [architecture contract](../architecture/COMPANION-ON-SHELL.md).

## Gates and evidence

| Gate | Evidence required | Does not authorize |
| --- | --- | --- |
| Shell ready — SH-022 | Applicable shell capability matrix and independent consumer qualification | Companion readiness or publication |
| Conversion baseline — CX-007 | Reviewed, bounded concept scope and shell dependency mapping | A complete or implemented companion |
| Native companion ready — CP-010 | Actual native feature coverage, three product journeys and supported-platform evidence | Tags, release promotion or a listing |
| Publication — PUB tasks | Distribution/policy decision, matching artifacts, support docs and explicit owner approval | Unattended future releases |

Concept assertions, mocked host tests, compiled consumers, real native runs and manual accessibility evidence remain separate. Missing or skipped checks stay visible. Maintain all applicable parent-shell acceptance requirements and thresholds.

## Publication boundary

Distribution topology, public metadata and execution-policy acceptance must be resolved before publication, not by renaming the root manifest during concept development. A user-run CLI handoff remains a viable implementation boundary. No policy exemption or marketplace acceptance is asserted here. Recheck current primary-source rules in the publication tasks.

No tags, releases, directory submission, automatic activation, permissions changes or global package installation are authorized by this document.
