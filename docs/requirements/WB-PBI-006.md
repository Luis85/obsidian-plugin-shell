---
type: PBI
schema_version: 1
id: "WB-PBI-006"
title: "Author an external starter definition"
product: "Workbench"
epic: "WB-E01"
feature: "WB-F03"
outcomes: ["O-DX","O-TIME"]
release: "MVP"
milestone: "I1"
lane: "foundation"
priority: "must"
rank: 9
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
requirements: ["MVP-02","MVP-QR-01","BQ-01","BQ-02","BQ-04"]
work_packages: ["WM-04"]
acceptance_refs: ["A02","A08","WVA-03","BQA-02"]
legacy_tasks: ["SH-011","SH-026","CX-008"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "add"
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

# WB-PBI-006 — Author an external starter definition

## Need and requirement

As a **Starter author**, I need to add and modify ordinary starter content without changing Workbench code.

Workbench SHALL read listing metadata, editable parameters, project definitions, fixture dependencies and a bounded sequence of supported operations from configs/starters/<starterName>.json.

## Use case

**Preconditions:** The author has access to the versioned starter contract and supported operation catalog.

**Trigger:** The actor deliberately requests this use case.

1. Create or edit one external definition.
2. Declare compatible targets, parameters, content and fixture resources.
3. Declare the dependency-ordered supported operation sequence.
4. Validate and preview listing, parameter editing and execution plans from the same definition.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Unknown operations, dependency cycles and invalid resource references are rejected.
- A local edit changes definition identity; it must not retain a misleading official integrity claim.

## Acceptance criteria

### WB-PBI-006-AC01

Given an added ordinary starter definition, when the catalog is refreshed, then it can be listed and configured without an engine source change or duplicate registration.

### WB-PBI-006-AC02

Given changed parameters or content, when a new plan is inspected, then listing, editing and generation consistently reflect the same definition revision.

### WB-PBI-006-AC03

Given unknown operations, dependency cycles or unbound fixture resources, when validation runs, then the definition cannot produce a complete executable plan.

### WB-PBI-006-AC04

Given a starter with install or launch operations, when it is imported, then no process executes before the separate explicit execution approval.

## Fixtures, quality and scope

**Required test data:** One minimal and one interaction-rich starter; unknown-operation and cyclic-process definitions. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** New execution primitives still require reviewed implementation; JSON is data, not arbitrary executable code.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-002](WB-PBI-002.md), [WB-PBI-003](WB-PBI-003.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
