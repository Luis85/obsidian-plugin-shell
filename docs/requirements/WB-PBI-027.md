---
type: PBI
schema_version: 1
id: "WB-PBI-027"
title: "Generate an operational Obsidian plugin"
product: "Workbench"
epic: "WB-E04"
feature: "WB-F14"
outcomes: ["O-DX","O-TIME","O-QUALITY"]
release: "MVP"
milestone: "I2"
lane: "foundation"
priority: "must"
rank: 27
status: "new"
revision: 1
created: "2026-09-29"
updated: "2026-09-29"
status_since: "2026-09-29"
owner: null
owner_role: "Compiler and QA"
review_status: "pending"
review_record: null
estimate_points: null
value_score: null
risk: null
depends_on: ["WB-PBI-002","WB-PBI-024","WB-PBI-029","WB-PBI-030"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-13","MVP-14","MVP-15","MVP-QR-01","BQ-01","BQ-02","BQ-05"]
work_packages: ["WM-11"]
acceptance_refs: ["A10","A11","A17","A19","WVA-12","BQA-01","BQA-02"]
legacy_tasks: ["SH-017","SH-028","SH-019"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "extend"
blocked_reason: null
open_questions: []
verification_profiles: ["contract:shared","build:obsidian-vue","native:obsidian-vue"]
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

# WB-PBI-027 — Generate an operational Obsidian plugin

## Need and requirement

As a **Plugin developer**, I need to run the designed plugin with seeded interactions while retaining native lifecycle boundaries.

Workbench SHALL generate an independently buildable plugin composition whose selected views, settings, commands and UI interactions have operational demo adapters and explicit native integration boundaries.

## Use case

**Preconditions:** The plugin design and host capabilities are valid; real native testing uses an approved isolated vault.

**Trigger:** The actor deliberately requests this use case.

1. Select the supported plugin/frontend profile.
2. Review native registrations, fixture coverage and output ownership.
3. Generate and build the independent plugin.
4. Exercise demo behavior and separately verify declared real host behavior in isolation.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- No required plugin action is represented only by a handler signature or TODO.
- Simulation cannot count as actual native persistence acceptance.

## Acceptance criteria

### WB-PBI-027-AC01

Given the Vue/Nuxt UI Quick Capture design, when generated source builds, then complete matching native assets and selected views/commands/settings are emitted without manual patches.

### WB-PBI-027-AC02

Given demo mode, when designed controls are used, then fixture-backed interactions work without personal-vault or production-service effects.

### WB-PBI-027-AC03

Given the isolated host, when real native workflows run, then lifecycle, scoped styles, command registration and owned disposal respect the host contract.

### WB-PBI-027-AC04

Given missing capabilities or fixture handlers, when output readiness is inspected, then the plugin is not reported fully operational and the affected interaction is identified.

## Fixtures, quality and scope

**Required test data:** Quick Capture plugin with demo state, separate note-backed workflow and repeated leaf lifecycle. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** A browser preview is not native acceptance; actual Workbench self-hosting is a separate full-product obligation.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-002](WB-PBI-002.md), [WB-PBI-024](WB-PBI-024.md), [WB-PBI-029](WB-PBI-029.md), [WB-PBI-030](WB-PBI-030.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
