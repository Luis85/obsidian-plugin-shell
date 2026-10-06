---
type: PBI
schema_version: 1
id: "WB-PBI-009"
title: "Set up an existing Angular project vault with PRDs"
product: "Workbench"
epic: "WB-E01"
feature: "WB-F04"
outcomes: ["O-DX","O-TIME"]
release: "MVP"
milestone: "I1"
lane: "foundation"
priority: "must"
rank: 19
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
depends_on: ["WB-PBI-003","WB-PBI-013"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-03","MVP-04","MVP-24"]
work_packages: ["WM-05","WM-07"]
acceptance_refs: ["A03","A04","A18","WVA-05"]
legacy_tasks: ["SH-005","SH-027"]
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

# WB-PBI-009 — Set up an existing Angular project vault with PRDs

## Need and requirement

As a **Developer**, I need to start an Angular prototype from existing requirements without restructuring the repository.

Workbench SHALL guide setup in an explicitly selected existing Git project opened as an Obsidian vault, including reviewed PRD selection and independent prototype/first-run choices.

## Use case

**Preconditions:** Git and the project vault already exist; PRDs may be located in the configured docs/prds path.

**Trigger:** The actor deliberately requests this use case.

1. Select the existing project root and Angular webapp target.
2. Configure paths and describe the product/project.
3. Select individual PRDs, review a bounded folder scan or skip intake.
4. Review preparation and first-run choices before applying approved changes.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Invalid or duplicate PRDs are reported by document and field; partial intake requires explicit scope.
- The authoring vault is not used as a native plugin test vault.

## Acceptance criteria

### WB-PBI-009-AC01

Given an existing repository and vault, when setup completes, then Git history/remotes, notes and unrelated Obsidian security/settings files are unchanged.

### WB-PBI-009-AC02

Given valid and invalid PRDs, when selection or scanning runs, then candidates are individually identified and no unreviewed partial import occurs.

### WB-PBI-009-AC03

Given non-default paths, when Angular preparation runs, then accepted paths are used without moving the existing repository or vault.

### WB-PBI-009-AC04

Given independent prototype and first-run choices, when preparation alone is approved, then the configured prototype is prepared without install, build, server, browser or native activation.

## Fixtures, quality and scope

**Required test data:** Existing Angular project-vault with valid/invalid PRDs and preserved Git/vault snapshots. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Do not weaken new-command placement safeguards or claim that text automatically specifies missing business behavior.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-003](WB-PBI-003.md), [WB-PBI-013](WB-PBI-013.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
