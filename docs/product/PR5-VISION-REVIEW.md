# PR #5 — Workbench vision review

> **Date:** 2026-09-29
> **Repository:** `Luis85/obsidian-plugin-shell`
> **Branch:** `docs/companion-plugin-prd`
> **Reviewed implementation head:** `15f74eaec78b5555bed94e4310472db841e371f7`
> **Tree:** `522854faa35c9b5af2d58cd82c137ae7f61132f1`
> **Scope:** Product identity, positioning, documentation coherence and selected implementation contracts. Not an exhaustive code audit, runtime qualification, market study or release approval.

## Assessment

PR #5 provides a credible foundation for **Workbench: a tool to create and manage declarative user interfaces for webapps and Obsidian plugins**. Its strongest fit is the connected workflow from authored definitions through validation and reviewed generation to developer-owned artifacts. The public explanation should lead with that user outcome, not with the internal history of a shell and its companion.

The principal documentation problem is not a lack of technical detail. It is the absence of one stable product story above the framework, authoring concept, compiler, presets and delivery records. The new [vision](PRODUCT-VISION.md), [principles](PRODUCT-PRINCIPLES.md) and [documentation map](README.md) supply that layer without discarding scoped requirements.

## Findings and documentation response

| ID | Observation at the reviewed head | Response |
| --- | --- | --- |
| WV-01 | The root README is titled “Obsidian Plugin Shell”; the authoring guide says “Shell Workbench Companion”; the companion PRD still treats the name as undecided. | Establish **Workbench** as the product name. Align the main entry documents, while preserving technical paths, commands, schemas and consumer identities. |
| WV-02 | The framework PRD focuses on obtaining a plugin template, whereas the preset catalog already distinguishes plugin, webapp, website, CLI and hybrid choices. | Explain webapps and Obsidian plugins as the primary UI targets. Keep existing additional presets without allowing them to redefine the core product promise. Distinguish authoring host, output target and frontend choice. |
| WV-03 | The compiler emits readiness metadata with build, typecheck and tests initially `not-run`, and acceptance `not-inferred`. Its project-preset path explicitly requires further visual-component and business-action implementation. | Define “save time” as reducing repeated work, not implying complete applications. Keep generated, built, tested and accepted outcomes separate. |
| WV-04 | Shared project definitions, the visual IR, routes/journeys and component contracts already underpin the authoring/generation design. | Build the vision around continuity and reuse. Do not propose another disconnected prototype, page schema, generator or project database. |
| WV-05 | Existing documentation is rich in engineering and acceptance detail, but there is no canonical product-level promise for documenting UI work as it happens. | Make documentation a product pillar. Define field ownership between authored Markdown, the structured model and generated documentation; retain the requested typed-document import/export direction as a requirement, not completed functionality. |
| WV-06 | Existing guidance prioritizes independent consumers, reviewed plans, preservation of edited files and explicit dependency execution. | Treat these as developer-facing benefits: source ownership, safe changes, understandable failures and freedom to continue without the authoring interface. |
| WV-07 | The overview and PR description retain a 2026-09-27 review, while the inspected head includes later work. | Identify old review counts and CI findings as historical. Do not carry their failing or successful status forward as a claim about this head. |
| WV-08 | The requested user settings and external starter-definition architecture are broader than the existence of a checked-in compiler preset catalog. | Retain `configs/user-settings.json`, `configs/starters/<starterName>.json` and separate starter ZIP distribution as product direction. Explicitly distinguish a starter from a compiler target/framework preset. |

## Implementation evidence and its limits

The following sources were inspected at the pinned head through GitHub. References below identify the maintained paths; the SHA above defines this review's snapshot.

| Source | Evidence used |
| --- | --- |
| [Root README](../../README.md) and [repository instructions](../../AGENTS.md) | Framework entry, runtime boundaries, source ownership, quality gates, native precautions and documentation conventions. |
| [Framework PRD](PRD.md), opening requirements sections | Existing template-focused goal and retained qualification/acceptance obligations. |
| [Companion PRD](COMPANION-PLUGIN-PRD.md) | Former working name, design-only use, independent shell, one-vault project model and native conversion gates. |
| [Product overview](../../SHELL-FIRST-OVERVIEW.md) | Former shell-first orientation, supported entry points and dated integrated evidence. |
| [Authoring entry guide](../concepts/companion/README.md) | Current build command and v6 artifact paths; v5 compatibility fixtures are not the current review entry. |
| [Compiler guide](../development/compiler/README.md) | Immutable inputs, separate generation and installation, provenance, ownership-aware plans and explicit qualification boundaries. |
| [Compiler implementation](../../bin/compiler/index.ts) | Project-preset dispatch, selection validation, explicit adapter-required diagnostic and emitted readiness states. |
| [Project starters](../../bin/PROJECT-STARTERS.md) (formerly the preset catalog) | Declared output/framework choices; not evidence of uniform compiler fidelity or completed business behavior. |
| [2026-09-27 review](PR5-PRODUCT-REVIEW.md), strategy and implementation findings | Prior product analysis and known distinctions; its test counts and workflow statuses were not requalified by this review. |

PR metadata and repository tree metadata were also inspected to identify the branch, head and existing documentation. Recent commit metadata confirms that the branch has moved beyond the September 27 review; commit messages alone are not runtime evidence.

The latest authoring guide still identifies a browser authoring concept rather than a complete installable native Workbench. The compiler source explicitly states that project preset output is a navigable starting scaffold and that visual component bodies and business actions require implementation. These boundaries are directly relevant to honest product copy.

## Product decisions captured

The product name is **Workbench**. The headline is **Focus on your idea.** The supporting promise is **Save time. Not quality.** The three pillars are time savings without quality loss, documentation along the way, and developer experience.

Creation and management both matter: reusable definitions, connected documentation, revisions, dependency impact and safe regeneration are part of the value, not merely successful first generation. Developer-owned implementation remains explicit. AI and adjacent memory/decision tools remain optional.

The name decision supersedes the former “Shell Workbench” working-name statement. It does not change manifest IDs, executables, repository/package names, persisted data, JSON versions, native permissions, task states or release authorization. Existing framework-first delivery and native acceptance gates remain intact.

## Follow-up implications, not implementation claims

Use the existing requirement IDs and improvement/task inventory to plan one complete, representative workflow for each primary target. Start with a small real user job rather than the entire Workbench self-project. Include a later component change so that safe evolution and documentation freshness are evaluated as well as first-use speed.

The next relevant product proofs are clear first-use guidance, understandable target/fidelity limits, explicit documentation ownership, useful generated output and safe regeneration with handwritten extensions. Reconcile these against the exact current implementation before opening duplicate tasks. A capability already present should be integrated and qualified, not rewritten to match new terminology.

Runtime branding and any identifier migration are separate implementation work. The Workbench name does not establish marketplace acceptance, trademark clearance, pricing or a publication date.

## Verification boundary

This change is documentation-only. No application code, generated HTML, schema, lockfile, quality threshold or task completion state is changed by this product-vision work. Repository content was inspected through the GitHub connector; a full local checkout was unavailable. No build, unit suite, browser test, native Obsidian session, performance measurement, current CI qualification or user study was executed for this review.

Documentation changes must be reviewed for naming consistency, retained commands and requirement IDs, relative-link targets, and a clear separation of product direction from evidence. Actual publication remains a separately approved operation under the [delivery strategy](DELIVERY-STRATEGY.md).
