---
type: PBI
schema_version: 1
id: "WB-PBI-031"
title: "Switch and reset demonstration scenarios"
product: "Workbench"
epic: "WB-E04"
feature: "WB-F16"
outcomes: ["O-DX","O-TIME","O-QUALITY"]
release: "MVP"
milestone: "I2"
lane: "foundation"
priority: "must"
rank: 28
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
depends_on: ["WB-PBI-029","WB-PBI-030"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-16","MVP-QR-01","BQ-04","BQ-05"]
work_packages: ["WM-11","WM-15"]
acceptance_refs: ["A11","A19","WVA-15","BQA-04","BQA-05"]
legacy_tasks: ["SH-009","SH-010","CX-004"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "extend"
blocked_reason: null
open_questions: []
verification_profiles: ["browser:angular-webapp","native:obsidian-vue"]
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

# WB-PBI-031 — Switch and reset demonstration scenarios

## Need and requirement

As a **Application reviewer**, I need to explore alternative UI states and restart the demonstration without source editing.

The generated application SHALL show the active demo mode/scenario and provide named scenario selection and reset that restore deterministic state while isolating pending work.

## Use case

**Preconditions:** At least two named scenarios and a deterministic seed are available.

**Trigger:** The actor deliberately requests this use case.

1. Inspect the active mode and scenario.
2. Select a normal, empty, delayed or failure scenario.
3. Exercise the application and change mock state.
4. Reset to the declared seed or switch scenarios and continue.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Responses started in a previous scenario cannot mutate the new scenario after reset.
- Optional persisted demo state discloses its lifetime and remains separated from live data.

## Acceptance criteria

### WB-PBI-031-AC01

Given multiple scenarios, when one is selected, then its mode/name is visible and the corresponding input/state fixtures load without editing source.

### WB-PBI-031-AC02

Given edited mock state, when reset is invoked, then the deterministic original records and identifier/clock behavior are restored.

### WB-PBI-031-AC03

Given delayed work from the previous scenario, when reset or switching occurs, then late completion cannot repopulate or overwrite the new state.

### WB-PBI-031-AC04

Given session reload or opt-in demo persistence, when the application restarts, then documented state-lifetime/reset behavior is observed and live records remain isolated.

## Fixtures, quality and scope

**Required test data:** Normal, empty, permission, delay and conflict scenarios with reset during pending mutation. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Reset affects only owned demo state, not source definitions, live data or unrelated local storage.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-029](WB-PBI-029.md), [WB-PBI-030](WB-PBI-030.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
