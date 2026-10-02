---
type: PBI
schema_version: 1
id: "WB-PBI-043"
title: "Qualify the exact extracted-kit user journey"
product: "Workbench"
epic: "WB-E06"
feature: "WB-F23"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I3"
lane: "foundation"
priority: "must"
rank: 46
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
depends_on: ["WB-PBI-001","WB-PBI-004","WB-PBI-008","WB-PBI-009","WB-PBI-010","WB-PBI-011","WB-PBI-012","WB-PBI-014","WB-PBI-016","WB-PBI-017","WB-PBI-028","WB-PBI-032","WB-PBI-033","WB-PBI-036","WB-PBI-037","WB-PBI-038","WB-PBI-039","WB-PBI-040","WB-PBI-041","WB-PBI-042","WB-PBI-051","WB-PBI-053","WB-PBI-054"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-01","MVP-02","MVP-03","MVP-04","MVP-23","MVP-24","MVP-QR-01","BQ-10"]
work_packages: ["WM-16"]
acceptance_refs: ["A01","A02","A03","A04","A17","A18","WVA-19","BQA-01","BQA-07","BQA-08"]
legacy_tasks: ["SH-019","SH-032","SH-033"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "qualify"
blocked_reason: null
open_questions: []
verification_profiles: ["archive:windows","archive:macos","archive:linux"]
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

# WB-PBI-043 — Qualify the exact extracted-kit user journey

## Need and requirement

As a **Release QA reviewer**, I need to verify the downloadable artifacts rather than relying on a maintainer checkout.

The exact engine and separate starter/reference archives SHALL pass the applicable clean-entry, demonstration, integration, maintenance and recovery protocols on the documented desktop environments.

## Use case

**Preconditions:** Candidate archives, input designs and their hashes are retained; no publication is required for local archive qualification.

**Trigger:** The actor deliberately requests this use case.

1. Extract the engine and separate pack without maintainer dependencies.
2. Run fresh, JSON and existing-project setup with non-default paths.
3. Exercise demo, both reference integrations and second-change/recovery behavior.
4. Retain platform-specific artifact/evidence records and unresolved requirements.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Wrong tools, modified kits and foreign conflicts must fail safely.
- Missing platform or native modes remain blocking for claims requiring them.

## Acceptance criteria

### WB-PBI-043-AC01

Given clean Windows, macOS and Linux environments, when help/setup is launched from the exact archive, then documented prerequisites suffice without a checkout, global CLI or preexisting node_modules.

### WB-PBI-043-AC02

Given engine and separate pack inventories, when first use runs, then starter definitions are not hidden in the engine and JSON-only intake remains usable.

### WB-PBI-043-AC03

Given independent generated projects, when demo, real backend and regeneration protocols run, then artifacts require no manual generated-source repair and preserve owned changes.

### WB-PBI-043-AC04

Given mismatched hashes or missing applicable evidence, when readiness is assessed, then the framework gate cannot pass based on task counts or a green checkout build.

## Fixtures, quality and scope

**Required test data:** Exact archive matrix, fresh/default/custom roots, damaged kit, cancelled setup and both backend references. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Does not publish or complete native Workbench; SH-022 retains all transitive legacy obligations.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-001](WB-PBI-001.md), [WB-PBI-004](WB-PBI-004.md), [WB-PBI-008](WB-PBI-008.md), [WB-PBI-009](WB-PBI-009.md), [WB-PBI-010](WB-PBI-010.md), [WB-PBI-011](WB-PBI-011.md), [WB-PBI-012](WB-PBI-012.md), [WB-PBI-014](WB-PBI-014.md), [WB-PBI-016](WB-PBI-016.md), [WB-PBI-017](WB-PBI-017.md), [WB-PBI-028](WB-PBI-028.md), [WB-PBI-032](WB-PBI-032.md), [WB-PBI-033](WB-PBI-033.md), [WB-PBI-036](WB-PBI-036.md), [WB-PBI-037](WB-PBI-037.md), [WB-PBI-038](WB-PBI-038.md), [WB-PBI-039](WB-PBI-039.md), [WB-PBI-040](WB-PBI-040.md), [WB-PBI-041](WB-PBI-041.md), [WB-PBI-042](WB-PBI-042.md), [WB-PBI-051](WB-PBI-051.md), [WB-PBI-053](WB-PBI-053.md), [WB-PBI-054](WB-PBI-054.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
