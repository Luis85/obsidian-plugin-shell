---
type: PBI
schema_version: 1
id: "WB-PBI-028"
title: "Regenerate a selected use-case scope safely"
product: "Workbench"
epic: "WB-E04"
feature: "WB-F15"
outcomes: ["O-DX","O-TIME","O-DOCS","O-QUALITY"]
release: "MVP"
milestone: "I3"
lane: "foundation"
priority: "must"
rank: 32
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
depends_on: ["WB-PBI-026","WB-PBI-027"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-13","MVP-14","MVP-15","MVP-18","MVP-QR-01","BQ-10"]
work_packages: ["WM-12"]
acceptance_refs: ["A10","A13","WVA-14","BQA-10"]
legacy_tasks: ["SH-018","SH-028","SH-030"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "qualify"
blocked_reason: null
open_questions: []
verification_profiles: ["filesystem:cli","contract:shared"]
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

# WB-PBI-028 — Regenerate a selected use-case scope safely

## Need and requirement

As a **Developer**, I need to make a targeted UI change while preserving unrelated and handwritten work.

Workbench SHALL compute the dependency closure of a selected feature, page or component and apply only its reviewed generated changes, preserving developer-owned files and reporting conflicts.

## Use case

**Preconditions:** An accepted project and ownership receipt exist; selected elements and dependencies are identifiable.

**Trigger:** The actor deliberately requests this use case.

1. Select the feature, page or component to regenerate.
2. Inspect dependent components, registrations, fixtures, tests and docs.
3. Review creates, updates, conflicts, unchanged files and retirement proposals.
4. Apply a current approved plan or investigate the precise recovery result.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Edited managed files and changed reviewed inputs block replacement.
- Partial write failure is reported honestly; retirement never silently deletes files.

## Acceptance criteria

### WB-PBI-028-AC01

Given a selected scope with shared dependencies, when its plan is inspected, then the required closure is included exactly once and unrelated outputs are excluded.

### WB-PBI-028-AC02

Given identical inputs and target bytes, when generation is repeated, then the result is a no-op.

### WB-PBI-028-AC03

Given handwritten source, custom adapters or fixture overrides, when a valid plan applies, then those owned bytes survive and incompatible managed edits are conflicts.

### WB-PBI-028-AC04

Given stale input or injected mid-write failure, when apply runs, then stale changes are refused or the exact partial recovery is retained without false atomicity or blind retry.

## Fixtures, quality and scope

**Required test data:** Edited independent consumer, shared component, custom adapter, retired output and interrupted write. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Extend existing scope/ownership logic; do not replace it with a second writer or arbitrary code-to-design synchronization.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-026](WB-PBI-026.md), [WB-PBI-027](WB-PBI-027.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
