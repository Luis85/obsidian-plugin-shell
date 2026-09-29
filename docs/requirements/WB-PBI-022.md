---
type: PBI
schema_version: 1
id: "WB-PBI-022"
title: "Organize surfaces without changing routes implicitly"
product: "Workbench"
epic: "WB-E03"
feature: "WB-F12"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I2"
lane: "concept"
priority: "must"
rank: 14
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
depends_on: ["WB-PBI-018"]
gate_prerequisites: []
contributes_to: ["CP-010"]
requirements: ["MVP-05","MVP-06"]
work_packages: ["WM-10"]
acceptance_refs: ["A05","A06","WVA-11"]
legacy_tasks: ["CX-003","CP-003"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md"]
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

# WB-PBI-022 — Organize surfaces without changing routes implicitly

## Need and requirement

As a **UI author**, I need to organize application structure while retaining deliberate navigation semantics.

Workbench SHALL maintain surface hierarchy, route values and diagram positions independently during creation, movement, arrangement and deletion.

## Use case

**Preconditions:** The sitemap contains eligible surfaces with stable IDs and separately declared routes.

**Trigger:** The actor deliberately requests this use case.

1. Create or find a surface through the outline.
2. Move it explicitly within the hierarchy or reposition its diagram node.
3. Inspect route and dependency changes separately.
4. Review deletion/arrangement impact and save or undo the operation.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Cycles, route collisions and dangling executable references block unsafe changes.
- Arrange is explicit and undoable; it does not overwrite saved positions invisibly.

## Acceptance criteria

### WB-PBI-022-AC01

Given a surface with a route, when it is renamed or moved in the hierarchy, then its route value remains unchanged unless separately edited.

### WB-PBI-022-AC02

Given a diagram drag, when geometry is saved, then parentage, reading order and navigation semantics do not change.

### WB-PBI-022-AC03

Given a delete or structural connection, when it affects children/routes/journeys, then the impacts and invalid references are disclosed before acceptance.

### WB-PBI-022-AC04

Given an identical arrangement fixture, when explicit arrange runs twice, then the result is deterministic and undo restores the previous saved positions.

## Fixtures, quality and scope

**Required test data:** Deep/wide sitemap, missing/saved coordinates, route collision and parent cycle. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** A diagram connection or hierarchy child is not automatically an executable navigation action.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-018](WB-PBI-018.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
