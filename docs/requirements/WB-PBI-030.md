---
type: PBI
schema_version: 1
id: "WB-PBI-030"
title: "Experiment with stateful mock interactions"
product: "Workbench"
epic: "WB-E04"
feature: "WB-F16"
outcomes: ["O-DX","O-TIME","O-QUALITY"]
release: "MVP"
milestone: "I2"
lane: "foundation"
priority: "must"
rank: 24
status: "new"
revision: 1
created: "2026-09-29"
updated: "2026-09-29"
status_since: "2026-09-29"
owner: null
owner_role: "Compiler and QA"
review_status: "pending"
review_record: null
estimate_points: null
value_score: null
risk: null
depends_on: ["WB-PBI-024","WB-PBI-029"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-16","MVP-QR-01","BQ-03","BQ-06"]
work_packages: ["WM-11"]
acceptance_refs: ["A10","A11","WVA-12","WVA-13","BQA-03"]
legacy_tasks: ["SH-008","SH-009","SH-017"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "extend"
blocked_reason: null
open_questions: []
verification_profiles: ["contract:shared","browser:angular-webapp","native:obsidian-vue"]
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

# WB-PBI-030 — Experiment with stateful mock interactions

## Need and requirement

As a **Application reviewer**, I need to test application behavior before a production backend exists.

The generated application SHALL execute each designed mock interaction against coherent isolated state and expose the specified visible outcomes, state changes and failure behavior.

## Use case

**Preconditions:** A complete scenario is active and application logic uses declared ports rather than directly importing fixture records.

**Trigger:** The actor deliberately requests this use case.

1. Open a seeded list/detail/form through actual application navigation.
2. Submit or cancel a designed operation.
3. Observe validation, state change, feedback and related projections.
4. Navigate or retry within the same scenario and inspect consistent results.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Validation, denied operations and conflicts do not appear as successful commits.
- Simulated external effects never cause real uploads, messages, payments or provider operations.

## Acceptance criteria

### WB-PBI-030-AC01

Given a designed create/edit/delete workflow, when it succeeds, then subsequent lists, details, counts, filters and pagination reflect the same simulated committed state.

### WB-PBI-030-AC02

Given cancelled or invalid input, when the operation ends, then committed mock state is unchanged and applicable field errors remain visible.

### WB-PBI-030-AC03

Given a service/conflict failure or optimistic action, when failure occurs, then specified rollback/reconciliation is observed without a false success notice.

### WB-PBI-030-AC04

Given a designed external effect or local-only action, when it executes in demo mode, then its defined progress/result behavior is testable while no live external effect occurs.

## Fixtures, quality and scope

**Required test data:** CRUD read-after-write, validation, cancellation, permission, version conflict and simulated external progress. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Mocks implement agreed observable semantics, not invented production business rules; they do not replace real native Workbench persistence.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-024](WB-PBI-024.md), [WB-PBI-029](WB-PBI-029.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
