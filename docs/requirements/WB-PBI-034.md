---
type: PBI
schema_version: 1
id: "WB-PBI-034"
title: "Generate and validate language-neutral service contracts"
product: "Workbench"
epic: "WB-E05"
feature: "WB-F18"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I2"
lane: "foundation"
priority: "must"
rank: 17
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
depends_on: ["WB-PBI-024"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-09","MVP-QR-01","BQ-06","BQ-07"]
work_packages: ["WM-02","WM-11"]
acceptance_refs: ["A08","A10","A17","WVA-01","BQA-06"]
legacy_tasks: ["SH-008","SH-017"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "add"
blocked_reason: null
open_questions: ["Select and pin the supported OpenAPI dialect and client/validator tool versions before technical readiness."]
verification_profiles: ["contract:shared"]
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

# WB-PBI-034 — Generate and validate language-neutral service contracts

## Need and requirement

As a **Backend integrator**, I need to implement the agreed API without depending on accidental JavaScript data conventions.

Workbench SHALL deliver versioned wire contracts, typed client interfaces, examples and response-validation tests for designed HTTP interactions from one reviewed contract authority.

## Use case

**Preconditions:** Selected interactions declare an HTTP boundary; pure UI and native-only operations need none.

**Trigger:** The actor deliberately requests this use case.

1. Inspect operation IDs, methods/paths and typed inputs/results/errors.
2. Review authentication, filtering/pagination and concurrency semantics where applicable.
3. Generate client contracts, examples and serialization vectors.
4. Validate fixtures and actual service responses against the same accepted contract.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- A backend-owned existing contract is adapted explicitly rather than rewritten silently.
- Unknown dialect/tool incompatibility blocks generation until a supported version is selected.

## Acceptance criteria

### WB-PBI-034-AC01

Given HTTP interactions, when contracts are generated, then methods/paths, inputs, validation errors and result/error shapes are explicitly versioned and traceable to interaction IDs.

### WB-PBI-034-AC02

Given IDs, null/absent values, dates/zones, decimals, large integers and enums, when boundary vectors run, then representations follow the declared wire semantics.

### WB-PBI-034-AC03

Given incompatible responses or contract drift, when validation runs, then mocks and actual responses fail the same relevant contract checks.

### WB-PBI-034-AC04

Given navigation/native-only interactions, when the service catalog is built, then no fictitious HTTP endpoint is introduced solely to satisfy fixture accounting.

## Fixtures, quality and scope

**Required test data:** Request Board wire examples, invalid responses and cross-language serialization boundaries. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** OpenAPI dialect and tooling must be reviewed and pinned during technical refinement; no automatic production backend generation.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-024](WB-PBI-024.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. Select and pin the supported OpenAPI dialect and client/validator tool versions before technical readiness.
