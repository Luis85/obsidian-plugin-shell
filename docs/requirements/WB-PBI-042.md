---
type: PBI
schema_version: 1
id: "WB-PBI-042"
title: "Verify unsafe inputs and execution are contained"
product: "Workbench"
epic: "WB-E06"
feature: "WB-F22"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I3"
lane: "foundation"
priority: "must"
rank: 43
status: "new"
revision: 1
created: "2026-09-29"
updated: "2026-09-29"
status_since: "2026-09-29"
owner: null
owner_role: "Quality and release"
review_status: "pending"
review_record: null
estimate_points: null
value_score: null
risk: null
depends_on: ["WB-PBI-002","WB-PBI-003","WB-PBI-005","WB-PBI-013","WB-PBI-028","WB-PBI-035"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-09","MVP-18","MVP-23","MVP-QR-01","BQ-05","BQ-10"]
work_packages: ["WM-14"]
acceptance_refs: ["A08","A13","A17","A19","WVA-18","BQA-05"]
legacy_tasks: ["SH-012","SH-021","SH-023"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "qualify"
blocked_reason: null
open_questions: []
verification_profiles: ["contract:shared","security:shared"]
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

# WB-PBI-042 — Verify unsafe inputs and execution are contained

## Need and requirement

As a **Security reviewer**, I need to reject unsafe data and unintended effects without weakening existing quality gates.

Workbench SHALL enforce the reviewed input, filesystem, execution, export and native-data boundaries and demonstrate those controls using failing negative fixtures.

## Use case

**Preconditions:** The candidate and applicable threat/failure model cover configuration, starters, documents, generation and modes.

**Trigger:** The actor deliberately requests this use case.

1. Inspect boundaries and current retained quality requirements.
2. Run hostile input and controlled failure cases against actual services.
3. Check safe diagnostics, protected data and process ownership.
4. Record each required control result and unresolved blocker for the exact candidate.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Reading source/Markdown/JSON never grants execution or publication permission.
- Uncertain writes and provider outcomes are investigated rather than blindly retried.

## Acceptance criteria

### WB-PBI-042-AC01

Given hostile shape, path/archive escape or oversized input, when the corresponding operation runs, then bounded validation prevents unapproved effects and preserves protected content.

### WB-PBI-042-AC02

Given imported process declarations or scripts, when data is inspected/imported, then no dependency, network, host or publication operation executes without its separate approval.

### WB-PBI-042-AC03

Given diagnostics and production/demo output, when exported artifacts are reviewed, then secrets, personal content and forbidden demo resources do not leak through hidden fields.

### WB-PBI-042-AC04

Given current inherited code-size, architecture, dependency, coverage and safety gates, when qualification runs, then required checks retain their scope/thresholds and actual negative controls fail as expected.

## Fixtures, quality and scope

**Required test data:** Unsafe nested data, archive/path attacks, injected persistence failures, leaked-secret and missing-guard negatives. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** A local report cannot authenticate execution by itself; full repository qualification remains a separate actual run.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-002](WB-PBI-002.md), [WB-PBI-003](WB-PBI-003.md), [WB-PBI-005](WB-PBI-005.md), [WB-PBI-013](WB-PBI-013.md), [WB-PBI-028](WB-PBI-028.md), [WB-PBI-035](WB-PBI-035.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
