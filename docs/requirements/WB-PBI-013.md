---
type: PBI
schema_version: 1
id: "WB-PBI-013"
title: "Import typed Markdown requirements and UI elements"
product: "Workbench"
epic: "WB-E02"
feature: "WB-F06"
outcomes: ["O-DX","O-DOCS"]
release: "MVP"
milestone: "I1"
lane: "foundation"
priority: "must"
rank: 11
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
depends_on: ["WB-PBI-002","WB-PBI-003"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-09","MVP-10","MVP-11","MVP-QR-01","BQ-02"]
work_packages: ["WM-07"]
acceptance_refs: ["A08","A09","WVA-08","BQA-02"]
legacy_tasks: ["SH-004","SH-015","SH-027"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
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

# WB-PBI-013 — Import typed Markdown requirements and UI elements

## Need and requirement

As a **Author**, I need to reuse existing pages, components, interactions and journeys as connected project elements.

Workbench SHALL inspect a selected typed Markdown file or bounded folder and map its declared fields and stable references into a reviewed project change.

## Use case

**Preconditions:** The selected input is within the approved document scope and declares a supported type/version.

**Trigger:** The actor deliberately requests this use case.

1. Select one file or a bounded folder.
2. Inspect document types, identities, owned fields and references.
3. Review additions, conflicts and missing mappings.
4. Apply the accepted scope through the shared writer and preserve source provenance.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Malformed frontmatter, duplicate IDs and unsafe embedded content block affected intake.
- Partial import must be explicitly selected; a failed batch cannot be called fully imported.

## Acceptance criteria

### WB-PBI-013-AC01

Given each supported UI document type, when intake is reviewed, then its stable ID, authored fields and references map into the shared model rather than a copied parallel database.

### WB-PBI-013-AC02

Given unrelated frontmatter and handwritten prose, when the import is applied, then these bytes are preserved outside explicitly owned fields.

### WB-PBI-013-AC03

Given malformed, duplicate, future-version or missing-reference input, when inspection runs, then diagnostics identify the document/field and no accepted project replacement occurs.

### WB-PBI-013-AC04

Given interaction-to-fixture references and an identical reimport, when intake runs, then references survive and the second accepted import produces no semantic change.

## Fixtures, quality and scope

**Required test data:** Typed page/component/interaction/journey documents, linked fixtures and invalid/future versions. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Markdown/HTML/scripts are never executed. Reuse existing PRD context and explicit ownership semantics.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-002](WB-PBI-002.md), [WB-PBI-003](WB-PBI-003.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
