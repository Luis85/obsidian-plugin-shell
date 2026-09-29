---
type: PBI
schema_version: 1
id: "WB-PBI-038"
title: "Serve the web UI within an existing application"
product: "Workbench"
epic: "WB-E05"
feature: "WB-F20"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I3"
lane: "foundation"
priority: "must"
rank: 41
status: "new"
revision: 1
created: "2026-09-29"
updated: "2026-09-29"
status_since: "2026-09-29"
owner: null
owner_role: "Integration and QA"
review_status: "pending"
review_record: null
estimate_points: null
value_score: null
risk: null
depends_on: ["WB-PBI-036","WB-PBI-037"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-03","MVP-24","MVP-QR-01","BQ-08","BQ-09"]
work_packages: ["WM-11","WM-13"]
acceptance_refs: ["A03","A17","A18","WVA-13","WVA-16","BQA-09"]
legacy_tasks: ["SH-032"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "add"
blocked_reason: null
open_questions: []
verification_profiles: ["integration:dotnet","integration:java"]
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

# WB-PBI-038 — Serve the web UI within an existing application

## Need and requirement

As a **Application integrator**, I need to deploy the generated frontend separately or inside a C# or Java application.

Workbench SHALL provide a tested hosting guide and configuration boundary for API/UI base paths, static assets, deep-link refresh and applicable authentication/origin handling without UI rewrites.

## Use case

**Preconditions:** The representative contract and generated web build are available in an isolated integration environment.

**Trigger:** The actor deliberately requests this use case.

1. Select separate hosting or same-origin application hosting.
2. Configure API origin and a non-root UI base path.
3. Follow build-output copy/deployment and routing instructions.
4. Open deep links, refresh and exercise authenticated/error flows where designed.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Unknown base paths and route fallback errors are reported rather than hiding API failures as HTML.
- Guidance must not disable browser security or embed credentials.

## Acceptance criteria

### WB-PBI-038-AC01

Given separate UI/API hosting, when the documented origin/proxy configuration is used, then representative requests work with the declared security boundary.

### WB-PBI-038-AC02

Given same-origin hosting at a non-root UI path, when a deep link is refreshed, then routing and assets load correctly without changing page/component code.

### WB-PBI-038-AC03

Given an API error or authentication failure, when routing and error mapping apply, then the correct service result reaches the UI instead of a misleading app-shell success.

### WB-PBI-038-AC04

Given either backend reference, when the guide is followed from generated artifacts, then deployment/copy steps and version prerequisites are sufficient without undocumented maintainer knowledge.

## Fixtures, quality and scope

**Required test data:** Separate hosts and non-root same-origin C#/Java deployments with deep-link and authentication failures. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Integration may require server configuration; no promise of zero-configuration compatibility with every existing application.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-036](WB-PBI-036.md), [WB-PBI-037](WB-PBI-037.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
