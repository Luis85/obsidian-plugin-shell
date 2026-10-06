---
type: PBI
schema_version: 1
id: "WB-PBI-004"
title: "Migrate legacy settings without losing data"
product: "Workbench"
epic: "WB-E01"
feature: "WB-F02"
outcomes: ["O-DX","O-TIME"]
release: "MVP"
milestone: "I1"
lane: "foundation"
priority: "must"
rank: 8
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
depends_on: ["WB-PBI-003"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-03","MVP-04","MVP-10"]
work_packages: ["WM-03"]
acceptance_refs: ["A03","A04","WVA-02"]
legacy_tasks: ["SH-005","SH-012"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "extend"
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

# WB-PBI-004 — Migrate legacy settings without losing data

## Need and requirement

As a **Developer**, I need to adopt the new settings file while keeping existing projects recoverable.

Workbench SHALL offer a field-mapped migration from shell.config.json to the new user settings authority and refuse conflicting or unsupported values until explicitly resolved.

## Use case

**Preconditions:** Legacy settings, new settings or both may exist; their current bytes are readable.

**Trigger:** The actor deliberately requests this use case.

1. Inspect existing configuration files and versions.
2. Review mapped fields, retained identity and conflicts.
3. Approve a plan bound to the inspected bytes.
4. Apply the migration and retain its original-data recovery information.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Corrupt or future data is preserved rather than replaced with defaults.
- A changed input invalidates approval; partial write failure reports the actual recovery result.

## Acceptance criteria

### WB-PBI-004-AC01

Given legacy-only settings, when migration is applied, then effective path behavior is preserved and recoverable original values remain available.

### WB-PBI-004-AC02

Given both files with different values, when migration is inspected, then field-level conflicts prevent unreviewed replacement.

### WB-PBI-004-AC03

Given unsupported input or cancellation, when the operation ends, then no configuration is silently defaulted, moved or deleted.

### WB-PBI-004-AC04

Given an input modified after review or an injected write failure, when apply runs, then stale writes are refused or precise partial recovery is reported without a false success.

## Fixtures, quality and scope

**Required test data:** Legacy-only, new-only, agreeing, conflicting, corrupt and future-version settings. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Do not keep two independent configuration writers or migrate vault contents as a side effect.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-003](WB-PBI-003.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
