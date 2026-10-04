# Workbench — product principles

> **Version:** 1.0 · **Date:** 2026-09-29
> **Status:** Product and design guidance derived from the [vision](PRODUCT-VISION.md). Requirements and proposed follow-up acceptance below are not claims that every capability is implemented.

## 1. Save repetition, not understanding

Automate mechanical work: project preparation, repeated UI structures, contract checks, artifact generation and documentation scaffolding. Keep product decisions, file changes, limitations and remaining implementation work inspectable.

**Decision test:** Does the feature reduce repeated effort while making the result at least as easy to understand and maintain? A shorter wizard that hides a destructive operation fails this test.

## 2. One connected project, explicit ownership

Pages, reusable components, interactions, routes, journeys and relevant requirements belong to a connected project with stable references. Editors, imports, the compiler and documentation tools must agree about identity and contracts instead of creating unrelated copies.

One connected project does not mean one universal file format. Maintain an explicit owner for each field and representation:

| Artifact | Intended authority and boundary |
| --- | --- |
| Declarative project/UI model | Structured interface definitions, stable IDs and relationships; visual editors operate on the shared model. Existing project JSON remains an exchange/compiler contract. |
| Authored typed Markdown | Human-maintained descriptions, requirements and other declared fields. Import must define what it owns and how it reconciles with existing elements. |
| Generated Markdown | A derived view of explicitly selected project information, with traceable origins and bounded ownership. It must not silently become a second editable authority for the same fields. |
| Generated source | Declared generated regions/files with provenance and regeneration rules. |
| Developer-owned source and notes | Human implementation and commentary that generation preserves, or reports as a conflict before writing. |
| Preview and reports | Derived evidence of a particular model/artifact state, not a competing project database or an acceptance decision. |

Do not claim unrestricted bidirectional synchronization. An import/export contract must identify the canonical owner, stable identity, revision, mapping, unsupported data and conflict behavior. Preserve unrelated frontmatter and prose. A failed or stale import must not silently replace committed project content.

## 3. Declarative does not mean arbitrary executable text

Describe structure, properties, slots, events, bindings and supported interactions through validated contracts. Reuse the existing visual model and compiler seams rather than introducing a second page language just for preview or documentation.

Keep framework/host adapters and application-specific behavior explicit. A valid definition may still require an adapter or handwritten business logic. Report that requirement at the affected element. Importing a definition is not permission to execute embedded scripts, install dependencies, access a vault or publish artifacts.

Framework-neutral intent does not guarantee identical capability in every output target. Advertise supported combinations and fidelity limits rather than “generate any application.”

## 4. Documentation is part of the work

Capture useful descriptions, rationale, requirements and relationships at the relevant editing step. Let users start with existing material rather than requiring a parallel documentation exercise after design.

The requested direction includes typed Markdown pages, components, interactions and journeys: import a file or folder as project elements and generate a complete documentation structure from selected project elements. This is a retained product requirement, not an assertion that the full import/export workflow is complete at the reviewed PR #5 head.

Generated documentation should identify its source elements and distinguish authored explanation from structural output. Missing descriptions and unsupported behavior should appear as explicit gaps, not plausible invented documentation. Review success means that a developer can use the docs to understand the interface and its contracts, not merely that Markdown files exist.

## 5. Developer experience is an end-to-end property

A developer should know what to do next, what will change, what succeeded, what remains unfinished and how to recover. Prefer a small discoverable path before exposing the full tool catalog.

Visual authoring and CLI operations should share application contracts, validation, plans and diagnostics. Keep human-readable guidance and machine-readable results useful together. Do not force visual-editor usage for an operation already supported through inspectable files and tooling.

Show previews before writes, preserve edited files, reject stale plans, and explain conflicts at the affected file or element. Keep dependency installation separate from generation. Maintain clear extension points and an independently buildable consumer that does not contain or require the authoring application.

## 6. Configuration and starters should make projects adaptable

Retain the requested direction for configurable paths and preferences in `configs/user-settings.json`. Configuration must make the user's project layout explicit, validate destinations and preserve existing files. These product expectations do not introduce that file or a new precedence/migration algorithm through documentation alone.

