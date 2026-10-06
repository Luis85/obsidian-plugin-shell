---
type: PBI
schema_version: 1
id: "WB-PBI-046"
title: "Generate native Workbench from its self-project"
product: "Workbench"
epic: "WB-E07"
feature: "WB-F25"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I5"
lane: "native"
priority: "must"
rank: 50
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
depends_on: ["WB-PBI-045","WB-PBI-002"]
gate_prerequisites: ["SH-022","SH-034","CX-007"]
contributes_to: ["CP-010"]
requirements: ["MVP-12","MVP-17","MVP-23"]
work_packages: ["WM-17"]
acceptance_refs: ["A09","A12","A17","WVA-17"]
legacy_tasks: ["CP-001","CP-005"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "implement"
blocked_reason: null
open_questions: []
verification_profiles: ["build:workbench-native","native:workbench"]
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

# WB-PBI-046 — Generate native Workbench from its self-project

## Need and requirement

As a **Workbench maintainer**, I need to produce the native authoring product through the same public generation path used by customers.

Workbench SHALL generate its full reviewed native composition from the accepted self-project and shipped kit, resolving required editors to maintained trusted implementations rather than placeholders.

## Use case

**Preconditions:** SH-022, SH-034 and CX-007 are satisfied and the exact self-project export is accepted.

**Trigger:** The actor deliberately requests this use case.

1. Reconcile retained surfaces, components, revisions, routes and required capabilities.
2. Select the accepted export and shipped compatible kit in a clean workspace.
3. Generate, install dependencies explicitly and build without maintainer source access.
4. Open the generated product for the separate native behavior acceptance protocols.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- No scope reduction may remove difficult capabilities merely to obtain a green build.
- Unresolved editor implementations or manually patched disposable output fail generation acceptance.

## Acceptance criteria

### WB-PBI-046-AC01

Given the full reviewed export and shipped kit, when native Workbench is generated, then the entire reconciled composition and implemented capability modules are present without manual copying.

### WB-PBI-046-AC02

Given an isolated independent workspace, when the generated product builds, then no maintainer checkout, private foundation copy or authoring wrapper is required.

### WB-PBI-046-AC03

Given required editor capabilities, when they are resolved, then an iframe, handler signature, TODO or placeholder engine cannot satisfy a selected module.

### WB-PBI-046-AC04

Given changes to the self-project inventory, when reconciliation occurs, then retained IDs/revisions and any intentional replacements have explicit impact and approval records.

## Fixtures, quality and scope

**Required test data:** Full Workbench self-project, missing trusted module and source-isolated independent generation. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Generation/build evidence does not replace the persistence, editor and lifecycle acceptance in the following native PBIs.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-045](WB-PBI-045.md), [WB-PBI-002](WB-PBI-002.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
