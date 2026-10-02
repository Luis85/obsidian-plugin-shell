---
type: PBI
schema_version: 1
id: "WB-PBI-045"
title: "Publish and verify an approved framework release"
product: "Workbench"
epic: "WB-E06"
feature: "WB-F24"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I4"
lane: "publication"
priority: "must"
rank: 49
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
depends_on: ["WB-PBI-044"]
gate_prerequisites: ["SH-022"]
contributes_to: ["SH-034"]
requirements: ["MVP-22","MVP-23","MVP-24"]
work_packages: ["WM-19"]
acceptance_refs: ["A16","A17","A18","WVA-19"]
legacy_tasks: ["SH-034"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "qualify"
blocked_reason: null
open_questions: []
verification_profiles: ["release:remote","archive:downloaded"]
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

# WB-PBI-045 — Publish and verify an approved framework release

## Need and requirement

As a **Release maintainer**, I need to ship the qualified engine and starter pack with verified recovery and first-use instructions.

Workbench SHALL publish only explicitly approved retained framework/starter assets and verify the downloaded bytes and documented clean-entry workflow.

## Use case

**Preconditions:** SH-022 is evidenced; exact candidate, destination and actions receive fresh explicit owner approval.

**Trigger:** The actor deliberately requests this use case.

1. Inspect candidate eligibility and publication authorization.
2. Publish only the approved retained bytes.
3. Handle partial uploads through the reviewed recovery contract.
4. Redownload, compare hashes and execute the release-asset smoke flow.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Denied/absent approval or changed candidates block remote writes.
- Foreign releases and uncertain partial outcomes are not overwritten or blindly retried.

## Acceptance criteria

### WB-PBI-045-AC01

Given missing approval or changed candidate identity, when publication is requested, then remote mutation is refused.

### WB-PBI-045-AC02

Given explicit matching approval, when publication executes, then only retained engine and separate starter assets are uploaded without rebuild or dependency upgrade.

### WB-PBI-045-AC03

Given a partial upload or foreign release, when recovery is considered, then the operation preserves foreign assets and follows an inspected authorized recovery plan.

### WB-PBI-045-AC04

Given published assets, when redownload verification runs, then hashes match and the documented isolated first-use path passes with the recorded release identity.

## Fixtures, quality and scope

**Required test data:** Authorized/denied request fixtures, changed candidate, partial upload and foreign release. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** A PBI, checksum, status or --yes flag is never release authorization; this task record does not grant it.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-044](WB-PBI-044.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
