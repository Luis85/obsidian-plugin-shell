---
type: PBI
schema_version: 1
id: "WB-PBI-008"
title: "Initialize a project from an existing JSON design"
product: "Workbench"
epic: "WB-E01"
feature: "WB-F04"
outcomes: ["O-DX","O-TIME"]
release: "MVP"
milestone: "I1"
lane: "foundation"
priority: "must"
rank: 10
status: "new"
revision: 1
created: "2026-09-29"
updated: "2026-09-29"
status_since: "2026-09-29"
owner: null
owner_role: "Product and developer experience"
review_status: "pending"
review_record: null
estimate_points: null
value_score: null
risk: null
depends_on: ["WB-PBI-002","WB-PBI-003"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-02","MVP-03","MVP-04","MVP-11"]
work_packages: ["WM-05"]
acceptance_refs: ["A02","A03","A04","A09","WVA-05","WVA-06"]
legacy_tasks: ["SH-027","SH-028"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "extend"
blocked_reason: null
open_questions: []
verification_profiles: ["contract:shared","filesystem:cli"]
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

# WB-PBI-008 — Initialize a project from an existing JSON design

## Need and requirement

As a **Developer**, I need to turn an existing reviewed design into a project without selecting a starter.

Workbench SHALL inspect, reconcile and accept project JSON through the same setup model and planner used for starter initialization, without requiring an installed starter pack.

## Use case

**Preconditions:** A project export is available and a destination is explicitly selected.

**Trigger:** The actor deliberately requests this use case.

1. Select project JSON instead of a starter.
2. Inspect validity, identity, settings and target compatibility.
3. Resolve explicit configuration differences and review planned files.
4. Apply preparation while retaining the accepted input identity and provenance.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Imported identity is preserved unless deliberately overridden.
- Invalid inputs, stale plans and foreign-file conflicts leave accepted project content unchanged.

## Acceptance criteria

### WB-PBI-008-AC01

Given valid JSON and no starter pack, when setup prepares a project, then preparation succeeds without introducing a hidden starter dependency.

### WB-PBI-008-AC02

Given imported identity and configured values that differ, when reconciliation runs, then explicit resolution is required rather than automatic identity replacement.

### WB-PBI-008-AC03

Given exported component revisions, journeys and fixture references, when intake is accepted and re-exported, then the declared semantics and stable IDs survive.

### WB-PBI-008-AC04

Given invalid JSON, an unsupported version or changed input after review, when apply is attempted, then the accepted project is not replaced and diagnostics identify the reason.

## Fixtures, quality and scope

**Required test data:** Valid full export, identity conflict, future version and changed-input fixtures. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Reuse the shared import and safe-plan contracts; do not infer behavior from prose or run embedded scripts.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-002](WB-PBI-002.md), [WB-PBI-003](WB-PBI-003.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