Retain the requested starter architecture: discover standalone definitions in `configs/starters/<starterName>.json`; use each definition to describe what is needed to list, edit and run the starter's subsequent processes; distribute starter definitions as a separate ZIP rather than embedding them in the shell release. The shell provides the execution capabilities and validation contracts, not hidden starter-specific product behavior.

A compiler target/framework preset and a complete project starter are related but different concepts. The existing preset catalog is not evidence that the external-starter architecture is finished. A data-only starter can describe supported operations; it must not silently authorize arbitrary code or escape approved project paths. Missing or incompatible definitions need actionable diagnostics, not an undocumented bundled fallback.

## 7. Make the second change as important as the first

Reuse and evolution are core product work. Component revisions, dependency visibility, affected usages, deliberate migration and ownership-aware regeneration should reduce the cost of changing a product.

Prioritize representative maintenance scenarios: change a shared component contract, inspect affected pages, update a journey, preserve a developer extension, regenerate and review the resulting diff. Do not optimize only for a clean first generation into an empty folder.

## 8. Quality must be visible and evidence-bound

Keep existing coverage, architecture, source ownership, lifecycle and security gates. Include relevant keyboard, focus, validation, error-state and host-style behavior in acceptance. Do not claim accessibility compliance or native support from a screenshot or browser build alone.

Use separate outcome labels for modeled, validated, generated, built, tested and accepted. A scaffold, test stub or disabled business action stays clearly identified. Missing evidence stays missing. A deterministic fingerprint identifies inputs and output; it is not approval, authenticity or release authorization.

Prototype fidelity is a product concern: reviewers must understand which layout, navigation, local state and business behavior are actually represented. Never repair only a disposable generated preview while leaving its source definition or generator inconsistent.

## 9. Fit the host; keep the user's control

Webapps and Obsidian plugins are primary output targets, not interchangeable runtime environments. Respect host-specific lifecycle, storage, commands, themes and supported-platform boundaries. Distinguish the Workbench authoring host from the runtime targeted by the user's project.

Design-only work should not require an account, external AI, Node/npm/Git or a template download. Build and dependency operations may have explicit environmental requirements. Keep optional AI, memory and adjacent workbenches out of the default critical path. Do not turn local-first authoring into a claim that every installation or release step works offline.

## 10. One product name; deliberate technical migration

The product is **Workbench**. Use “Workbench” in new product copy and refer descriptively to its visual authoring, CLI, compiler and reusable shell. “Shell Workbench,” “Plugin Shell companion” and “Companion” may remain in historical records or as explanations of existing code paths; they are not alternative public product names.

For now, preserve the `node bin/app` CLI entry, existing npm commands, repository/package identifiers, `companion` paths, JSON/schema versions and manifest/storage identities. Generated projects keep the user's chosen product name. Any executable or storage-identity rename needs a separately reviewed compatibility and migration change. Do not break links or rewrite historical evidence to make a cosmetic rename look complete.

## Backlog decision filter

For each proposed capability, identify the user job, repeated work removed, affected model/contracts, documentation captured, developer escape hatch, quality guardrails and evidence needed. Map it to the existing requirement/task inventory before creating new work. Reject silent data loss, invented capability claims and weakened gates regardless of convenience.

Prefer the smallest complete, testable vertical workflow over another disconnected editor. Existing [delivery gates](DELIVERY-STRATEGY.md) still govern sequence; this guidance does not automatically reprioritize or close a task.

## Proposed representative acceptance scenario

Use one small webapp and one small Obsidian plugin with a page, reusable component, interaction, journey and linked requirement. Bring in existing project context; author and validate the UI; preview supported behavior; generate source and documentation; implement the disclosed extension; and verify each target in its relevant environment.

Then change the shared component and regenerate. Check stable references, visible impact, preserved handwritten code/prose, accurate documentation and unchanged quality gates. Unsupported behavior must remain explicit. Record time and rework for comparison with the same task performed manually. This is a proposed product-learning scenario, not a test run performed by this documentation change.
