# Workbench MVP — inspected baseline and requirement crosswalk

> **Date:** 2026-09-29 · **Repository:** `Luis85/obsidian-plugin-shell`
> **Inspected PR:** #5 · **Branch:** `docs/companion-plugin-prd`
> **Baseline:** `f3778ed120e845a781c9cc08afc9b16a8b1a3e8c`
> **Purpose:** Evidence for the [vision-aligned improvement plan](MVP-IMPROVEMENT-PLAN.md), not runtime qualification.

## 1. Review method and limits

Read the canonical [vision](PRODUCT-VISION.md), [principles](PRODUCT-PRINCIPLES.md), [vision review](PR5-VISION-REVIEW.md), retained [MVP PRD](../prds/MVP-JSON-TO-CLICKDUMMY.md), original [acceptance crosswalk](../prds/MVP-IMPLEMENTATION-PLAN.md#5-acceptance-and-test-crosswalk), existing [improvement plan](PR5-IMPROVEMENT-PLAN.md), [delivery strategy](DELIVERY-STRATEGY.md) and [task index](../tasks/README.md). Selected executable seams were read at the pinned head through GitHub. This is a risk-based product/contract review, not a complete code audit or user study.

The GitHub comparison from `15f74eaec78b5555bed94e4310472db841e371f7` to this baseline contained eight Markdown file changes and no runtime changes. The newer vision therefore changes product direction and explanation, not implementation maturity. The PR description still summarizes September 27 evidence; its older counts and CI failure are not a current-head result.

A direct local Git checkout attempt failed because the environment could not resolve `github.com`; connector reads remained available. No dependencies were installed, builds/tests/browser/native sessions run, current CI qualification established or release attempted during this planning task. Source presence below means **inspected implementation**, not a new passing execution result. An absent command in the inspected catalog is a bounded observation, not proof that no implementation exists elsewhere or on another branch.

## 2. Source observations and planning consequences

Relative source links identify maintained paths. The baseline SHA above fixes the content reviewed; later revisions may legitimately change it.

| Evidence | Observation at the pinned head | Planning consequence |
| --- | --- | --- |
| [Framework command catalog](../../scripts/framework/catalog.ts) | Declares `project schema`, `project validate`, `generate` with `scope`, `setup status`, `setup resume`, config operations, concept intake and optional tools. | Do not repeat older claims that discovery/scopes/resume are wholly missing. Integrate and qualify them. Typed UI Markdown import/export is not exposed here. |
| [Framework operation dispatcher](../../scripts/framework/operations.ts) | Routes schema validation, setup progress and current compiler/planner operations; config reads identify `shell.config.json`; install checks lockfile readiness. | Reuse one public operation seam. New docs/settings/first-run behavior must not create another generator, writer or implicit install path. |
| [Project contract operation](../../scripts/framework/project-contract.ts) | Publishes project-v6 schema; validates/migrates bounded input; reports generation readiness as not inferred. | WM-02 extends mapping/ownership and qualifies parity; publishing schema discovery is not a new missing feature. |
| [Configuration model](../../scripts/framework/configuration.ts) | `configFile` is `shell.config.json`; `designFile` is `design/project.json`. Configuration includes identity and source/test/test-vault/host-config paths, with strict validation. | WM-03 needs a reviewed settings migration and explicit field authority, not an extra independently editable copy. Expand configurable paths through all consumers. |
| [Starter creation, inspected opening/source-selection sections](../../scripts/framework/starter-project.ts) | Loads the verified starter catalog from the framework/template; lists catalog-derived metadata; `new` guards framework/vault placement and requires an empty destination. | WM-04 changes distribution/discovery rather than recreating starter creation. WM-05 introduces the explicit existing-project-vault path without weakening `new` safeguards. |
| [Setup progress](../../scripts/framework/setup-progress.ts) | Implements generate/install/verify/preview stages, history, explicit resume hashes, interrupted-owner checks and no automatic retry. | WM-06 composes/extends these stages for target-aware first-run choices and explicit build/showcase outcomes. A generic runner rewrite is unnecessary. |
| [Generation operation](../../scripts/framework/generation.ts) | Passes scope to the compiler plan; accepts plugin/clickdummy output kinds; protects canonical import/config/kit consistency. | WM-11 joins target entry points; WM-12 retains import/ownership protections and proves cross-target second changes. |
| [Compiler plan facade](../../bin/compiler/adapters/project-plan.ts) | Parses a selection, compiles, computes generation selection and delegates to the workspace artifact planner. | Scoped generation has real implementation beyond a help option; remaining acceptance must be demonstrated rather than presumed. |
| [Workspace operation planning](../../scripts/framework/planning.ts) | Reconstructs reviewed plans, checks stale inputs/conflicts, delegates guarded writes and protects stored-plan authority. | Reuse these guards for settings, starters and docs; preserve exact recovery semantics instead of claiming global transactions. |
| [Compiler API](../../bin/compiler/index.ts) | Dispatches project-preset output separately; rejects non-default preset source/test roots; emits an explicit visual/body/business-adapter diagnostic; build/tests begin not-run. | WM-03/11 must close advertised path and UI-fidelity gaps. Navigable scaffold output is not finished declarative UI or business acceptance. |
| [Authoring entry guide](../concepts/companion/README.md) and [vision review](PR5-VISION-REVIEW.md) | Current authoring is identified as a browser concept; legacy compatibility artifacts are distinct from current builds. | WM-17 remains a substantive full native acceptance obligation. Do not mistake current concept behavior for an installed Workbench product. |
| [Delivery strategy](DELIVERY-STRATEGY.md) and [task index](../tasks/README.md) | Keep framework shipment before native conversion; task frontmatter and candidate evidence govern status. | Retain SH-022/034, CX-007, CP-010 and separate publication approvals. This plan changes no task state or gate completion. |

## 3. Reconciliation with prior improvement packages

IP identifiers refer to the September 27 plan. “Extend/qualify” is a work classification, not a claim that its existing acceptance has passed.

| Existing package | Current plan relationship |
| --- | --- |
| IP-01 status/documentation | WM-01/13 refresh current capability and handover truth; the new vision docs remain canonical. |
| IP-02 extracted-kit onboarding | WM-03–06/16 extend existing setup and add the requested settings, starter-pack, PRD and first-run journey. |
| IP-03 schema/compatibility | WM-02 qualifies the now-inspected public schema operations and adds field ownership/document mappings; no second schema-discovery project. |
| IP-04 scoped generation | WM-12 qualifies existing selection/planning and the second-change workflow; WM-07 adds typed-doc intake without replacing concept intake. |
| IP-05 generated fidelity | WM-11/15 explicitly cover actual primary-target UI and honest preview behavior. |
| IP-06 authoring/onboarding | WM-09/13/18 connect focused authoring to documentation and observed developer tasks. |
| IP-07 editor completeness | WM-09/10 cover editing, navigation and revision/dependency impact. |
| IP-08 accessibility/localization | WM-15 preserves rendered/manual/native evidence distinctions and supported-locale checks. |
| IP-09 native starters | WM-14–16 retain real-host regression requirements for advertised native behavior. |
| IP-10 native companion | WM-17 retains complete generated native Workbench and CP-010; no scaffold substitution. |
| IP-11 CI/qualification | WM-01/14/16 recheck actual blockers; do not assume the old Python-inventory failure persists. |
| IP-12 trust boundaries | WM-04/07/14 cover new starter/docs inputs and preserve process/native safeguards. |
| IP-13 performance | WM-15 separates model, generated-browser and actual native measurements. |
| IP-14 optional tools | Remains a separate lane; no optional memory/agent/adjacent editor work is added to the default MVP path. |
| IP-15 publication | WM-16/19 split technical archive qualification, framework shipment and later native publication. |

## 4. Retained MVP requirement coverage

No requirement below is withdrawn or marked complete. WVA scenarios extend the original A cases; see the [acceptance companion](MVP-VISION-ACCEPTANCE.md) for that separate crosswalk.

| Retained requirement | Responsible packages | Closure focus |
| --- | --- | --- |
| MVP-01 downloadable kit | WM-04/05/16/19 | Separate engine/starters, exact archive, all documented platforms and explicit publication. |
| MVP-02 starter-or-JSON setup | WM-04/05/16 | One guided entry; external blank starter; JSON path independent of the pack. |
| MVP-03 configuration/GitHub | WM-03/05/16 | Reviewed identity/paths, existing remotes, no implicit external mutation. |
| MVP-04 install/recovery | WM-05/06/14/16 | Independent approvals/outcomes, failure/cancel and state-bound resume. |
| MVP-05 integrated editor | WM-09/15/17 | Actual editor, correct host/lifecycle and usable core commands. |
| MVP-06 hierarchy/routes/arrangement | WM-02/10/15/17 | Stable semantics, explicit geometry and safe structural edits. |
| MVP-07 journeys/navigation | WM-10/11/17 | Branches, declared links, modal return and unresolved references. |
| MVP-08 adjacent editors | WM-09/10/17 | Stable references and contextual navigation without copied records. |
| MVP-09 shared contracts | WM-02/07/11/14 | Schema/validator parity, typed-doc mapping and safe semantics. |
| MVP-10 migration | WM-02/03/07/14 | Supported legacy preservation and honest future/invalid-input handling. |
| MVP-11 round trips | WM-02/07/08/12/17 | IDs/content/notes/revisions preserved; local state and secrets excluded. |
| MVP-12 self-project | WM-01/02/10/17 | Reconciled complete definition, real authoring round trip and provenance. |
| MVP-13 feature generation | WM-11/12 | Real source with dependency closure, not only maker stubs. |
| MVP-14 page generation | WM-09/11/12 | Authored layout, routing/bindings/states and correct native kinds. |
| MVP-15 component generation | WM-09–12 | Reusable contracts, revisions, slots/events and tests. |
| MVP-16 clickdummy | WM-11/15/16 | Editable source, independent build and actual offline supported behavior. |
| MVP-17 whole native companion | WM-17 | Entire required generated Workbench, real editors and native save/reopen. |
| MVP-18 regeneration | WM-08/10/12/14/16 | No-op replay, edited-file protection, stale plans and explicit retirement. |
| MVP-19 concept intake | WM-02/12/14/16 | Retain existing data-only project/feature/improvement intake and its original tests. |
| MVP-20 auditable integration | WM-07/12/14/16 | Original concept provenance/remapping/replay plus separate typed-doc contract. |
| MVP-21 release preparation | WM-16/19 | Candidate-specific local readiness/rehearsal without publishing. |
| MVP-22 authorized publication | WM-19 | Exact authorized assets, recovery and distinct distribution profiles. |
| MVP-23 evidence/quality | WM-01/11–17/19 | Actual candidate-bound evidence and preserved inherited gates. |
| MVP-24 consistent docs/CLI | WM-01/05/06/08/13/16/19 | Usable entry/help/handoff and coherent human/machine contracts. |

### Explicit vision-derived additions

These obligations are added to the execution scope rather than mislabeled as already covered by a generic old requirement. Map them into task criteria and gate dependencies during implementation.

| Addition | Owner package | Required evidence |
| --- | --- | --- |
| User-configurable paths/preferences in `configs/user-settings.json` | WM-03 | WVA-02/13, including legacy conflicts and non-default-path execution. |
| Standalone JSON starters under `configs/starters` and a separate starter ZIP | WM-04 | WVA-03/04, including no embedded fallback and data-only extension. |
| Existing Angular project-vault with selectable/scanned PRDs and independent prototype/first-run choices | WM-05/06 | WVA-05–07, preservation and explicit target-aware process execution. |
| Typed Markdown pages/components/interactions/journeys as input | WM-07 | WVA-08, stable identity, mapping and conflict/round-trip behavior. |
| Generated documentation structure and freshness throughout changes | WM-08 | WVA-09, meaningful content, provenance and handwritten preservation. |
| Primary webapp proof alongside the plugin and full Workbench fixtures | WM-11/16 | WVA-12/13/15/16, not just preset presence or navigability. |
| Demonstrable first-change and second-change value | WM-18 | WVA-20, equivalent scope, actual observations and disclosed limits. |

## 5. Documentation-change boundary

This planning update creates the improvement plan, acceptance scenarios and this baseline/crosswalk, and adds navigation in the product index. It does not change executable code, dependencies, generated HTML, schema versions, task frontmatter, release profiles, thresholds or technical identifiers. Runtime validation described in these documents is work to perform, not evidence obtained by writing them.

Before implementation, re-read the current branch and relevant task frontmatter, incorporate concurrent work, confirm accountable people and decompose only the remaining gap. Use the exact execution receipt and required modes when closing a task or readiness gate; never copy historical CI states into a new candidate's evidence.
