---
type: PBI
schema_version: 1
id: "WB-PBI-032"
title: "Present the generated application offline"
product: "Workbench"
epic: "WB-E04"
feature: "WB-F17"
outcomes: ["O-DX","O-TIME","O-QUALITY"]
release: "MVP"
milestone: "I2"
lane: "foundation"
priority: "must"
rank: 33
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
depends_on: ["WB-PBI-026","WB-PBI-031"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-16","MVP-QR-01","BQ-01","BQ-05","BQ-09"]
work_packages: ["WM-11","WM-15"]
acceptance_refs: ["A11","A17","WVA-15","BQA-01","BQA-05"]
legacy_tasks: ["SH-028","SH-032"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "extend"
blocked_reason: null
open_questions: []
verification_profiles: ["build:offline-preview","browser:offline-preview"]
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

# WB-PBI-032 — Present the generated application offline

## Need and requirement

As a **Application reviewer**, I need to experiment with a portable built application without a server or production service.

Workbench SHALL build a self-contained offline demonstration from the generated source that executes every selected interaction with embedded approved assets and complete isolated fixtures.

## Use case

**Preconditions:** The generated project is built through its documented explicit process; the portable artifact is selected.

**Trigger:** The actor deliberately requests this use case.

1. Open the single-file artifact from a file origin.
2. Inspect demo labeling and choose a scenario.
3. Exercise navigation, dialogs, local and data interactions.
4. Reset and share the same declared artifact with its limitations.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- A service worker or CDN cannot be the sole dependency for file-origin interaction behavior.
- A simulated save cannot be labeled as real database or vault persistence.

## Acceptance criteria

### WB-PBI-032-AC01

Given disabled network and no local server, when the file-origin build opens, then all selected interactions operate with their packaged fixtures.

### WB-PBI-032-AC02

Given routes and modal entry/return, when navigation runs from the file artifact, then declared destinations and return state work without server routing.

### WB-PBI-032-AC03

Given the generated source and built preview, when semantic behavior is compared, then both originate from the same accepted definitions rather than independently maintained mockup pages.

### WB-PBI-032-AC04

Given artifact inspection and network denial, when the demo is exercised, then no runtime CDN/provider/live-vault calls occur and required license notices remain included.

## Fixtures, quality and scope

**Required test data:** File-origin build with network blocked, dialogs, stateful mutations and resets. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Offline built output does not promise offline dependency installation or substitute for actual plugin-host acceptance.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-026](WB-PBI-026.md), [WB-PBI-031](WB-PBI-031.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
