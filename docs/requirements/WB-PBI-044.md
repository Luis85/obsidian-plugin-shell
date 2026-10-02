---
type: PBI
schema_version: 1
id: "WB-PBI-044"
title: "Prepare and rehearse a fixed release candidate"
product: "Workbench"
epic: "WB-E06"
feature: "WB-F24"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I3"
lane: "foundation"
priority: "must"
rank: 48
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
depends_on: ["WB-PBI-043"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-21","MVP-23","MVP-24"]
work_packages: ["WM-19"]
acceptance_refs: ["A15","A17","A18","WVA-19"]
legacy_tasks: ["SH-031"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "qualify"
blocked_reason: null
open_questions: []
verification_profiles: ["release:local"]
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

# WB-PBI-044 — Prepare and rehearse a fixed release candidate

## Need and requirement

As a **Release maintainer**, I need to prepare a traceable release without accidentally publishing it.

Workbench SHALL prepare and rehearse an exact candidate with matching artifacts, versions, notes, licenses and applicable evidence while performing no remote publication.

## Use case

**Preconditions:** The selected product profile and candidate source/artifacts are explicitly identified.

**Trigger:** The actor deliberately requests this use case.

1. Select framework, generated-consumer or native product profile.
2. Review version, release notes, artifact inventory and required evidence.
3. Prepare/rehearse the local candidate through existing release services.
4. Retain eligibility results and any blockers without public mutation.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Missing or mismatched evidence blocks eligibility.
- A generated consumer cannot package itself as the framework or inherit another product profile acceptance.

## Acceptance criteria

### WB-PBI-044-AC01

Given a candidate, when local preparation/rehearsal completes, then matching source, tool, asset and evidence identities are retained.

### WB-PBI-044-AC02

Given local rehearsal, when external effects are inspected, then no tag, commit push, public upload or release promotion occurs.

### WB-PBI-044-AC03

Given absent evidence or changed assets, when eligibility is checked, then the candidate is blocked rather than silently rebuilt or approved.

### WB-PBI-044-AC04

Given different release profiles, when requirements are evaluated, then framework, consumer and native acceptance obligations remain distinct and inherited gates are preserved.

## Fixtures, quality and scope

**Required test data:** Valid candidate, missing evidence, changed asset and wrong product-profile fixtures. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Eligibility is not publication approval; do not retag, merge or raise versions as a side effect of this documentation work.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-043](WB-PBI-043.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
