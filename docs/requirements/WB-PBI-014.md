---
type: PBI
schema_version: 1
id: "WB-PBI-014"
title: "Resolve competing Markdown and model edits"
product: "Workbench"
epic: "WB-E02"
feature: "WB-F06"
outcomes: ["O-DX","O-DOCS"]
release: "MVP"
milestone: "I2"
lane: "foundation"
priority: "must"
rank: 20
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
depends_on: ["WB-PBI-013"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-11","MVP-18","MVP-20"]
work_packages: ["WM-07","WM-12"]
acceptance_refs: ["A09","A13","A14","WVA-08","WVA-14"]
legacy_tasks: ["SH-012","SH-018"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "add"
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

# WB-PBI-014 — Resolve competing Markdown and model edits

## Need and requirement

As a **Author**, I need to reimport evolving documentation without losing edits made in the UI or source document.

Workbench SHALL compare imported content with its recorded base and field ownership, then require an explicit resolution for competing changes before updating the canonical project.

## Use case

**Preconditions:** A previous accepted import records document identity, base revision and mapped field ownership.

**Trigger:** The actor deliberately requests this use case.

1. Reinspect the edited or renamed document.
2. Compare source, accepted base and current model fields.
3. Choose source/model values or leave conflicts unresolved.
4. Review and apply a fresh plan, retaining the source and resolution provenance.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Renaming a document must not create a duplicate element when the stable ID is unchanged.
- Changed input after review invalidates resolution; unsupported fields are not silently discarded.

## Acceptance criteria

### WB-PBI-014-AC01

Given a filename change with the same stable ID, when reimport is accepted, then the existing element is updated without a new identity.

### WB-PBI-014-AC02

Given one-sided edits, when a change is proposed, then only the mapped owned fields are included and unrelated content is preserved.

### WB-PBI-014-AC03

Given competing edits to an owned field, when import is attempted, then no silent winner is selected and an unresolved conflict prevents replacement.

### WB-PBI-014-AC04

Given a stale reviewed resolution or cancelled import, when apply is attempted, then committed project content remains unchanged and the next safe review action is provided.

## Fixtures, quality and scope

**Required test data:** Rename, source-only, model-only, competing-edit and stale-resolution documents. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** No unrestricted bidirectional code/design synchronization or silent merge of unknown fields.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-013](WB-PBI-013.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
