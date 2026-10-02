---
type: PBI
schema_version: 1
id: "WB-PBI-002"
title: "Validate and migrate a declarative project"
product: "Workbench"
epic: "WB-E01"
feature: "WB-F01"
outcomes: ["O-DX","O-TIME"]
release: "MVP"
milestone: "I0"
lane: "foundation"
priority: "must"
rank: 2
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
depends_on: []
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-09","MVP-10","MVP-11","MVP-QR-01","BQ-02"]
work_packages: ["WM-02"]
acceptance_refs: ["A08","A09","WVA-01","BQA-02"]
legacy_tasks: ["SH-015","SH-035"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "extend"
blocked_reason: null
open_questions: []
verification_profiles: ["contract:shared","browser:authoring"]
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

# WB-PBI-002 — Validate and migrate a declarative project

## Need and requirement

As a **Developer**, I need to use the same validated project in authoring, documentation and generation.

Workbench SHALL validate a project against the published versioned contract and report any explicit migration before the project can replace accepted content.

## Use case

**Preconditions:** The input bytes and their declared version are available; migration is not approval to apply changes.

**Trigger:** The actor deliberately requests this use case.

1. Select JSON input or inspect the published schema.
2. Validate shape, bounds and semantic references.
3. Preview the supported migration and its declared losses.
4. Accept through the shared import plan or retain the previous project.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Future versions, unsafe nested keys and invalid executable references are rejected without writes.
- Unresolved planning references remain visible but cannot silently become executable behavior.

## Acceptance criteria

### WB-PBI-002-AC01

Given supported legacy inputs, when migration is reviewed, then retained IDs, descriptions, component pins and fixture references survive the specified transformation.

### WB-PBI-002-AC02

Given duplicate IDs, cycles, invalid bindings or unknown versions, when validation runs, then diagnostics identify the source location and no accepted content is replaced.

### WB-PBI-002-AC03

Given the shared positive and negative corpus, when browser and CLI validators run, then they agree on contract validity and published schema compatibility.

### WB-PBI-002-AC04

Given a missing scenario or handler for a selected interaction, when generation readiness is checked, then a transport-valid input is still blocked from complete-boilerplate readiness.

## Fixtures, quality and scope

**Required test data:** Versioned valid/invalid exports, boundary inputs and deliberately removed fixture references. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Reuse current project schema/validate operations and explicit migration semantics; no arbitrary code execution or inferred business rules.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

No PBI acceptance prerequisite; inspect existing implementation before planning replacement work.

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
