---
type: PBI
schema_version: 1
id: "WB-PBI-005"
title: "Install and inspect a separate starter pack"
product: "Workbench"
epic: "WB-E01"
feature: "WB-F03"
outcomes: ["O-DX","O-TIME"]
release: "MVP"
milestone: "I1"
lane: "foundation"
priority: "must"
rank: 18
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
depends_on: ["WB-PBI-003","WB-PBI-006"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-01","MVP-02","MVP-QR-01","BQ-01","BQ-04"]
work_packages: ["WM-04","WM-16"]
acceptance_refs: ["A01","A02","WVA-03","WVA-04","BQA-01"]
legacy_tasks: ["SH-026","SH-027","CX-008"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "extend"
blocked_reason: null
open_questions: []
verification_profiles: ["filesystem:cli","contract:shared"]
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

# WB-PBI-005 — Install and inspect a separate starter pack

## Need and requirement

As a **Developer**, I need to discover compatible project starters and their fixtures without replacing the engine.

Workbench SHALL inspect and install an explicitly selected starter pack into the configured starter location, preserving the engine and exposing each compatible JSON definition.

## Use case

**Preconditions:** An engine and an optional starter archive are available; package integrity does not grant execution permission.

**Trigger:** The actor deliberately requests this use case.

1. Inspect archive provenance, inventory and engine compatibility.
2. Review files to add or change.
3. Install only safe compatible definitions and resources.
4. List starters, parameters, fixture scenarios and required operations.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Absent packs leave JSON project intake usable and explain why starter selection is empty.
- Unsafe archives, modified resources or conflicting user copies block replacement and preserve the working pack.

## Acceptance criteria

### WB-PBI-005-AC01

Given the exact engine archive, when its inventory is checked, then no starter-specific definitions or hidden fallback starters are bundled within it.

### WB-PBI-005-AC02

Given a compatible starter pack, when installation is approved, then catalog entries and fixture resources come from its external definitions with recorded versions and hashes.

### WB-PBI-005-AC03

Given no pack, when setup lists choices, then JSON intake remains available and missing starter resources are explained rather than substituted invisibly.

### WB-PBI-005-AC04

Given traversal, duplicate paths, decompression-limit failures or edited local definitions, when installation is planned, then unsafe replacement is blocked and previous files are preserved.

## Fixtures, quality and scope

**Required test data:** Compatible/incompatible packs, no-pack setup, edited copies and hostile bounded archives. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Starter resources stay separate from engine resources; reference backend examples do not become compulsory demo runtimes.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-003](WB-PBI-003.md), [WB-PBI-006](WB-PBI-006.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
