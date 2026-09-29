# Workbench — product documentation

**Focus on your idea. Save time. Not quality.**

Workbench is a developer-focused tool to create and manage declarative user interfaces for webapps and Obsidian plugins. Start with the product direction, then use the appropriate scoped requirements and evidence.

## Product direction

| Document | Authority |
| --- | --- |
| [Product vision](PRODUCT-VISION.md) | Canonical Workbench name, users, problem hypothesis, value, scope and success measures. |
| [Product principles](PRODUCT-PRINCIPLES.md) | Decision rules for declarative authoring, documentation, ownership, configuration, starters, quality and developer experience. |
| [Design constraints](../../DESIGN-CONSTRAINTS.md) | Cross-product constraint register with stable DC IDs, scoped owners, inherited/MVP/proposed rule distinctions, verification methods and acceptance mapping. |
| [PR #5 vision review](PR5-VISION-REVIEW.md) | Source-grounded review at the 2026-09-29 baseline; separates inspected capabilities from intended direction. |
| [Product and delivery overview](../../SHELL-FIRST-OVERVIEW.md) | Practical entry points and the relationship between Workbench, its reusable foundation and delivery gates. The filename is retained for compatibility. |

## Mandatory MVP output quality

**[MVP-QR-01 — operational boilerplate quality](MVP-BOILERPLATE-QUALITY.md)** is an owner-directed requirement, not an optional enhancement: every selected designed interaction must work with its required mock data/fixtures, so users can experiment immediately after the documented build/start steps. Coherent stateful simulation replaces missing live services; disabled implementation placeholders cannot pass. Typed ports, service contracts and reference C# and Java integrations allow backend replacement without UI rewrites.

The document contains ten BQ acceptance clauses, ten BQA test protocols, explicit demo/live boundaries and mappings into the existing work packages. Demo completeness, backend integration and production/native acceptance remain separate. This amendment tightens older descriptions of unavailable business actions for interactions in the selected design; it does not relabel earlier evidence or authorize execution/publication.

## Vision-aligned MVP execution

| Document | Purpose |
| --- | --- |
| [MVP improvement plan](MVP-IMPROVEMENT-PLAN.md) | Nineteen work packages covering configuration, external starters, setup/first run, typed Markdown, operational fixture-backed UI, backend integration, safe changes, quality, native Workbench and staged shipment. Version 1.1 integrates MVP-QR-01. |
| [MVP vision acceptance](MVP-VISION-ACCEPTANCE.md) | Twenty scenarios, evidence rules and mapping to every retained A01–A20 case, tightened by the ten additional BQA protocols in the quality requirement. |
| [MVP baseline and requirement crosswalk](MVP-VISION-BASELINE.md) | Dated source observations at `f3778ed`, reconciliation with IP-01–15 and coverage of MVP-01–24; the later MVP-QR-01 amendment adds requirements, not new implementation evidence. |

These documents define required outcomes and planned execution, not executed qualification. They supplement the retained contracts below without changing task states or authorizing publication. The native full-product obligation remains; an earlier framework shipment does not close the complete MVP.

## Typed MVP backlog and progress

The [requirements index](../requirements/README.md) decomposes the MVP into **54 use-case PBIs**, **8 JTBD epics**, **28 features** and **216 initial acceptance criteria**. Each requirement file has `type: PBI` and explicit lifecycle, ownership, dependency, source and evidence metadata.

Use [PBI governance](../requirements/GOVERNANCE.md) for the IREB-aligned tailoring, metadata contract, review, readiness and completion rules; [traceability](../requirements/TRACEABILITY.md) for the retained MVP/WM/BQ/A/WVA/BQA mappings; and [progress](../requirements/PROGRESS.md) for evidence-backed acceptance by epic, feature, outcome and delivery increment. The read-only reporting commands and [validation record](../requirements/VALIDATION.md) are linked from the index.

For a native Obsidian management view, open [MVP.base](../requirements/MVP.base). Its [six-view guide](../requirements/VIEWS.md) explains backlog, milestone, unassigned, blocker, acceptance and shipment views. These display note metadata; evidence-backed progress still comes from the existing Node reporter and acceptance review, not a status formula.

The initial records are `new` and unaccepted until existing implementation and current evidence are reconciled. Zero accepted PBIs in this new baseline does not mean zero implemented product functionality. Existing task frontmatter remains the execution-status authority; PBI acceptance and a local progress report do not grant publication approval.

## Requirements and delivery

| Document | Scope |
| --- | --- |
| [Framework requirements](PRD.md) | Retained reusable Obsidian shell requirements and acceptance IDs; not the complete cross-target Workbench product vision. |
| [Authoring and native-plugin requirements](COMPANION-PLUGIN-PRD.md) | Workbench authoring scope and native conversion, including retained companion requirements. The filename is retained. |
| [JSON-to-clickdummy MVP](../prds/MVP-JSON-TO-CLICKDUMMY.md) | Bounded end-to-end MVP obligations, strengthened by MVP-QR-01 for operational fixture-backed output; framework shipment alone does not complete them. |
| [Delivery strategy](DELIVERY-STRATEGY.md) | Foundation readiness and approved shipment before the agreed native conversion and native acceptance; publication remains separately authorized. |
| [Integrated improvement plan](PR5-IMPROVEMENT-PLAN.md) | September 27 work-package structure retained; the vision-aligned plan and quality amendment reconcile later direction without rewriting historical execution results. |
| [Task index](../tasks/README.md) | Detailed execution and acceptance tracking. Product prose does not mark tasks complete. |

## Implementation and evidence

Use the [root README](../../README.md) for the existing framework checkout, the [CLI guide](../development/FRAMEWORK-CLI.md) for supported commands, the [compiler guide](../development/compiler/README.md) for compilation boundaries, and the [authoring guide](../concepts/companion/README.md) for the current build entry.

The [2026-09-27 integrated review](PR5-PRODUCT-REVIEW.md) and its [evidence record](../testing/PR5-REVIEW-EVIDENCE.md) remain dated snapshots. Their counts, failures and successes must not be relabeled as the current branch status. New qualification belongs to its actual candidate and environment.

## Reading rule

The vision governs product identity and intended value. Scoped requirements retain their detailed contracts and IDs; the later explicit MVP-QR-01 requirement supersedes older allowances for unavailable interactions only within its stated operational-boilerplate scope. Delivery strategy governs sequencing. Execution records establish only the results they actually measured. None of these documents alone grants publication approval.

Use the [design constraints](../../DESIGN-CONSTRAINTS.md) when designing or reviewing a change, together with the quality amendment's named DC mappings. They consolidate these authorities without replacing their detailed requirements; proposed additions require review, while the owner-directed MVP-QR-01 is mandatory. Missing implementation evidence remains missing.

The public product name is **Workbench**. Existing repository, executable, package, manifest, schema and storage identifiers are not renamed by this documentation update. Historical names remain where they identify retained artifacts or technical contracts.
