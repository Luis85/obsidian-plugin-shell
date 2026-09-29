---
type: PBI
schema_version: 1
id: "WB-PBI-012"
title: "Resume interrupted project setup"
product: "Workbench"
epic: "WB-E01"
feature: "WB-F05"
outcomes: ["O-DX","O-TIME"]
release: "MVP"
milestone: "I2"
lane: "foundation"
priority: "must"
rank: 40
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
depends_on: ["WB-PBI-011"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-04","MVP-18"]
work_packages: ["WM-06"]
acceptance_refs: ["A04","A13","WVA-07"]
legacy_tasks: ["SH-012","SH-029"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "extend"
blocked_reason: null
open_questions: []
verification_profiles: ["cli:shared","filesystem:cli"]
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

# WB-PBI-012 — Resume interrupted project setup

## Need and requirement

As a **Developer**, I need to recover setup without repeating uncertain operations or overwriting changed work.

Workbench SHALL inspect retained stage progress and require fresh approval bound to current inputs before resuming one explicitly selected interrupted or failed stage.

## Use case

**Preconditions:** A setup progress record exists; its effects and process ownership can be inspected.

**Trigger:** The actor deliberately requests this use case.

1. Inspect completed, failed and uncertain stages.
2. Compare current settings, starter/model, source and lockfile identities.
3. Investigate uncertain effects and approve the next stage.
4. Run that stage once and retain its actual outcome and history.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- A live or foreign-host owner prevents blind takeover.
- Changed inputs invalidate the previous approval; uncertain execution is not automatically retried.

## Acceptance criteria

### WB-PBI-012-AC01

Given interrupted setup, when status is inspected, then completed, failed and uncertain stages remain distinguishable and inspection writes no project files.

### WB-PBI-012-AC02

Given changed settings, model or lockfile after review, when resume is requested, then the stale approval is rejected.

### WB-PBI-012-AC03

Given a running or unverified foreign process owner, when recovery is attempted, then the tool refuses an unsafe concurrent stage without killing the process.

### WB-PBI-012-AC04

Given explicit current-state approval, when one stage resumes, then only that stage executes and failures retain precise effects/history without claiming product acceptance.

## Fixtures, quality and scope

**Required test data:** Interrupted owner, stale hashes, failed install and failed progress persistence. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Reuse existing stage history and safe-operation services; a progress record is not portable execution authority.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-011](WB-PBI-011.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
