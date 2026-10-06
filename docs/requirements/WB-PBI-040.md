---
type: PBI
schema_version: 1
id: "WB-PBI-040"
title: "Operate generated workflows accessibly"
product: "Workbench"
epic: "WB-E06"
feature: "WB-F21"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I3"
lane: "foundation"
priority: "must"
rank: 37
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
depends_on: ["WB-PBI-026","WB-PBI-027","WB-PBI-031"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-05","MVP-16","MVP-23","MVP-QR-01","BQ-09"]
work_packages: ["WM-15"]
acceptance_refs: ["A05","A11","A19","A20","WVA-18"]
legacy_tasks: ["SH-020"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "qualify"
blocked_reason: null
open_questions: []
verification_profiles: ["manual-accessibility:angular-webapp","manual-accessibility:obsidian-vue"]
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

# WB-PBI-040 — Operate generated workflows accessibly

## Need and requirement

As a **Application user**, I need to complete the generated workflows with keyboard and assistive technology across supported host presentations.

The generated UI SHALL provide operable keyboard/non-drag paths, visible focus, meaningful names and announced status/errors for the accepted workflows, with verified host/theme and reflow behavior.

## Use case

**Preconditions:** The generated artifacts and supported environment/accessibility protocol are identified.

**Trigger:** The actor deliberately requests this use case.

1. Open a representative workflow in its actual target.
2. Complete navigation, form and dialog tasks using keyboard/non-drag alternatives.
3. Inspect announced errors/status and focus recovery.
4. Repeat relevant tasks under narrow layouts, themes, zoom and supported language expansion.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- An inaccessible mandatory action blocks acceptance even when an automated scan passes.
- Unsupported devices or untested assistive configurations remain disclosed rather than inferred from viewport screenshots.

## Acceptance criteria

### WB-PBI-040-AC01

Given a critical workflow, when it is operated without pointer dragging, then all required outcomes remain reachable with visible logical focus.

### WB-PBI-040-AC02

Given validation errors and dialogs, when they appear and close, then meaningful announcements, focus containment and return focus follow the declared interaction.

### WB-PBI-040-AC03

Given narrow layout, zoom/reflow and light/dark host themes, when tasks run, then required controls/content remain available and unrelated host styles are not changed.

### WB-PBI-040-AC04

Given accessibility evidence, when the target is accepted, then manual assistive-tech results and automated checks identify their exact scope with no unresolved critical task blocker.

## Fixtures, quality and scope

**Required test data:** Form/dialog/error workflows, keyboard alternatives, long localized text and narrow native leaves. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** No accessibility certification or native mobile support is inferred from screenshots or automated scans.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-026](WB-PBI-026.md), [WB-PBI-027](WB-PBI-027.md), [WB-PBI-031](WB-PBI-031.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
