---
type: PBI
schema_version: 1
id: "WB-PBI-020"
title: "Define and reuse a typed component"
product: "Workbench"
epic: "WB-E03"
feature: "WB-F10"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I2"
lane: "concept"
priority: "must"
rank: 13
status: "new"
revision: 1
created: "2026-09-29"
updated: "2026-09-29"
status_since: "2026-09-29"
owner: null
owner_role: "UX and authoring"
review_status: "pending"
review_record: null
estimate_points: null
value_score: null
risk: null
depends_on: ["WB-PBI-018","WB-PBI-024"]
gate_prerequisites: []
contributes_to: ["CP-010"]
requirements: ["MVP-15","MVP-11","MVP-QR-01","BQ-02"]
work_packages: ["WM-09"]
acceptance_refs: ["A09","A10","WVA-10","WVA-11"]
legacy_tasks: ["CX-003","SH-016","CP-003"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "extend"
blocked_reason: null
open_questions: []
verification_profiles: ["browser:authoring","contract:shared"]
verification_plan: null
evidence_refs: []
verification_candidate: null
accepted_by: null
accepted_on: null
acceptance_record: null
started_on: null
done_on: null
shipped_on: null
release_ref: null
---

# WB-PBI-020 — Define and reuse a typed component

## Need and requirement

As a **UI author**, I need to reuse one component definition across pages without losing local overrides.

Workbench SHALL support a reusable component with typed properties, slots, events, variants and scenario dependencies, and let pages reference a pinned revision of it.

## Use case

**Preconditions:** The component library and supported type/slot/event contracts are available.

**Trigger:** The actor deliberately requests this use case.

1. Create the reusable definition and its documented contract.
2. Define supported variants, behavior and fixture dependencies.
3. Place pinned instances on two pages and supply valid bindings.
4. Preview each instance and save the shared definition once.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Composition cycles and incompatible props/slots/events are rejected.
- Editing an instance must not rewrite the definition or other instances.

## Acceptance criteria

### WB-PBI-020-AC01

Given one component on two pages, when generated references are inspected, then a single shared definition is used and each instance retains its revision pin.

### WB-PBI-020-AC02

Given valid per-instance overrides, when one instance changes, then the shared definition and the other instance remain unchanged.

### WB-PBI-020-AC03

Given incompatible bindings or a composition cycle, when the contract is saved/compiled, then a diagnostic identifies the invalid dependency and blocks executable output.

### WB-PBI-020-AC04

Given component interactions, when a page scenario runs, then its declared fixture dependencies compose into coherent application state rather than isolated contradictory datasets.

## Fixtures, quality and scope

**Required test data:** Shared status/form component, two instances, variant fixtures and cyclic composition. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** External runtime capabilities require trusted implementations; typed signatures alone do not satisfy functional behavior.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-018](WB-PBI-018.md), [WB-PBI-024](WB-PBI-024.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
