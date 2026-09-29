---
type: PBI
schema_version: 1
id: "WB-PBI-048"
title: "Use shared project operations from native Workbench"
product: "Workbench"
epic: "WB-E07"
feature: "WB-F26"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I5"
lane: "native"
priority: "must"
rank: 52
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
depends_on: ["WB-PBI-047"]
gate_prerequisites: ["SH-022","SH-034","CX-007"]
contributes_to: ["CP-010"]
requirements: ["MVP-04","MVP-17","MVP-18","MVP-24","MVP-QR-01","BQ-09"]
work_packages: ["WM-17"]
acceptance_refs: ["A12","A13","A18","A19","WVA-17"]
legacy_tasks: ["CP-004","CP-005","CP-006","CP-008"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "implement"
blocked_reason: null
open_questions: []
verification_profiles: ["native:workbench","contract:shared"]
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

# WB-PBI-048 — Use shared project operations from native Workbench

## Need and requirement

As a **Workbench author**, I need to prepare, generate and test a project without a second private tooling workflow.

Native Workbench SHALL expose reviewed setup, generation, fixture and recovery handoffs through the same public operations and diagnostics as the CLI.

## Use case

**Preconditions:** Native project state is persisted and the compatible shipped tooling contract is discoverable.

**Trigger:** The actor deliberately requests this use case.

1. Choose the relevant setup, generation, test-data or recovery action.
2. Inspect scope, target, required capabilities and the shared plan.
3. Approve the permitted handoff or run the provided user-invoked CLI operation.
4. Read actual outcome/evidence without inferring unexecuted stages.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Design-only work remains usable when external tools are absent.
- Missing permission or stale plans block execution; importing data never grants process authority.

## Acceptance criteria

### WB-PBI-048-AC01

Given equivalent native and CLI requests, when the shared operation is inspected, then model validation, file scope and diagnostic semantics agree.

### WB-PBI-048-AC02

Given absent Node/npm or skipped template preparation, when design-only work continues, then authoring does not require external installation.

### WB-PBI-048-AC03

Given fixtures or generation affecting files/processes, when a native action is selected, then approved isolated targets and separate execution consent are retained.

### WB-PBI-048-AC04

Given a cancelled, failed or stale handoff, when the result is displayed, then actual state and the safe next step are shown without simulated completion or automatic retry.

## Fixtures, quality and scope

**Required test data:** Native-to-CLI requests, absent tools, stale plan, denied execution and failed fixture materialization. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** No duplicate installer/writer, hidden native process executor or private framework copy; native host policy remains applicable.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-047](WB-PBI-047.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
