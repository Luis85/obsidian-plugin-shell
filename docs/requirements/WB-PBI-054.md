---
type: PBI
schema_version: 1
id: "WB-PBI-054"
title: "Install built plugin assets into an isolated test vault"
product: "Workbench"
epic: "WB-E01"
feature: "WB-F05"
outcomes: ["O-DX","O-TIME","O-QUALITY"]
release: "MVP"
milestone: "I2"
lane: "foundation"
priority: "must"
rank: 39
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
depends_on: ["WB-PBI-003","WB-PBI-027"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-04","MVP-23","MVP-QR-01","BQ-05"]
work_packages: ["WM-06","WM-14"]
acceptance_refs: ["A04","A17","A19","WVA-12","WVA-18","BQA-05"]
legacy_tasks: ["SH-029","SH-020"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "qualify"
blocked_reason: null
open_questions: []
verification_profiles: ["filesystem:cli","native:obsidian-vue"]
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

# WB-PBI-054 — Install built plugin assets into an isolated test vault

## Need and requirement

As a **Plugin developer**, I need to test the actual plugin host without risking the authoring or personal vault.

Workbench SHALL prepare an explicitly approved isolated test vault and install only the exact matching built plugin assets while preserving data, unrelated plugins and host security settings.

## Use case

**Preconditions:** A contained isolated target and complete matching main.js, manifest and stylesheet assets are explicitly identified.

**Trigger:** The actor deliberately requests this use case.

1. Inspect the configured test-vault path and ownership marker.
2. Review plugin identity, built asset hashes and existing installation.
3. Approve the bounded asset installation.
4. Open/enable only through the separate deliberate host action and inspect the installed identity.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Personal/authoring vault targets, wrong identities or stale assets block installation.
- Installation is not permission to disable Restricted Mode or activate the plugin.

## Acceptance criteria

### WB-PBI-054-AC01

Given an approved isolated vault, when installation is reviewed, then its target and exact built plugin identity/assets are explicit.

### WB-PBI-054-AC02

Given an existing installation, when matching assets are replaced, then data.json, notes, unrelated plugins and security settings are preserved.

### WB-PBI-054-AC03

Given a personal/authoring target, mismatched manifest or incomplete assets, when installation is requested, then no unsafe replacement occurs.

### WB-PBI-054-AC04

Given successful installation, when automatic effects are checked, then the tool has not enabled the plugin, disabled Restricted Mode or launched against a personal host profile.

## Fixtures, quality and scope

**Required test data:** Isolated marker, existing plugin data, identity mismatch, stale assets and prohibited target. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Legacy .dev-vault and configured .test-vault are not silently renamed or moved.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-003](WB-PBI-003.md), [WB-PBI-027](WB-PBI-027.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
