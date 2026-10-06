---
type: PBI
schema_version: 1
id: "WB-PBI-023"
title: "Define and inspect a branching user journey"
product: "Workbench"
epic: "WB-E03"
feature: "WB-F12"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I2"
lane: "concept"
priority: "must"
rank: 23
status: "new"
revision: 1
created: "2026-09-29"
updated: "2026-09-29"
status_since: "2026-09-29"
owner: null
owner_role: "UX and authoring"
review_status: "pending"
review_record: null
estimate_points: null
value_score: null
risk: null
depends_on: ["WB-PBI-022","WB-PBI-019"]
gate_prerequisites: []
contributes_to: ["CP-010"]
requirements: ["MVP-07","MVP-08","MVP-QR-01","BQ-02"]
work_packages: ["WM-10"]
acceptance_refs: ["A06","A07","A11","WVA-11","BQA-02"]
legacy_tasks: ["CX-003","CP-003"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "extend"
blocked_reason: null
open_questions: []
verification_profiles: ["browser:authoring","contract:shared"]
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

# WB-PBI-023 — Define and inspect a branching user journey

## Need and requirement

As a **UI author**, I need to review the intended navigation through the same pages used by the application.

Workbench SHALL define named journeys over existing surfaces and declared transitions, including branches and modal return, while preserving editor context.

## Use case

**Preconditions:** Relevant pages and eligible transitions exist; missing references remain explicit planning findings.

**Trigger:** The actor deliberately requests this use case.

1. Create a journey and select existing surfaces.
2. Declare ordered steps, alternative branches and modal entry/return.
3. Inspect each linked page/component and return to the previous context.
4. Preview the declared journey with its reproducible state fixtures.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- A journey cannot invent executable actions from visual order.
- Deleting or changing a referenced surface reports the affected journey before acceptance.

## Acceptance criteria

### WB-PBI-023-AC01

Given a named journey, when it references pages, then it uses their existing stable IDs rather than copied page records.

### WB-PBI-023-AC02

Given a branch or modal transition, when the scenario runs, then only declared navigation executes and modal return restores the correct origin/context.

### WB-PBI-023-AC03

Given a jump to a page or component editor, when Back is used, then journey selection and editing context are restored without discarding protected drafts.

### WB-PBI-023-AC04

Given a missing executable transition or fixture, when the journey is validated, then complete-demo readiness is blocked at the relevant step.

## Fixtures, quality and scope

**Required test data:** Branching journey, nested dialog return, missing transition and dirty-editor navigation. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Journey Lens does not replace existing Storymaps activities or release-slice semantics.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-022](WB-PBI-022.md), [WB-PBI-019](WB-PBI-019.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
