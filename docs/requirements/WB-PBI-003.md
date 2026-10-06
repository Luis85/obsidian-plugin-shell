---
type: PBI
schema_version: 1
id: "WB-PBI-003"
title: "Configure project paths and preferences"
product: "Workbench"
epic: "WB-E01"
feature: "WB-F02"
outcomes: ["O-DX","O-TIME"]
release: "MVP"
milestone: "I1"
lane: "foundation"
priority: "must"
rank: 3
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
depends_on: ["WB-PBI-002"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-03","MVP-QR-01","BQ-01"]
work_packages: ["WM-03"]
acceptance_refs: ["A03","WVA-02","WVA-13"]
legacy_tasks: ["SH-005","SH-027"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "extend"
blocked_reason: null
open_questions: []
verification_profiles: ["contract:shared","filesystem:cli"]
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

# WB-PBI-003 — Configure project paths and preferences

## Need and requirement

As a **Developer**, I need to adapt Workbench to the project layout instead of relocating the project.

Workbench SHALL resolve configurable paths and preferences from configs/user-settings.json, show each effective value and validate destinations before applying a reviewed settings change.

## Use case

**Preconditions:** The project root is explicitly selected; protected implementation paths remain reserved.

**Trigger:** The actor deliberately requests this use case.

1. Inspect defaults and current effective values.
2. Edit source, test, documentation, starter, fixture and preview destinations.
3. Review precedence, affected consumers and path conflicts.
4. Save valid settings; use them in subsequent operations.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Traversal, symlink escape, overlaps and case-conflicting destinations block the plan.
- Changing a path changes configuration only; moving existing data requires a separate reviewed operation.

## Acceptance criteria

### WB-PBI-003-AC01

Given a saved preference and an explicit invocation override, when settings are resolved, then the override wins and its origin is shown without silently rewriting the saved value.

### WB-PBI-003-AC02

Given valid non-default roots, when configuration is accepted, then downstream generation, documentation, build and test inputs resolve through the same effective settings.

### WB-PBI-003-AC03

Given overlapping or escaping paths, when the change is planned, then the invalid fields are identified and both settings and existing data remain unchanged.

### WB-PBI-003-AC04

Given an imported or starter-provided default conflicting with a saved value, when setup proposes settings, then the developer must review the difference before replacement.

## Fixtures, quality and scope

**Required test data:** Default/non-default layouts, case collisions and controlled symlink escape fixtures. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Identity remains separately governed; configure user-facing paths, not every protected internal implementation path.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-002](WB-PBI-002.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
