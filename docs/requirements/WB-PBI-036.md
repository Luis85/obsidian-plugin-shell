---
type: PBI
schema_version: 1
id: "WB-PBI-036"
title: "Connect the generated UI to a C# reference service"
product: "Workbench"
epic: "WB-E05"
feature: "WB-F19"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I3"
lane: "foundation"
priority: "must"
rank: 35
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
depends_on: ["WB-PBI-026","WB-PBI-034","WB-PBI-035"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-QR-01","BQ-07","BQ-08"]
work_packages: ["WM-11","WM-16"]
acceptance_refs: ["A17","A18","WVA-13","WVA-16","BQA-07"]
legacy_tasks: ["SH-032"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "add"
blocked_reason: null
open_questions: ["Pin the supported .NET SDK and reference-service dependencies in implementation; this PBI does not select versions."]
verification_profiles: ["integration:dotnet"]
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

# WB-PBI-036 — Connect the generated UI to a C# reference service

## Need and requirement

As a **C# integrator**, I need to verify that the generated frontend can use a C# backend through configuration only.

The reference integration SHALL run the unchanged generated frontend build against a C#/ASP.NET Core service implementing the representative accepted API contract.

## Use case

**Preconditions:** The generated frontend and reviewed reference service are available; SDK/version prerequisites are pinned for the run.

**Trigger:** The actor deliberately requests this use case.

1. Follow the integration guide to start the reference service.
2. Configure the frontend API origin/base path without changing its source.
3. Exercise representative list/detail/create/edit/delete and error behavior.
4. Record frontend, service, contract and environment identities with real HTTP evidence.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- HTTP interception is disabled; mocked network success is not integration proof.
- Service validation or failure must reach the real UI error path.

## Acceptance criteria

### WB-PBI-036-AC01

Given the accepted frontend build, when configured for the C# service, then representative interactions complete over real HTTP without page/component changes.

### WB-PBI-036-AC02

Given designed validation and failure cases, when the C# service responds, then the UI observes the specified errors and no fallback mock success occurs.

### WB-PBI-036-AC03

Given wire boundary vectors, when C# responses are checked, then identifier, nullable/date/numeric and concurrency representations match the accepted contract.

### WB-PBI-036-AC04

Given independent installation instructions, when the reference is run, then exact SDK/server/contract/build identities and actual commands are retained; no maintainer-only source is required.

## Fixtures, quality and scope

**Required test data:** C# Request Board service, seeded isolated storage and explicit validation/failure responses. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Reference code belongs to the separate reference/starter pack; it is not a mandatory dependency of demo mode or a production server claim.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-026](WB-PBI-026.md), [WB-PBI-034](WB-PBI-034.md), [WB-PBI-035](WB-PBI-035.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. Pin the supported .NET SDK and reference-service dependencies in implementation; this PBI does not select versions.
