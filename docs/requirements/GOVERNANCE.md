# PBI governance and progress contract

**Profile:** Workbench PBI v1. **Date:** 2026-09-29. **Status:** Tailored requirements-management convention; individual PBIs still require stakeholder validation and technical refinement.

## 1. IREB alignment and limits

This profile applies IREB/CPRE practices for structured specification, requirements quality, validation, attributes, traceability, baselines and change management. It is a project-specific Markdown convention, not an official IREB PBI schema or a certification of the backlog. Adequacy, necessity and feasibility require stakeholder review; a schema checker cannot establish them.

The tailoring is based on the official syllabi below. IREB e.V. and the named syllabus authors retain the rights to their publications. This repository contains original Workbench requirements and paraphrased application guidance, not copied syllabus templates.

| Reference | Practices applied here |
| --- | --- |
| [CPRE Foundation v3.3.0](https://hub.ireb.org/media/pages/resources/cpre-foundation-level-syllabus/9c084b1cfd-1787039954/cpre_foundationlevel_syllabus_en_v.3.3.0.pdf), sections 3.3, 3.8, 4.4, 6.2–6.8 | Structured work products, quality criteria, validation, lifecycle, versions, attributes, traceability, priorities and controlled changes. |
| [Requirements Management v2.1](https://hub.ireb.org/media/pages/resources/cpre-requirements-management-syllabus/8abc61b36e-1787039973/syllabus-requirements-management-en-v2.1.pdf), sections 3.1–3.7 | Tailored typed attributes and useful management views rather than collecting metadata without a purpose. |
| [RE@Agile v2.3](https://hub.ireb.org/media/pages/resources/cpre-re-agile-syllabus/d287ba502e-1787039983/syllabus_cpre_al_re@agile_en_2.3.pdf), sections 4.1–4.4 | Concrete acceptance behavior, explicit quality requirements and linked backlog refinement. |

Sources consulted on 2026-09-29 via the [official download center](https://cpre.ireb.org/en/downloads-and-resources/downloads). This alignment describes the method, not a completed independent conformity audit.

## 2. Structure and authority

**Product → Epic (job/problem) → Feature (solution capability) → PBI (observable use case) → implementation tasks.** The authoritative hierarchy, source-ID catalogs and fixed initial scope are in [backlog.json](backlog.json). PBIs are directly under this directory as `WB-PBI-NNN.md`; each starts with `type: PBI`. Templates, indexes, schemas and evidence are not backlog items and are excluded from metrics.

A PBI states the actor's need, a normative SHALL requirement, preconditions, trigger, success flow, alternatives, guarantees, acceptance criteria, fixture obligations and scope boundaries. Four initial criteria per item are a drafting choice, not a permanent limit or proof that refinement is complete. Add criteria when needed; never omit a required behavior to preserve the number four. An AC ID remains stable through edits and must not be reused for unrelated meaning.

The [product vision](../product/PRODUCT-VISION.md), [MVP plan](../product/MVP-IMPROVEMENT-PLAN.md), [quality amendment](../product/MVP-BOILERPLATE-QUALITY.md) and retained parent requirements remain authoritative. This backlog decomposes them. Existing SH/CX/CP/PUB task frontmatter still owns task execution status; a PBI records requirements maturity and acceptance of its use case. A linked task being done does not automatically accept the PBI, and this backlog does not rewrite task states.

Source presence is not acceptance evidence. Reconcile current implementation first; extend or qualify it rather than rebuilding capabilities described as missing in older documents. `baseline_commit` identifies the requirements source snapshot, not the future implementation candidate.

## 3. Frontmatter contract

[The JSON Schema](schema/pbi.schema.json) validates the parsed frontmatter. This local tooling profile uses a flat YAML mapping with quoted strings/dates, JSON-compatible flow values and scalar block lists. Arrays such as `depends_on` may also use two-space-indented `- value` entries. Nested YAML mappings, tags, anchors and multiline scalars are deliberately rejected by the dependency-free reader; use a JSON flow array for `verification_plan`. General YAML support is not claimed.

| Fields | Meaning and maintenance rule |
| --- | --- |
| `type`, `schema_version`, `id`, `title` | Stable typed identity; `type` is exactly `PBI`. A changed title does not change the ID. |
| `product`, `epic`, `feature`, `outcomes`, `release` | Product hierarchy and intended value. Outcome links express contribution, not measured value already obtained. |
| `milestone`, `lane`, `priority`, `rank` | Proposed delivery increment/lane, scope criticality and suggested dependency order. Rank is not a business-value score or sprint commitment. |
| `status`, `revision`, `status_since` | Requirements/use-case lifecycle and specification revision. Update the date on a real transition; do not backfill invented history. |
| `created`, `updated` | ISO dates for actual document creation/change. Git records author and historical revisions. |
| `owner`, `owner_role` | Assigned accountable person, initially null; role is an unassigned responsibility description. |
| `review_status`, `review_record` | Product/UX/engineering validation decision and a revision-bound review record. Initially pending/null. |
| `estimate_points`, `value_score`, `risk` | Team estimate; optional product value score on a defined 0–5 rubric; qualitative risk. Initially null, not zero. Scores/estimates require a recorded rationale before use in decisions. |
| `depends_on`, `gate_prerequisites`, `contributes_to` | PBI acceptance prerequisites, external gate prerequisites and gate coverage links. These are different relationships. Dependencies form an acyclic graph. |
| `requirements`, `work_packages`, `acceptance_refs`, `legacy_tasks`, `source_docs` | Trace to MVP/BQ requirements, WM packages, A/WVA/BQA protocols, existing tasks and readable sources. Mappings supplement rather than replace original assertions. |
| `baseline_commit`, `work_kind` | Inspected source baseline and intended work classification: add, extend, implement or qualify. No inferred implementation percentage. |
| `blocked_reason`, `open_questions` | Actual current blocker and unresolved decisions. A predecessor not yet accepted is reported separately from an explicitly declared blocker. |
| `verification_profiles`, `verification_plan` | Minimum evidence modes and the refined criterion/profile matrix. The initial matrix is null; a reviewer must decide applicable cases rather than inventing evidence. |
| `evidence_refs`, `verification_candidate` | Local evidence receipt paths and exact implementation commit. Missing candidate or missing evidence means unverified. |
| `accepted_by`, `accepted_on`, `acceptance_record` | Actual acceptance decision, date and revision/candidate-bound record. This is not populated when requirements are merely written. |
| `started_on`, `done_on`, `shipped_on`, `release_ref` | Actual flow/delivery facts. Shipped needs the recorded release, not a planned version name. |

No manual `percent_complete` field is used. Do not infer 50% completion from “in progress,” invent estimates, assign people without agreement or treat generated TODOs as passed tests.

## 4. Lifecycle and refinement

`new → designed → scoped → tech refined → estimated → ready → in progress → implemented → tested → done → shipped`

`deferred` means postponed without silently removing original scope. `sunset` records retirement; historical acceptance remains in Git and is not rewritten. Return an affected item to the appropriate earlier state when its specification, dependencies or evidence changes. State transitions express actual work, not automatic advancement caused by running the report.

| Transition | Required meaning |
| --- | --- |
| new → designed | Need, actor, proposed use case and alternatives have been discussed. |
| designed → scoped | Included/excluded behavior and relationship to parent requirements are agreed. |
| scoped → tech refined | Feasibility, contracts, data, constraints, failure modes and verification mapping are reviewed. |
| tech refined → estimated | Team supplies an estimate based on the refined scope; never equate an unknown estimate with zero. |
| estimated → ready | Three Amigos validation, accountable owner, no unresolved blocking question and a complete verification plan; shared DoR below. |
| ready → in progress | Implementation or qualification actually starts; record `started_on`. |
| in progress → implemented | Agreed source work is present, but required evidence/acceptance may still be missing. |
| implemented → tested | Every planned criterion/profile pair has current passing evidence; a generated test file is insufficient. |
| tested → done | Product acceptance and shared DoD are met for the same specification and candidate; record acceptance and `done_on`. |
| done → shipped | Accepted output was actually delivered through the applicable authorized process; record date/reference. |

Some items remain larger than a single iteration until technical refinement. Split by independently useful behavior before planning a sprint. Preserve lineage and baseline accounting: never leave the parent and children earning duplicate scope credit, or delete the parent to inflate progress. Baseline changes require an explicit reviewed change record and a new scope version.

## 5. Quality review, DoR and DoD

**Requirement review:** check need/source, scope necessity, singular use-case intent, understandable terms, unambiguous conditions, complete main/alternative outcomes and verifiability. Review the set for contradictions, duplicate authority, missing interfaces, unresolved references and coverage gaps. Requirements must be feasible under the selected target constraints; actual feasibility is not inferred from this initial draft.

**Definition of Ready:** product/UX/engineering agree the use case; scope and dependencies are understood; solution constraints are distinguished from implementation suggestions; fixtures, ports, failure behavior, data ownership and target profiles are explicit; all ACs have a reviewed verification-plan entry; estimates and ownership are agreed; blocking questions are resolved. A named external prerequisite is not permission to bypass the delivery strategy.

**Definition of Done:** implement or reconcile the agreed scope; run actual applicable positive/negative/regression cases; preserve inherited security, architecture, accessibility, performance and code-quality gates; update docs and traceability; attach exact-candidate evidence; demonstrate no loss of authored code/data; obtain acceptance for the current revision. Applicable native/backend/platform modes must run in their actual environment. Full MVP-QR-01 interaction completeness remains distinct from source coverage.

Product acceptance of a PBI does not authorize a release. SH-022/SH-034/CX-007/CP-010 and PUB sequencing remains in force. A gate contribution count is not the gate decision: inherited task criteria and approvals still need separate evidence.

## 6. Evidence and reproducible acceptance

At refinement, set `verification_plan` to an explicit array, for example:

```json
[{"criterion":"WB-PBI-001-AC01","profile":"cli:shared"},{"criterion":"WB-PBI-001-AC02","profile":"contract:shared"},{"criterion":"WB-PBI-001-AC03","profile":"cli:shared"},{"criterion":"WB-PBI-001-AC04","profile":"contract:shared"}]
```

This is an example mapping, not the approved mapping for that PBI. Every AC must have at least one applicable mode; every declared minimum profile must occur. Add all genuinely required combinations during review; the tool cannot decide that a browser test proves native behavior. A missing plan blocks readiness, not initial drafting.

Use the documented records in [evidence/README.md](evidence/README.md). Receipts must match PBI ID, revision, specification hash and candidate. Hashes identify content, not authenticity. Specification hashing includes the body and its normative/verification metadata but excludes mutable status/assignment/acceptance fields. Changing scope therefore invalidates old receipts without a circular hash dependency.

For the same candidate and plan pair, the most recent timestamped result governs; identical-time conflicting results fail. Missing, stale, failed or blocked results cannot earn verified credit. The full approved matrix must pass before acceptance. Review and PO decision records must refer to the same specification; do not copy old approvals to a new revision.

The reporter validates receipt structure and consistency, not the honesty of its author or the actual external test run. Retain logs and artifact references, review them, and use the existing trusted evidence producers wherever available. Do not store secrets or reusable execution/publication approvals in these files.

## 7. Progress views and interpretation

The reporter reads only the fixed baseline files; a missing or unexpected PBI fails validation rather than silently changing the denominator. It validates types, references, hierarchy, cycles, criterion identity, source coverage and evidence conditions.

| View | Formula / interpretation |
| --- | --- |
| Scope acceptance | Evidence-backed `done` or `shipped` PBIs / fixed baseline PBIs. This is item-count acceptance, not equal effort or a total-product completion percentage. |
| Verified criteria | Criteria whose entire approved mode mapping has current passing receipts / all baseline ACs. Documentation of a test does not count as execution. |
| Lifecycle | Counts by state; maturity is not partial earned delivery credit. |
| Flow | Actual accepted items in the previous 28 days, as of the selected report date. Historical snapshots/Git support longer trend analysis; no fabricated burnup series is shipped. |
| Estimates | Unestimated count plus estimated points. Weighted accepted fraction is unavailable until the full denominator is estimated. Do not infer velocity or completion dates. |
| Hierarchy/value | Epic, feature and intended-outcome groupings. Outcome groups overlap; do not sum them to inflate progress. Actual product value requires the study in WB-PBI-052. |
| Dependencies/gates | Explicit blockers and waiting prerequisites are separate. Gate contribution views cannot certify external gate decisions. |
| Evidence quality | Missing plans, stale receipts, missing owners and unresolved questions remain visible. No implicit acceptance from task status. |

The initial snapshot is **0/54 accepted PBIs and 0/216 verified ACs** because this newly formalized acceptance baseline has no reconciled runtime receipts. Existing implementation is not assessed as zero. A selected `--candidate` fails closed if a claimed tested/done state has no matching evidence for that candidate; investigate rather than laundering old results.

## 8. Change control and maintenance

Revise a requirement with its rationale and affected sources, ACs, fixtures, adapters, docs and tests. Increment `revision` for normative or verification changes, reset invalidated acceptance/state, and preserve prior history in Git. Renaming a title does not allocate a replacement ID. A cancelled scope item must retain its original record and explicit decision.

Use separate execution tasks for implementation steps. Record new task IDs before referencing them; no competing copies of SH/CX/CP/PUB status are introduced here. Run local validation before each requirements commit and preserve the original source-baseline dates rather than relabeling old reviews as current evidence.
