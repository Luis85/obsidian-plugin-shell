---
type: PBI
schema_version: 1
id: "WB-PBI-049"
title: "Accept the complete generated native Workbench"
product: "Workbench"
epic: "WB-E07"
feature: "WB-F26"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I5"
lane: "native"
priority: "must"
rank: 53
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
depends_on: ["WB-PBI-019","WB-PBI-020","WB-PBI-021","WB-PBI-022","WB-PBI-023","WB-PBI-025","WB-PBI-046","WB-PBI-047","WB-PBI-048"]
gate_prerequisites: ["SH-022","SH-034","CX-007"]
contributes_to: ["CP-010"]
requirements: ["MVP-05","MVP-08","MVP-11","MVP-12","MVP-17","MVP-23","MVP-QR-01","BQ-10"]
work_packages: ["WM-17","WM-15"]
acceptance_refs: ["A05","A07","A09","A12","A19","A20","WVA-17","WVA-18","BQA-10"]
legacy_tasks: ["CP-003","CP-007","CP-009","CP-010"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "qualify"
blocked_reason: null
open_questions: []
verification_profiles: ["native:workbench","manual-accessibility:workbench","performance:workbench"]
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

# WB-PBI-049 — Accept the complete generated native Workbench

## Need and requirement

As a **Product trio**, I need to verify the complete native product instead of accepting a shell boot or browser simulation.

The generated native Workbench SHALL pass the retained complete capability, editor, persistence, interoperability, accessibility and lifecycle acceptance on its exact candidate.

## Use case

**Preconditions:** The full generated product and required acceptance inventory are available after the retained framework/conversion gates.

**Trigger:** The actor deliberately requests this use case.

1. Reconcile every required native capability against the reviewed scope.
2. Execute actual sitemap/page/component/docs/design-system and source/fixture workflows.
3. Save, reopen, export and regenerate using the resulting definition.
4. Review native accessibility/performance and record explicit product acceptance or blockers.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- A small plugin or browser-only assertion cannot substitute for a native Workbench case.
- Unimplemented authoring actions cannot be relabeled as consumer business hooks.

## Acceptance criteria

### WB-PBI-049-AC01

Given all retained required capabilities, when native acceptance runs, then actual editors and operations work without missing mandatory modules or scope reduction.

### WB-PBI-049-AC02

Given a native edit/export cycle, when the exported definition regenerates the product, then accepted semantics and source independence remain intact.

### WB-PBI-049-AC03

Given multiple leaves, failed persistence and repeated lifecycle operations, when native protocols run, then actual conflict/recovery/isolation behavior passes.

### WB-PBI-049-AC04

Given native/manual/performance evidence, when CP-010 readiness is reviewed, then every required mode has candidate-bound results and no browser/mock/TODO result is substituted.

## Fixtures, quality and scope

**Required test data:** Full generated native self-project and all retained native/scale/accessibility scenarios. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** CP-010 and all inherited requirements remain authoritative; this use-case acceptance does not authorize publication.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-019](WB-PBI-019.md), [WB-PBI-020](WB-PBI-020.md), [WB-PBI-021](WB-PBI-021.md), [WB-PBI-022](WB-PBI-022.md), [WB-PBI-023](WB-PBI-023.md), [WB-PBI-025](WB-PBI-025.md), [WB-PBI-046](WB-PBI-046.md), [WB-PBI-047](WB-PBI-047.md), [WB-PBI-048](WB-PBI-048.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
