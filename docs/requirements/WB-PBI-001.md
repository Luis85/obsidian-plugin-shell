---
type: PBI
schema_version: 1
id: "WB-PBI-001"
title: "Inspect candidate capabilities and readiness"
product: "Workbench"
epic: "WB-E01"
feature: "WB-F01"
outcomes: ["O-DX","O-TIME"]
release: "MVP"
milestone: "I0"
lane: "foundation"
priority: "must"
rank: 1
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
depends_on: []
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-23","MVP-24"]
work_packages: ["WM-01","WM-13"]
acceptance_refs: ["A17","A18","WVA-01"]
legacy_tasks: ["SH-001","SH-023","SH-025"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "qualify"
blocked_reason: null
open_questions: []
verification_profiles: ["cli:shared","contract:shared"]
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

# WB-PBI-001 — Inspect candidate capabilities and readiness

## Need and requirement

As a **Developer**, I need to choose a supported next operation without confusing generated output with accepted behavior.

Workbench SHALL report the selected candidate, target capabilities, unmet obligations and the next supported operation without changing project files.

## Use case

**Preconditions:** A source checkout or extracted kit is available; no prior project configuration is required.

**Trigger:** The actor deliberately requests this use case.

1. Select the candidate and target profile.
2. Inspect available operations and their input requirements.
3. Read the separate generated, built, tested and accepted observations.
4. Follow the suggested operation or exit without changes.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Missing tooling affects only operations requiring it; inspection still reports the reason.
- Stale or absent evidence remains unknown; a prior green CI run is not reused.

## Acceptance criteria

### WB-PBI-001-AC01

Given an unconfigured kit, when capabilities are inspected, then the selected artifact identity, prerequisites and supported operations are returned with zero project writes.

### WB-PBI-001-AC02

Given generated source without execution evidence, when readiness is inspected, then build, behavior and native acceptance are not reported as passed.

### WB-PBI-001-AC03

Given an unsupported target operation, when it is selected, then a stable diagnostic identifies the unavailable capability and a supported next step.

### WB-PBI-001-AC04

Given equivalent terminal and structured requests, when both are inspected, then capability IDs and readiness semantics agree without prompting in noninteractive mode.

## Fixtures, quality and scope

**Required test data:** Fresh kit, unsupported target and mismatched historical evidence. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Reconcile existing CLI/status code first; do not introduce a new status database or repair historical CI findings without current evidence.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

No PBI acceptance prerequisite; inspect existing implementation before planning replacement work.

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
