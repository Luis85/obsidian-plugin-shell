---
type: PBI
schema_version: 1
id: "WB-PBI-039"
title: "Extend an adapter and preserve it during regeneration"
product: "Workbench"
epic: "WB-E05"
feature: "WB-F20"
outcomes: ["O-DX","O-DOCS","O-QUALITY"]
release: "MVP"
milestone: "I3"
lane: "foundation"
priority: "must"
rank: 42
status: "new"
revision: 1
created: "2026-09-29"
updated: "2026-09-29"
status_since: "2026-09-29"
owner: null
owner_role: "Integration and QA"
review_status: "pending"
review_record: null
estimate_points: null
value_score: null
risk: null
depends_on: ["WB-PBI-028","WB-PBI-034","WB-PBI-035"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-18","MVP-QR-01","BQ-06","BQ-07","BQ-10"]
work_packages: ["WM-12","WM-13"]
acceptance_refs: ["A10","A13","A17","WVA-14","WVA-16","BQA-06","BQA-10"]
legacy_tasks: ["SH-018","SH-030"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "extend"
blocked_reason: null
open_questions: []
verification_profiles: ["contract:shared","filesystem:cli","integration:custom-adapter"]
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

# WB-PBI-039 — Extend an adapter and preserve it during regeneration

## Need and requirement

As a **Developer**, I need to adapt an existing backend contract without coupling generated pages to it.

Workbench SHALL provide developer-owned adapter/mapper extension boundaries and preserve their source/tests during reviewed model, contract and fixture regeneration.

## Use case

**Preconditions:** The existing backend differs from the representative wire contract and a generated port boundary exists.

**Trigger:** The actor deliberately requests this use case.

1. Implement the documented mapper or service adapter outside generated UI ownership.
2. Run its actual success/error and serialization tests.
3. Change a related component or contract in the accepted design.
4. Regenerate affected fixtures/client/tests/docs while retaining the custom implementation.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Incompatible generated contracts require explicit resolution, not silent rewriting of the adapter.
- A mocked happy-path test cannot count as the implemented service behavior.

## Acceptance criteria

### WB-PBI-039-AC01

Given a differing API, when a custom mapper is added, then integration work is confined to the documented adapter boundary and page/component source remains untouched.

### WB-PBI-039-AC02

Given a contract change, when impact is planned, then affected generated clients, fixtures, tests and documentation are included or drift blocks the plan.

### WB-PBI-039-AC03

Given handwritten adapter/test bytes, when regeneration applies, then those bytes survive or an explicit ownership conflict prevents replacement.

### WB-PBI-039-AC04

Given real success, validation and service-failure responses, when adapter tests run, then the declared application port semantics are verified without false mock completion.

## Fixtures, quality and scope

**Required test data:** Custom backend mapper, typed wire vectors, developer-owned test and breaking contract revision. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** No unrestricted automatic code-to-design synchronization; genuine backend-specific mapping remains explicit developer work.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-028](WB-PBI-028.md), [WB-PBI-034](WB-PBI-034.md), [WB-PBI-035](WB-PBI-035.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
