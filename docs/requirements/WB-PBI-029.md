---
type: PBI
schema_version: 1
id: "WB-PBI-029"
title: "Create coherent deterministic fixture scenarios"
product: "Workbench"
epic: "WB-E04"
feature: "WB-F16"
outcomes: ["O-DX","O-TIME","O-QUALITY"]
release: "MVP"
milestone: "I2"
lane: "foundation"
priority: "must"
rank: 16
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
depends_on: ["WB-PBI-024","WB-PBI-003"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-QR-01","BQ-02","BQ-04"]
work_packages: ["WM-03","WM-04","WM-11"]
acceptance_refs: ["A08","A11","WVA-15","BQA-04"]
legacy_tasks: ["SH-009","SH-010","CX-004"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
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

# WB-PBI-029 — Create coherent deterministic fixture scenarios

## Need and requirement

As a **Developer**, I need to start every designed interaction with valid repeatable synthetic data.

Workbench SHALL generate and validate named, editable fixture scenarios whose identifiers, relationships, seed, clock and state lifetime match the declared interaction contracts.

## Use case

**Preconditions:** The selected design specifies interaction preconditions and relevant data shapes.

**Trigger:** The actor deliberately requests this use case.

1. Select or define the scenario and its synthetic records.
2. Bind interactions to shared fixture/state dependencies.
3. Validate types, identities, relationships and applicable edge cases.
4. Materialize the approved fixture resources into owned project locations.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Unknown references and invalid edits prevent use of the affected scenario.
- A shared fixture may support many interactions; independent contradictory copies are not generated.

## Acceptance criteria

### WB-PBI-029-AC01

Given the same declared seed, clock and ID sequence, when fixtures are generated twice, then the resulting records and relationships are identical.

### WB-PBI-029-AC02

Given normal, empty and applicable boundary/failure scenarios, when the fixture set is inspected, then each declared interaction has its necessary state/input dependencies.

### WB-PBI-029-AC03

Given invalid types, duplicate IDs or dangling relationships, when fixture validation runs, then invalid scenarios cannot be presented as ready.

### WB-PBI-029-AC04

Given an edited fixture override, when regeneration is planned, then ownership is respected and changes cannot be overwritten silently.

## Fixtures, quality and scope

**Required test data:** Synthetic populated/empty datasets, long strings, nullable/date/numeric limits and invalid relationships. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** No production data, credentials or obligatory external mocking service; fixture lifetime and reset are explicit.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-024](WB-PBI-024.md), [WB-PBI-003](WB-PBI-003.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
