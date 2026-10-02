---
type: PBI
schema_version: 1
id: "WB-PBI-050"
title: "Publish and support the accepted native product"
product: "Workbench"
epic: "WB-E07"
feature: "WB-F27"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I6"
lane: "publication"
priority: "must"
rank: 54
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
depends_on: ["WB-PBI-049"]
gate_prerequisites: ["CP-010"]
contributes_to: ["PUB-004","PUB-005"]
requirements: ["MVP-22","MVP-23","MVP-24"]
work_packages: ["WM-19"]
acceptance_refs: ["A16","A17","A18","A19","WVA-19"]
legacy_tasks: ["PUB-001","PUB-002","PUB-003","PUB-004","PUB-005"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "qualify"
blocked_reason: null
open_questions: []
verification_profiles: ["release:remote-native","native:downloaded-workbench"]
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

# WB-PBI-050 — Publish and support the accepted native product

## Need and requirement

As a **Release maintainer**, I need to deliver the accepted native Workbench with a reproducible installation and recovery path.

Workbench SHALL publish only a separately approved eligible native candidate, provide matching support documentation and verify installation/recovery from the downloaded artifacts.

## Use case

**Preconditions:** CP-010 is satisfied; distribution/policy review, candidate rehearsal and fresh owner authorization are recorded.

**Trigger:** The actor deliberately requests this use case.

1. Resolve the applicable native distribution and support boundary.
2. Rehearse candidate artifacts, onboarding and recovery instructions.
3. Obtain exact candidate/destination/action approval and publish retained bytes.
4. Redownload and verify native installation and recovery in isolation.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Missing approval, policy questions or evidence block the affected external action.
- Directory listing acceptance is distinct from a GitHub asset release.

## Acceptance criteria

### WB-PBI-050-AC01

Given eligible native assets, when shipment is prepared, then licenses, compatibility, known limitations, onboarding and recovery instructions match the candidate.

### WB-PBI-050-AC02

Given absent authorization or changed bytes, when publish is attempted, then no public mutation occurs.

### WB-PBI-050-AC03

Given approved retained assets, when publication and redownload complete, then matching hashes and the documented native installation path are verified.

### WB-PBI-050-AC04

Given installation or update failure, when support/recovery instructions are followed, then owned data is preserved and unrelated vault/plugin content remains untouched.

## Fixtures, quality and scope

**Required test data:** Accepted native candidate, missing approval, downloaded assets and failed update/recovery. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** No automatic activation, permission change or directory submission; each external operation requires its own approval.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-049](WB-PBI-049.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
