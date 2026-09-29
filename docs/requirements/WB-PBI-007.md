---
type: PBI
schema_version: 1
id: "WB-PBI-007"
title: "Initialize a project from a starter or blank"
product: "Workbench"
epic: "WB-E01"
feature: "WB-F04"
outcomes: ["O-DX","O-TIME"]
release: "MVP"
milestone: "I1"
lane: "foundation"
priority: "must"
rank: 25
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
depends_on: ["WB-PBI-005"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-01","MVP-02","MVP-03","MVP-04"]
work_packages: ["WM-05"]
acceptance_refs: ["A01","A02","A03","A04","WVA-05","WVA-06"]
legacy_tasks: ["SH-026","SH-027"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "extend"
blocked_reason: null
open_questions: []
verification_profiles: ["cli:shared","filesystem:cli"]
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

# WB-PBI-007 — Initialize a project from a starter or blank

## Need and requirement

As a **Developer**, I need to create an independent project through one discoverable setup path.

Workbench SHALL initialize a reviewed project from an external starter, including an explicit blank starter, while preserving unrelated content and keeping execution optional.

## Use case

**Preconditions:** The extracted kit is verified and the selected external starter is compatible.

**Trigger:** The actor deliberately requests this use case.

1. Choose starter or blank in setup.
2. Review identity, target, paths and context.
3. Review the resulting file and operation plan.
4. Apply preparation and choose whether to perform a first run.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Kit-owned files do not trigger the separate new-command empty-folder policy.
- Foreign file conflicts block affected changes; cancellation applies nothing.

## Acceptance criteria

### WB-PBI-007-AC01

Given a fresh extracted kit, when starter setup is accepted, then the independent project is prepared without a maintainer checkout or global CLI installation.

### WB-PBI-007-AC02

Given a blank starter, when it is selected, then only its declared blank scope is created; an empty design does not count as generator-wide MVP qualification.

### WB-PBI-007-AC03

Given foreign conflicting files, when setup is reviewed, then those files are preserved and conflicts are shown before application.

### WB-PBI-007-AC04

Given a cancelled plan or declined first run, when setup exits, then unapproved writes and dependency/build/launch operations do not occur.

## Fixtures, quality and scope

**Required test data:** Fresh kit with starter, external blank, foreign conflict and cancelled review. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Retain current new-command safety boundaries; preparation is not installation or native activation.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-005](WB-PBI-005.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
