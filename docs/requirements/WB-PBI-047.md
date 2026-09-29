---
type: PBI
schema_version: 1
id: "WB-PBI-047"
title: "Persist and reopen native authoring work safely"
product: "Workbench"
epic: "WB-E07"
feature: "WB-F25"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I5"
lane: "native"
priority: "must"
rank: 51
status: "new"
revision: 1
created: "2026-09-29"
updated: "2026-09-29"
status_since: "2026-09-29"
owner: null
owner_role: "Native product and QA"
review_status: "pending"
review_record: null
estimate_points: null
value_score: null
risk: null
depends_on: ["WB-PBI-046"]
gate_prerequisites: ["SH-022","SH-034","CX-007"]
contributes_to: ["CP-010"]
requirements: ["MVP-11","MVP-17","MVP-23"]
work_packages: ["WM-17"]
acceptance_refs: ["A12","A19","WVA-17"]
legacy_tasks: ["CP-002","CP-009"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "implement"
blocked_reason: null
open_questions: []
verification_profiles: ["native:workbench"]
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

# WB-PBI-047 — Persist and reopen native authoring work safely

## Need and requirement

As a **Workbench author**, I need to continue editing the same project across leaves and restarts without losing authored content.

Native Workbench SHALL persist canonical design records through shared shell-backed services, retain per-view drafts and reopen committed state with explicit conflict and failure handling.

## Use case

**Preconditions:** Generated native Workbench runs in an approved isolated vault; stored project records may already exist.

**Trigger:** The actor deliberately requests this use case.

1. Open the same project in two leaves and edit a draft.
2. Validate and save through the shared canonical writer.
3. Observe committed changes in other views without overwriting their drafts.
4. Close/reopen and export the durable accepted project.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Stale, corrupt/future or uncertain save outcomes preserve data and block unsafe retries.
- Disposal cancels owned capabilities without detaching unrelated leaves.

## Acceptance criteria

### WB-PBI-047-AC01

Given accepted native edits, when the application closes and reopens, then actual persisted Markdown/project records retain stable IDs, revisions, prose and unrelated properties.

### WB-PBI-047-AC02

Given two leaves with drafts, when one saves, then committed facts refresh projections without silently replacing the other leaf draft.

### WB-PBI-047-AC03

Given conflicting, failed or uncertain writes, when save is attempted, then no false durable success is shown and protected data remains recoverable.

### WB-PBI-047-AC04

Given close/unload and delayed work, when disposal completes, then owned listeners/handles cannot write through disposed capabilities and unrelated host content is untouched.

## Fixtures, quality and scope

**Required test data:** Real native project records, two-leaf stale drafts, external edits, failed/uncertain save and corrupt future data. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Mocks cannot satisfy native authoring persistence; retain existing Markdown/plugin-data ownership and lifecycle guarantees.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-046](WB-PBI-046.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
