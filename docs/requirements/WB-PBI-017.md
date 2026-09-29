---
type: PBI
schema_version: 1
id: "WB-PBI-017"
title: "Integrate a project, feature or improvement concept"
product: "Workbench"
epic: "WB-E02"
feature: "WB-F08"
outcomes: ["O-DX","O-DOCS"]
release: "MVP"
milestone: "I2"
lane: "foundation"
priority: "must"
rank: 5
status: "new"
revision: 1
created: "2026-09-29"
updated: "2026-09-29"
status_since: "2026-09-29"
owner: null
owner_role: "Requirements and documentation"
review_status: "pending"
review_record: null
estimate_points: null
value_score: null
risk: null
depends_on: ["WB-PBI-002"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-19","MVP-20","MVP-18"]
work_packages: ["WM-12"]
acceptance_refs: ["A13","A14","WVA-14"]
legacy_tasks: ["SH-027","SH-028"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "qualify"
blocked_reason: null
open_questions: []
verification_profiles: ["contract:shared","filesystem:cli"]
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

# WB-PBI-017 — Integrate a project, feature or improvement concept

## Need and requirement

As a **Developer**, I need to adopt an approved concept without copying its runtime or overwriting current work.

Workbench SHALL inspect data-only project, feature and base-bound improvement packages and apply only their reviewed canonical changes with explicit ID mapping and provenance.

## Use case

**Preconditions:** A supported concept package or recognized inert payload is available in the selected concept scope.

**Trigger:** The actor deliberately requests this use case.

1. Inspect package type, source inventory and intended scope.
2. Review references, conflicts and base-model identity.
3. Choose explicit remapping or compatible reuse where required.
4. Apply the canonical change and retain source/provenance for replay.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- HTML without a recognized inert model is reference-only and never executed by intake.
- Stale improvement bases, missing dependencies and collisions block unreviewed replacement.

## Acceptance criteria

### WB-PBI-017-AC01

Given each concept mode, when a valid plan is applied, then only the reviewed project or feature scope changes and original concept source is retained.

### WB-PBI-017-AC02

Given a stale base or identity collision, when improvement intake is attempted, then the conflicting references are shown and no silent merge occurs.

### WB-PBI-017-AC03

Given executable HTML or an unsupported payload, when inspection runs, then no scripts, packages, network operations or arbitrary paths are executed.

### WB-PBI-017-AC04

Given identical reimport, when intake is replayed, then the result is unchanged and recorded hashes/mappings still identify the accepted source.

## Fixtures, quality and scope

**Required test data:** Full-project, feature, improvement, stale-base and reference-only HTML packages. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Reuse existing concept intake; scoped source generation is a separate reviewed use case.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-002](WB-PBI-002.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
