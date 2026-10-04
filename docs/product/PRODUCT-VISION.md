# Workbench — product vision

> **Version:** 1.0 · **Date:** 2026-09-29 · **Product owner:** Luis85
> **Status:** Product direction. This document establishes the name and intended value; it is not an implementation, qualification or release claim.
> **Review baseline:** PR #5 at `15f74eaec78b5555bed94e4310472db841e371f7`.

## Focus on your idea.

**Workbench is a developer-focused tool to create and manage declarative user interfaces for webapps and Obsidian plugins.**

**Save time. Not quality.**

Bring an idea into a connected, inspectable project: define its pages, components, interactions and journeys; review the experience; generate maintainable source; and keep the documentation connected as the product changes. Workbench should remove repetitive work without removing the developer's understanding, control or responsibility.

## Vision

**Enable developers to turn ideas into maintainable user interfaces without repeatedly rebuilding the foundations or reconstructing the documentation.**

A project's intent, UI definitions, previews, generated artifacts and documentation should form one connected workflow rather than separate handoffs. Developers should spend more time on what makes their product useful and less time translating the same decisions between tools.

The ambition is not simply to generate a first screen faster. It is to make the next change understandable, safe and economical too.

## The problem we are solving

Our working problem hypothesis is that developers lose useful time when product intent, interface design, implementation and documentation become disconnected. Repeated setup and boilerplate compete with product work. A component change creates manual updates across pages and documents. A prototype can look finished while leaving its behavior or implementation unclear. Rebuilding those connections becomes another maintenance task.

Workbench addresses this by making interface intent explicit and reusable, carrying the relevant context through the development workflow, and exposing the work that still needs human implementation or review. These are product hypotheses to validate with real projects, not claims of measured market demand or proven time savings.

## Who Workbench serves

**Primary users are developers and technically hands-on product builders** creating webapps or Obsidian plugins. This includes individual builders and developers in product or agency teams who need an efficient path from a product idea to code they can maintain.

**Collaborating users include product owners and designers** who need to describe, inspect and discuss the intended experience. They should be able to contribute without treating every design decision as a coding task. Workbench does not promise that a nontechnical user can generate a complete production application without engineering work.

**Maintainers and coding agents are additional consumers of the artifacts.** Clear contracts, readable files, structured diagnostics and explicit ownership should support them without making AI or an external service mandatory.

## Three product promises

### 1. Save time without sacrificing quality

Automate repeatable setup, composition, validation, generation and documentation work. Keep important decisions visible and preserve the quality gates that make the result trustworthy.

A generated scaffold is not an implemented business workflow. A successful build is not user acceptance. Unsupported behavior must be explained rather than silently omitted. Speed is valuable only when the resulting interface remains understandable, testable, accessible and maintainable.

### 2. Document along the way

Capture decisions and relationships where they are made. Pages, components, interactions and journeys should carry meaningful descriptions and connections to product intent. Reuse that information in project documentation instead of asking the developer to explain the same structure again at handover.

Generated structure must not be presented as authored rationale. Missing descriptions, uncertain mappings and unimplemented behavior must remain visible. Preserve handwritten content and make ownership explicit when importing or generating Markdown.

### 3. Put developer experience first

Make the next useful action clear. Provide approachable visual tools and an inspectable CLI workflow over shared contracts. Show changes before applying them, explain validation failures, and keep generated source under the developer's control.

A developer must be able to inspect the data, review a diff, extend the implementation and continue working without a running Workbench authoring interface. Convenience must not become lock-in.

## The core job

> When I have an idea for a webapp or Obsidian plugin, help me define and evolve its interface, preview it and create a documented implementation foundation, so I can focus on the product-specific behavior instead of repeating setup and translating the same decisions between tools.

The intended journey is:

**Describe the idea → configure the project → bring in existing documentation or choose a starter → compose the UI → review and validate → generate source and documentation → implement, test and evolve.**

Users may enter with an existing project, typed Markdown or a declarative definition. Design-only work is legitimate. The journey does not require every user to start with an empty repository or install every optional tool. Exact supported entry paths remain defined by implementation guides; this vision does not introduce new CLI commands.

## What “declarative” and “manage” mean

**Declarative** means that interface structure, component contracts, bindings, interactions and navigation are represented as explicit, validated data. Visual editing is an authoring method for that model, not a separate hidden source of truth. Arbitrary application code is not made portable merely by putting it in a JSON string.

**Manage** means retaining useful identity and relationships over time: organize and reuse elements, understand their dependencies, review revisions and affected usages, bring documentation into the project, and regenerate deliberately without losing developer-owned work. Workbench is not just a one-time boilerplate generator.

## Product boundary

Webapps and Obsidian plugins are the two primary UI delivery targets. The Workbench authoring experience, CLI, shared compiler and reusable shell are product capabilities and delivery surfaces, not competing public product names. Existing technical identifiers remain unchanged until a separately scoped migration.

The focus is UI creation and lifecycle management. Workbench is not a promise of automatic business-logic completion, a replacement for an IDE or engineering judgment, a general backend platform, or an autonomous deployment service. Existing website, CLI and hybrid presets are not removed by this focus; they remain supporting capabilities whose existence does not establish full UI-generation parity.

Local, inspectable artifacts and independent consumers remain central. AI assistance is optional. Publication, dependency execution and native installation remain explicit operations with their own authorization and evidence boundaries.

## How we will know the vision is working

The proposed primary outcome is **less elapsed time to deliver a reviewed, documented and maintainable UI change, without weakening its acceptance criteria**.

Validate this with matched tasks in representative webapp and plugin projects, comparing the existing manual workflow with Workbench. Include a first useful screen and a later component change. Record both hands-on work and blocked time; use the same output scope and quality checks. Do not infer productivity from generated file counts.

Supporting measures are successful first-use completion, manual rework after generation, documentation completeness and freshness, safe-regeneration outcomes, and developers' ability to understand and extend the result. Quality guardrails include retained tests, relevant accessibility checks, visible unsupported behavior and no loss of authored or developer-owned content. No baseline, numeric improvement target or telemetry program is established by this document; start with voluntary task-based evaluation.

## Decision authority and related documents

This document is the canonical source for **the Workbench name, positioning and product promises**. [Product principles](PRODUCT-PRINCIPLES.md) translate the vision into design and backlog decisions. The [PR #5 vision review](../_archive/product/PR5-VISION-REVIEW.md) separates inspected implementation from intended direction.

The [documentation map](README.md) links the existing framework, authoring and MVP requirements. Their requirement IDs, detailed acceptance obligations and [delivery gates](DELIVERY-STRATEGY.md) remain in force. Resolving the product name does not rename the repository, executable, package, manifest ID, storage namespace, schema or generated consumer identity; it does not mark a task done or authorize a release.
