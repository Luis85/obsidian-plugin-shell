---
type: PBI
schema_version: 1
id: "WB-PBI-053"
title: "Upgrade a generated consumer without losing extensions"
product: "Workbench"
epic: "WB-E06"
feature: "WB-F23"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I3"
lane: "foundation"
priority: "must"
rank: 45
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
depends_on: ["WB-PBI-028"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-18","MVP-23","MVP-24"]
work_packages: ["WM-12","WM-16"]
acceptance_refs: ["A13","A17","A18","WVA-14","WVA-19"]
legacy_tasks: ["SH-030","SH-032"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "qualify"
blocked_reason: null
open_questions: []
verification_profiles: ["filesystem:cli","build:independent-consumer"]
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

# WB-PBI-053 — Upgrade a generated consumer without losing extensions

## Need and requirement

As a **Developer**, I need to adopt a compatible framework upgrade while retaining owned source and data.

Workbench SHALL plan an explicit compatible kit upgrade against the current consumer ownership and preserve custom source, configuration and data unless a separately reviewed migration is accepted.

## Use case

**Preconditions:** The current consumer and replacement kit identities are available and verified.

**Trigger:** The actor deliberately requests this use case.

1. Inspect replacement compatibility and change inventory.
2. Compare current managed/owned files and contracts.
3. Review updates, conflicts and migration prerequisites.
4. Apply the accepted upgrade, rebuild and retain rollback/recovery information.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Modified kits, incompatible contracts and edited managed files block unsafe replacement.
- A consumer cannot claim framework packaging authority after upgrade.

## Acceptance criteria

### WB-PBI-053-AC01

Given compatible unchanged managed files, when upgrade is reviewed, then only declared kit-managed changes are proposed with exact before/after identities.

### WB-PBI-053-AC02

Given custom adapters, fixture overrides, notes and configuration, when upgrade applies, then owned content remains unchanged unless explicitly included in a reviewed migration.

### WB-PBI-053-AC03

Given incompatible input, stale approval or injected failure, when upgrade runs, then it blocks or reports precise recovery instead of silently overwriting content.

### WB-PBI-053-AC04

Given an upgraded independent consumer, when its checks and packaging identity are inspected, then documented build/test behavior works and it cannot repack itself as the framework.

## Fixtures, quality and scope

**Required test data:** Compatible/mismatched kits, edited consumer, custom adapters and partial-upgrade failure. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** No automatic dependency upgrades, source rebases or approval inheritance from prior releases.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-028](WB-PBI-028.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
