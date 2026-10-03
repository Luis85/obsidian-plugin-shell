---
type: PBI
schema_version: 1
id: "WB-PBI-055"
title: "Pin every dependency exactly before publishing any version"
product: "Workbench"
epic: "WB-E06"
feature: "WB-F24"
outcomes: ["O-DX","O-QUALITY"]
release: "MVP"
milestone: "I3"
lane: "foundation"
priority: "must"
rank: 55
status: "new"
revision: 1
created: "2026-09-30"
updated: "2026-09-30"
status_since: "2026-09-30"
owner: null
owner_role: "Quality and release"
review_status: "pending"
review_record: null
estimate_points: null
value_score: null
risk: null
depends_on: []
gate_prerequisites: []
contributes_to: ["SH-022","SH-034"]
requirements: ["MVP-21","MVP-23"]
work_packages: ["WM-19"]
acceptance_refs: ["A15","WVA-19"]
legacy_tasks: []
source_docs: ["../product/MVP-IMPROVEMENT-PLAN.md","../prds/MVP-JSON-TO-CLICKDUMMY.md","changes/CR-2026-09-30-01.md"]
baseline_commit: "6a44d0492db230b269ea4d27094e222dd5a2de8a"
work_kind: "extend"
blocked_reason: null
open_questions: ["Should WB-PBI-045 (publish) declare this PBI as an acceptance prerequisite in its next revision?","Do peerDependencies of a published starter or plugin also require exact versions, or only recorded reviewed ranges?","Should the same rule cover workflow action references and toolchain versions, or stay limited to npm dependency manifests and lockfiles?"]
verification_profiles: ["cli:shared","release:local"]
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

# WB-PBI-055 — Pin every dependency exactly before publishing any version

## Need and requirement

As a **Release maintainer**, I need every published version to install the dependency set it was tested with, so a later registry release cannot change what users receive.

Workbench SHALL refuse to publish any framework, starter or generated-consumer version unless every npm dependency declaration in the published package manifests is an exact version and the lockfile resolves each one to that same version.

## Use case

**Preconditions:** A release candidate and its product profile (framework, starter pack or generated consumer) are explicitly selected.

**Trigger:** The actor prepares, rehearses or publishes a version.

1. Enumerate every published `package.json` for the candidate, including optional workspaces.
2. Check `dependencies`, `devDependencies`, `optionalDependencies` and `overrides` for exact `MAJOR.MINOR.PATCH` versions.
3. Check that the lockfile exists, matches the manifests and resolves each direct dependency to its declared version.
4. Record the checked manifests and lockfile hashes, or block the candidate with a diagnostic per violation.

**Success guarantee:** Only candidates with exact, lockfile-consistent dependency declarations are eligible for publication.

**Minimum guarantee:** The check is read-only and works offline. It never rewrites a range, regenerates a lockfile or publishes as a side effect.

## Alternatives and exceptions

- A range (`^`, `~`, `*`, `x`, `>=`), dist-tag (`latest`, `next`), or a Git/URL/file specifier without an immutable commit or integrity blocks eligibility.
- A missing, stale or inconsistent lockfile blocks eligibility rather than being regenerated.
- A generated consumer and a starter pack are checked against their own manifests; passing the framework check does not qualify them.

## Acceptance criteria

### WB-PBI-055-AC01

Given a candidate whose published manifests declare only exact versions and whose lockfile resolves each direct dependency to that version, when release eligibility is checked, then the pin check passes and records every checked manifest and the lockfile hash.

### WB-PBI-055-AC02

Given a manifest with any range, dist-tag or mutable Git/URL/file specifier in `dependencies`, `devDependencies`, `optionalDependencies` or `overrides`, when eligibility is checked, then the candidate is blocked with a diagnostic naming the manifest, package and specifier, and no publication step runs.

### WB-PBI-055-AC03

Given a missing lockfile, or a lockfile whose root declaration or resolved version differs from an exact pin, when eligibility is checked, then the candidate is blocked, and no file is rewritten.

### WB-PBI-055-AC04

Given a project generated from any starter, when its version is prepared for publication, then the same check applies to its generated manifests and lockfile, runs without network access, and publication tooling cannot bypass it.

## Fixtures, quality and scope

**Required test data:** An exact-pinned candidate; one fixture per rejected specifier kind; missing, stale and mismatched lockfiles; an optional workspace with a range; and a generated consumer from a starter. Fixtures and tests are delivery obligations, not artifacts already produced by this PBI.

**Boundary:** Extend the existing `scripts/security/check-dependencies.mjs` exact-version check and existing release preparation rather than adding a parallel gate. That check covers only root `dependencies`/`devDependencies` and needs installed modules. Do not update, dedupe or re-resolve dependencies as part of this PBI. The known nested ESLint 9 exception in `docs/development/ITERATION-TWO-DEPENDENCY-EXCEPTION.md` remains a separate unresolved criterion.

The [shared readiness and completion rules](GOVERNANCE.md) apply. Required evidence profiles are declared in frontmatter; refinement must approve the criterion/profile verification plan. No declaration or unchecked scenario is execution evidence.

## Traceability and review

Sources: [MVP-IMPROVEMENT-PLAN](../product/MVP-IMPROVEMENT-PLAN.md), [MVP-JSON-TO-CLICKDUMMY](../prds/MVP-JSON-TO-CLICKDUMMY.md), [change record CR-2026-09-30-01](changes/CR-2026-09-30-01.md). Requirement, work-package and acceptance IDs are in frontmatter; see the [crosswalk](TRACEABILITY.md).

No PBI acceptance prerequisite; inspect existing implementation before planning replacement work.

**Review:** Requested by the product owner on 2026-09-30. Product/UX/engineering validation, accountable owner, estimate and current implementation reconciliation remain pending. The open questions in frontmatter need decisions before refinement.
