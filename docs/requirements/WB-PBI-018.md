---
type: PBI
schema_version: 1
id: "WB-PBI-018"
title: "Start and continue a design-only project"
product: "Workbench"
epic: "WB-E03"
feature: "WB-F09"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I2"
lane: "concept"
priority: "must"
rank: 6
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
depends_on: ["WB-PBI-002"]
gate_prerequisites: []
contributes_to: ["CP-010"]
requirements: ["MVP-05","MVP-11","MVP-24"]
work_packages: ["WM-09"]
acceptance_refs: ["A05","A09","A18","WVA-10"]
legacy_tasks: ["CX-002","CX-008"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "extend"
blocked_reason: null
open_questions: []
verification_profiles: ["browser:authoring"]
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

# WB-PBI-018 — Start and continue a design-only project

## Need and requirement

As a **Product builder**, I need to explore a product idea without installing a development toolchain or creating an account.

Workbench SHALL support blank or explicitly selected starter-based design-only authoring, save/export and later continuation without requiring external Node, npm, Git or AI services.

## Use case

**Preconditions:** The authoring application is available; an external starter pack is needed only when selecting one of its starters.

**Trigger:** The actor deliberately requests this use case.

1. Start an empty project or select a compatible starter.
2. Describe the product and create the initial structure.
3. Save or export accepted design content.
4. Reopen/import and continue from the same stable project identity.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- No starter selection silently loads Workbench example data.
- Invalid imports and discarded drafts preserve prior accepted design content.

## Acceptance criteria

### WB-PBI-018-AC01

Given no external toolchain or account, when design-only work begins, then creation, editing and portable export remain usable.

### WB-PBI-018-AC02

Given a blank project, when it opens, then it contains no undisclosed showcase records and identifies the next authoring action.

### WB-PBI-018-AC03

Given accepted design content, when it is saved/exported and reopened, then stable IDs, descriptions and component/scenario references survive.

### WB-PBI-018-AC04

Given cancelled import or unsaved drafts, when the user changes context, then explicit retain/discard behavior prevents silent data loss.

## Fixtures, quality and scope

**Required test data:** Empty project, optional compatible starter, saved export and invalid import. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Build/install prerequisites are separate from design-only use; native save/reopen qualification is covered by the native PBIs.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-002](WB-PBI-002.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
