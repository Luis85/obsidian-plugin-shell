---
type: PBI
schema_version: 1
id: "WB-PBI-011"
title: "Build and showcase the generated demo on first run"
product: "Workbench"
epic: "WB-E01"
feature: "WB-F05"
outcomes: ["O-DX","O-TIME"]
release: "MVP"
milestone: "I2"
lane: "foundation"
priority: "must"
rank: 31
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
depends_on: ["WB-PBI-007","WB-PBI-026","WB-PBI-027","WB-PBI-029","WB-PBI-030"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-04","MVP-QR-01","BQ-01","BQ-09"]
work_packages: ["WM-06"]
acceptance_refs: ["A04","A11","A18","WVA-06","WVA-07","BQA-01"]
legacy_tasks: ["SH-012","SH-029"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "extend"
blocked_reason: null
open_questions: []
verification_profiles: ["cli:shared","browser:angular-webapp","native:obsidian-vue"]
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

# WB-PBI-011 — Build and showcase the generated demo on first run

## Need and requirement

As a **Developer**, I need to present an operational seeded interface immediately after explicitly approved setup steps.

Workbench SHALL execute only the selected target-aware install, build, verification and showcase steps, using preloaded fixtures and separate truthful outcomes.

## Use case

**Preconditions:** Prepared source is available; dependency execution and any launch are separately reviewed.

**Trigger:** The actor deliberately requests this use case.

1. Choose prepare-only or selected first-run steps.
2. Inspect commands, working directory, network/lifecycle effects and target.
3. Approve the selected execution sequence.
4. Run in dependency order and report actual output readiness with its active demo scenario.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Lock mismatch requires explicit resolution rather than a silent install fallback.
- Failed readiness, occupied ports or cancellation stop downstream steps and preserve unrelated processes.

## Acceptance criteria

### WB-PBI-011-AC01

Given declined first run, when setup exits, then there are zero install/build/server/browser/native launch operations.

### WB-PBI-011-AC02

Given approved steps and valid prerequisites, when the target starts, then its designed interactions have seeded fixtures without production backend, manual seeding or generated-source repair.

### WB-PBI-011-AC03

Given a failed step or unavailable preview, when execution ends, then downstream steps stop and the result does not claim built, verified or showcased success.

### WB-PBI-011-AC04

Given a lockfile mismatch or an occupied port, when execution is requested, then resolution/ownership is explained without silently changing dependencies or killing another service.

## Fixtures, quality and scope

**Required test data:** Seeded generated webapp/plugin, declined run, failed install and occupied loopback port. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Showcase launch is not plugin activation or production acceptance; native testing uses its separately approved isolated target.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-007](WB-PBI-007.md), [WB-PBI-026](WB-PBI-026.md), [WB-PBI-027](WB-PBI-027.md), [WB-PBI-029](WB-PBI-029.md), [WB-PBI-030](WB-PBI-030.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
