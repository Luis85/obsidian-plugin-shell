---
type: PBI
schema_version: 1
id: "WB-PBI-010"
title: "Associate an existing GitHub repository"
product: "Workbench"
epic: "WB-E01"
feature: "WB-F04"
outcomes: ["O-DX","O-TIME"]
release: "MVP"
milestone: "I1"
lane: "foundation"
priority: "must"
rank: 30
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
depends_on: ["WB-PBI-007"]
gate_prerequisites: []
contributes_to: ["SH-022"]
requirements: ["MVP-03","MVP-24"]
work_packages: ["WM-05"]
acceptance_refs: ["A03","A18","WVA-05"]
legacy_tasks: ["SH-027"]
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md"]
baseline_commit: "22821c4d8b2764e014dc12569b470af9e05d86b0"
work_kind: "extend"
blocked_reason: null
open_questions: []
verification_profiles: ["cli:shared","filesystem:cli"]
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

# WB-PBI-010 — Associate an existing GitHub repository

## Need and requirement

As a **Developer**, I need to associate a project with an existing remote while retaining a complete local-only workflow.

Workbench SHALL offer optional association with an existing GitHub repository through a reviewed local Git configuration change that preserves unrelated remotes and excludes credentials.

## Use case

**Preconditions:** A configured project is available; Git is required only for a requested Git operation.

**Trigger:** The actor deliberately requests this use case.

1. Choose skip or associate an existing repository.
2. Inspect current repository and remote configuration.
3. Review the requested initialization or remote change.
4. Apply only the approved local change and report its result.

**Success guarantee:** The observable results in the acceptance criteria hold for the selected scope.

**Minimum guarantee:** Rejected or cancelled operations preserve accepted content; an interrupted operation reports its exact effects and recovery boundary, never an invented success.

## Alternatives and exceptions

- Missing Git or credentials do not disable local UI generation.
- Existing conflicting remote names require explicit resolution; association never creates a remote repository or pushes.

## Acceptance criteria

### WB-PBI-010-AC01

Given skipped association, when setup continues, then local generation, demo and documentation remain available.

### WB-PBI-010-AC02

Given existing remotes, when a new association is reviewed, then unrelated remotes and Git history are preserved.

### WB-PBI-010-AC03

Given a changed or conflicting local Git configuration, when apply is attempted, then stale or ambiguous changes are refused before replacement.

### WB-PBI-010-AC04

Given repository association, when portable project data is exported, then no token is stored and no implicit commit, push, repository creation or release occurs.

## Fixtures, quality and scope

**Required test data:** Local-only project, existing remotes, conflicting origin and missing Git. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** This is a local association use case, not repository provisioning, authentication storage or publication.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md). Requirement, work-package, existing task and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

Acceptance prerequisites: [WB-PBI-007](WB-PBI-007.md).

**Review:** Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. No additional product ambiguity is recorded here; technical refinement and feasibility review are still required.
