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

## Vision-aligned MVP execution

| Document | Purpose |
| --- | --- |
| [MVP improvement plan](MVP-IMPROVEMENT-PLAN.md) | Nineteen work packages covering configuration, external starters, setup/first run, typed Markdown, actual UI generation, safe changes, quality, native Workbench and staged shipment. |
| [MVP vision acceptance](MVP-VISION-ACCEPTANCE.md) | Twenty additional scenarios, evidence rules and mapping to every retained A01–A20 acceptance case. |
| [MVP baseline and requirement crosswalk](MVP-VISION-BASELINE.md) | Source observations at `f3778ed`, reconciliation with IP-01–15 and coverage of MVP-01–24; distinguishes new work from existing implementation requiring qualification. |

These are planning documents, not executed qualification. They supplement the retained contracts below without changing task states or authorizing publication. The native full-product obligation remains; an earlier framework shipment does not close the complete MVP.

## Requirements and delivery

| Document | Scope |
| --- | --- |
| [Framework requirements](PRD.md) | Retained reusable Obsidian shell requirements and acceptance IDs; not the complete cross-target Workbench product vision. |
| [Authoring and native-plugin requirements](COMPANION-PLUGIN-PRD.md) | Workbench authoring scope and native conversion, including retained companion requirements. The filename is retained. |
| [JSON-to-clickdummy MVP](../prds/MVP-JSON-TO-CLICKDUMMY.md) | Bounded end-to-end MVP obligations; framework shipment alone does not complete them. |
| [Delivery strategy](DELIVERY-STRATEGY.md) | Foundation readiness and approved shipment before the agreed native conversion and native acceptance; publication remains separately authorized. |
| [Integrated improvement plan](PR5-IMPROVEMENT-PLAN.md) | September 27 work-package structure retained; the vision-aligned plan above reconciles selected later source and adds vision-derived work. |
| [Task index](../tasks/README.md) | Detailed execution and acceptance tracking. Product prose does not mark tasks complete. |

## Implementation and evidence

Use the [root README](../../README.md) for the existing framework checkout, the [CLI guide](../development/FRAMEWORK-CLI.md) for supported commands, the [compiler guide](../development/compiler/README.md) for compilation boundaries, and the [authoring guide](../concepts/companion/README.md) for the current build entry.

The [2026-09-27 integrated review](PR5-PRODUCT-REVIEW.md) and its [evidence record](../testing/PR5-REVIEW-EVIDENCE.md) remain dated snapshots. Their counts, failures and successes must not be relabeled as the current branch status. New qualification belongs to its actual candidate and environment.

## Reading rule

The vision governs product identity and intended value. Scoped requirements retain their detailed contracts and IDs. Delivery strategy governs sequencing. Execution records establish only the results they actually measured. None of these documents alone grants publication approval.

Use the [design constraints](../../DESIGN-CONSTRAINTS.md) when designing or reviewing a change. They consolidate these authorities without replacing their detailed requirements; proposed additions require review and missing implementation evidence remains missing.

The public product name is **Workbench**. Existing repository, executable, package, manifest, schema and storage identifiers are not renamed by this documentation update. Historical names remain where they identify retained artifacts or technical contracts.
