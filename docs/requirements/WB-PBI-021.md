---
type: PBI
schema_version: 1
id: "WB-PBI-021"
title: "Revise a component and migrate selected usages"
product: "Workbench"
epic: "WB-E03"
feature: "WB-F11"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I2"
lane: "concept"
priority: "must"
rank: 22
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
depends_on: ["WB-PBI-020"]
gate_prerequisites: []
contributes_to: ["CP-010"]
requirements: ["MVP-08","MVP-15","MVP-18","MVP-QR-01","BQ-10"]
work_packages: ["WM-10","WM-12"]
acceptance_refs: ["A07","A10","A13","WVA-11","WVA-14","BQA-10"]
legacy_tasks: ["CX-003","CX-006","SH-018"]
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

# WB-PBI-021 — Revise a component and migrate selected usages

## Need and requirement

As a **UI author**, I need to make a shared change deliberately and see its impact before adopting it.

Workbench SHALL create a new component revision, identify affected usages and contracts, and apply a reviewed migration only to selected instances.

## Use case

**Preconditions:** At least two pages reference an existing published component revision.

**Trigger:** The actor deliberately requests this use case.

1. Revise the component contract or behavior.
2. Inspect used-by pages, incompatible bindings and affected fixtures/docs/tests.
3. Select usages to migrate and review required adjustments.
4. Apply the revision adoption and preserve remaining pins/overrides.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Existing published revisions remain immutable.
- Unresolved incompatibilities prevent affected adoption rather than silently substituting defaults.

## Acceptance criteria

### WB-PBI-021-AC01

Given a published component, when a new revision is created, then the old revision remains unchanged and both are identified explicitly.

### WB-PBI-021-AC02

Given two pinned usages, when only one is migrated, then the unselected usage and its overrides remain byte/semantically unchanged.

### WB-PBI-021-AC03

Given a changed event/property contract, when impact is inspected, then affected bindings, fixtures, docs and generated dependencies are identified before apply.

### WB-PBI-021-AC04

Given unresolved or stale migration input, when apply is requested, then invalid adoption is blocked and no pinned usage is silently upgraded.

## Fixtures, quality and scope

**Required test data:** Two-page revision change, incompatible event, instance override and stale impact plan. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** No automatic global upgrade or code-to-design merge; reviewed generation handles resulting source changes separately.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-020](WB-PBI-020.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
