---
type: PBI
schema_version: 1
id: "WB-PBI-035"
title: "Switch safely from mock to service adapters"
product: "Workbench"
epic: "WB-E05"
feature: "WB-F18"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I2"
lane: "foundation"
priority: "must"
rank: 29
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
depends_on: ["WB-PBI-030","WB-PBI-034"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-QR-01","BQ-05","BQ-06"]
work_packages: ["WM-11","WM-14"]
acceptance_refs: ["A11","A17","WVA-15","WVA-16","BQA-05","BQA-06"]
legacy_tasks: ["SH-008","SH-017","SH-021"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "add"
blocked_reason: null
open_questions: []
verification_profiles: ["contract:shared","browser:angular-webapp"]
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

# WB-PBI-035 — Switch safely from mock to service adapters

## Need and requirement

As a **Backend integrator**, I need to connect real services without rewriting pages or disguising service failures as successful mocks.

The generated application SHALL select mock, HTTP or applicable native adapters through explicit configuration/composition while keeping UI contracts unchanged and isolating data across modes.

## Use case

**Preconditions:** The selected adapter implements the accepted application port; real connection settings are explicitly supplied.

**Trigger:** The actor deliberately requests this use case.

1. Inspect the active mode and adapter configuration.
2. Review the switch and required service connection.
3. Switch at the supported composition boundary while invalidating old pending work.
4. Exercise the same application interaction and observe its actual service result.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Unavailable services or credentials cause visible real failures without mock fallback.
- Synthetic records and pending mock responses cannot be uploaded or mixed into live state.

## Acceptance criteria

### WB-PBI-035-AC01

Given a conforming backend, when runtime configuration selects its adapter, then page/component source remains unchanged and the same observable port contract is used.

### WB-PBI-035-AC02

Given missing credentials or a failed real service, when an operation runs, then no mock success is substituted and failure is visible.

### WB-PBI-035-AC03

Given active mock data and delayed responses, when the mode changes, then demo state and old completions cannot affect real records or send fixture uploads.

### WB-PBI-035-AC04

Given a production build, when its artifact is inspected, then demo datasets/scenario controls are excluded through the reviewed build boundary rather than merely hidden.

## Fixtures, quality and scope

**Required test data:** Mock-to-service switch, absent credentials, failed service, pending mock mutation and production artifact. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** No credentials in portable settings/bundles; client-side role simulation is not server authorization.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-030](WB-PBI-030.md), [WB-PBI-034](WB-PBI-034.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
