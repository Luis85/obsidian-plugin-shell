---
type: PBI
schema_version: 1
id: "WB-PBI-037"
title: "Connect the same UI build to a Java reference service"
product: "Workbench"
epic: "WB-E05"
feature: "WB-F19"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I3"
lane: "foundation"
priority: "must"
rank: 36
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
acceptance_refs: ["A17","A18","WVA-13","WVA-16","BQA-08"]
legacy_tasks: ["SH-032"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","../product/MVP-BOILERPLATE-QUALITY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "add"
blocked_reason: null
open_questions: ["Pin supported JDK, build tool and reference-service dependencies during implementation."]
verification_profiles: ["integration:java"]
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

# WB-PBI-037 — Connect the same UI build to a Java reference service

## Need and requirement

As a **Java integrator**, I need to verify backend portability without rebuilding the generated frontend for Java.

The reference integration SHALL run the same generated frontend build against a Java/Spring Boot service implementing the representative accepted API contract.

## Use case

**Preconditions:** The accepted frontend build and reviewed Java reference are available; JDK/build-tool versions are recorded.

**Trigger:** The actor deliberately requests this use case.

1. Follow the reference instructions to start the Java service.
2. Change approved runtime configuration without rebuilding the frontend.
3. Exercise representative operations and validation/failure paths over actual HTTP.
4. Retain build equality and independent Java integration evidence.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Intercepted HTTP responses cannot pass the service integration test.
- Mapping errors remain visible rather than silently coercing incompatible values.

## Acceptance criteria

### WB-PBI-037-AC01

Given the build used for the C# reference, when configured for Java, then its frontend bytes/hash remain identical and no UI source change or backend-specific rebuild occurs.

### WB-PBI-037-AC02

Given real Java service responses, when representative list/detail/create/edit/delete runs, then the accepted wire and state semantics are observed with interception disabled.

### WB-PBI-037-AC03

Given invalid input or server failure, when Java returns its result, then the declared UI recovery appears without mock fallback.

### WB-PBI-037-AC04

Given serialization vectors and an independent environment, when integration is verified, then JDK/build-tool/service/contract identities and passing boundary results are recorded separately.

## Fixtures, quality and scope

**Required test data:** Java Request Board service, same frontend artifact and boundary/error responses. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Java is a backend integration example, not a JavaFX/native UI target or automatic production business implementation.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [MVP-BOILERPLATE-QUALITY](../product/MVP-BOILERPLATE-QUALITY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-026](WB-PBI-026.md), [WB-PBI-034](WB-PBI-034.md), [WB-PBI-035](WB-PBI-035.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. Pin supported JDK, build tool and reference-service dependencies during implementation.
