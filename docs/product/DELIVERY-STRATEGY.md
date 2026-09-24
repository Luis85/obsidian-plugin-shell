# Delivery strategy: shell first, companion second, publication last

**Decision date:** 2026-09-24. **Status:** Owner-directed delivery order; implementation and gate evidence remain outstanding. Read with the [parent PRD](PRD.md), [companion PRD](COMPANION-PLUGIN-PRD.md), [improvement plan](COMPANION-IMPROVEMENT-PLAN.md) and [task index](../tasks/README.md).

## Decision and precedence

The shell template and its features have the highest implementation priority. It must work well as a standalone development foundation and as the foundation of the future companion. The companion is still an evolving browser concept. Its native conversion follows shell readiness. Publishing is last.

This supersedes the supplied improvement plan's recommendation to prioritize companion installation and close its full native journey before further feature work. It also supersedes an immediate change of the root manifest to companion identity. The eventual install-companion-first user journey remains valid; it is not the repository's construction order.

The original parent requirements, detailed companion requirements, architecture invariants, safety boundaries, quality thresholds and acceptance inventories remain in force. Historical evidence is not promoted. Task priorities govern work ordering, not defect severity or permission to omit safety.

## Four work lanes

| Lane | Priority | Responsibility | Entry/exit |
| --- | --- | --- | --- |
| Shell foundation | P0 | Generic runtime, standalone tooling, generation, fixtures and qualification | Start with SH-001; internal readiness is SH-022. |
| Concept development | P1 | Continue feature design and validation; expose reusable shell needs | May progress secondarily; bounded conversion scope is CX-007. |
| Native companion | P2 | Convert the agreed concept into a real shell-based plugin | CP-001 requires SH-022 and CX-007; CP-010 closes native readiness. |
| Publication | P3 | Resolve distribution, rehearse, document, obtain approval and publish | Starts after CP-010; publication requires fresh explicit authorization. |

P1 concept work can run in parallel when it does not delay P0 shell prerequisites. It may request new or changed SH tasks. Do not begin production companion conversion while calling an unqualified shell dependency complete. Risk discovery about distribution/policy may happen during SH-001/SH-013; actual publication and public-identity changes remain in the final lane.

## Gate G1: shell ready for consumers

SH-022 requires a reviewed matrix covering every applicable shell requirement, its implementation location, actual tests and unresolved restrictions. The gate includes clean standalone source export, guided setup, useful public APIs, safe persistence, settings/styles/feedback, data/fixture contracts, shared operations, generation and an independently built reference plugin.

Qualify the agreed desktop matrix and real host lifecycle; do not substitute browser mocks for native evidence. Existing unsupported dependencies, missing required native cases or safety failures remain blockers where applicable. Distinguish consumer-readiness from public-release-only work; moving publication last must not hide runtime requirements in the publication backlog.

Shell code and scripts remain ordinary reusable infrastructure. Business features should not require edits to generic services or main.ts. A second non-companion consumer proves that the companion has not become a hidden dependency.

## Gate G2: bounded concept conversion scope

CX-007 records the exact concept revision, selected feature scope, unresolved questions, deliberate deferrals and acceptance scenarios. It maps each selected feature to shell capabilities. It is a scope decision, not a declaration that the concept is feature-complete.

Later feature development remains allowed. Before a new native dependency is used, revise the scope and affected shell tasks, requalify changed contracts and retain a readable decision history. Never silently reduce accepted behavior to make a port appear finished.

## Gate G3: real companion ready

CP-010 requires a native plugin built through shell composition, real persisted designs, integrated editors and optional template/generation operations, plus fixtures, design-system and recovery features in the accepted scope. No iframe/webview of the concept or private fork of the foundation counts.

Execute the design-only, design-to-working-plugin and developer-ownership journeys. Record actual host/platform/accessibility/performance evidence and remaining limitations. Companion and independent shell consumer regressions must both remain green for the accepted candidate.

## Gate G4: authorized publication

PUB-001 through PUB-003 resolve policy/distribution, rehearse two distinct artifact types and finish user/support documentation. PUB-004 cannot execute without a separately recorded owner approval of the exact candidate, destination and actions. A task file, prior CI pass or gate status is not that approval.

Do not merge, tag, publish, promote releases, submit listings, change repository protections or enable automatic updates merely because those future tasks exist. The current documentation PR performs none of them.

## Change control and evidence

Task files are the canonical task status; the index is navigation, not another editable status database. Initial task status is planned. Begin each task by inspecting current code and evidence, then implement only the remaining gap. Already satisfied criteria may be closed with fresh scoped evidence instead of being rebuilt.

Use planned → in-progress → blocked/in-review → done, with explicit superseded status only when a replacement is linked. A done task records commit/artifact identity, commands, actual results and unexecuted scope. Gate tasks list all applicable prerequisites, including new tasks introduced by accepted scope changes.

Preserve the existing `.dev-vault` boundary and actual host configuration-directory resolution. The earlier `.test-vault` feature wording expresses an isolated-test-vault need, not authorization for an unreviewed rename. A configurable alias/path extension requires its own reviewed contract and installer/fixture tests.

Use small task-focused PRs. This documentation work is stacked on PR #5 while it remains open, so the review contains the planning change rather than duplicating the concept implementation. Rebase/retarget through ordinary reviewed Git operations after the prerequisite branch is integrated; do not merge it automatically.
