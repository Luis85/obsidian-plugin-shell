# Delivery tasks

**Order:** qualify and ship shell + project generator + TypeScript CLI → real companion on shipped shell → companion publication. **Concept status:** still evolving; not feature-complete or natively implemented. See [strategy](../product/DELIVERY-STRATEGY.md), [plan](../product/COMPANION-IMPROVEMENT-PLAN.md) and [traceability](TRACEABILITY.md).

There are **57 individual task files**: 35 shell/framework, seven concept, ten native companion and five companion-publication tasks. Roadmap tasks remain `planned`; the incoming compiler task SH-035 retains `in-review` (implementation under verification), and SH-022 is explicitly `blocked` by the reviewed source/CI and missing framework scope. This revision closes no implementation task. Task frontmatter is the single authority for status/dependencies. Tables below are navigation and dependency summaries, not a second progress database.

## Working rules

Priorities express delivery order: P0 framework including its separately approved shipment; P1 secondary concept refinement; P2 native companion; P3 companion publication. They do not downgrade safety or quality. SH-022, SH-034 and CX-007 are hard prerequisites of CP-001. CP-010 is a hard prerequisite of PUB tasks, not of the first framework release. Read the [CLI/generator plan](../development/FRAMEWORK-CLI-GENERATOR-PLAN.md) and [PR #5 readiness review](../development/PR5-FRAMEWORK-READINESS-REVIEW.md).

Inspect current source and actual evidence before implementing. A task may extend or qualify existing behavior; do not recreate working makers/services because older prose calls them pending. Record covered criteria and implement only the remaining gap. Preserve parent requirements, exact dependency pins, existing thresholds, protected data and unrelated edits.

Use `planned`, `in-progress`, `blocked`, `in-review`, `done`, or `superseded`. A blocked task records reason and next action. A superseded task links its replacement. A done task records commit/artifact, actual commands/results and unexecuted scope. A gate cannot pass just because dependent files say done; review their evidence and any added scope. No gate grants publication authority.

Use the [task template](TASK-TEMPLATE.md). Add new stable IDs when accepted concept work exposes another shell requirement. Do not renumber tasks. All links and dependencies must remain valid and acyclic. For implementation, follow the root [AGENTS.md](../../AGENTS.md).

## Shell foundation P0

| Task | Deliverable | Depends on |
| --- | --- | --- |
| [SH-001](shell/SH-001.md) | Current shell capability and evidence inventory | None |
| [SH-002](shell/SH-002.md) | Shared product composition and public extension API | SH-001 |
| [SH-003](shell/SH-003.md) | Multi-view host lifecycle and ownership | SH-002 |
| [SH-004](shell/SH-004.md) | Generic durable entity/document persistence | SH-002 |
| [SH-005](shell/SH-005.md) | Settings, safe paths and migrations | SH-004 |
| [SH-006](shell/SH-006.md) | Shared events, errors, feedback and localization | SH-002 |
| [SH-007](shell/SH-007.md) | Modular design tokens and Markdown/HTML export | SH-002 |
| [SH-008](shell/SH-008.md) | Data-source operation contracts and vault adapter | SH-004, SH-006 |
| [SH-009](shell/SH-009.md) | Deterministic schema-driven test-data generation | SH-008 |
| [SH-010](shell/SH-010.md) | Contained fixture materialization and safe reset | SH-009, SH-005 |
| [SH-011](shell/SH-011.md) | Data-only capability catalog and operation protocol | SH-001 |
| [SH-012](shell/SH-012.md) | Shared plans, approvals, locks and recovery | SH-011 |
| [SH-013](shell/SH-013.md) | Independent template source export | SH-002 |
| [SH-014](shell/SH-014.md) | Reviewed additive template preparation | SH-012, SH-013 |
| [SH-015](shell/SH-015.md) | Versioned design interchange schema | SH-001 |
| [SH-016](shell/SH-016.md) | Field-aware makers and container/screen separation | SH-004, SH-007 |
| [SH-017](shell/SH-017.md) | Shared design-to-code compiler and feasibility | SH-011, SH-015, SH-016, SH-008 |
| [SH-018](shell/SH-018.md) | Output ownership, additive generation and drift | SH-012, SH-017 |
| [SH-019](shell/SH-019.md) | Independent generated reference plugin | SH-010, SH-013, SH-014, SH-018 |
| [SH-020](shell/SH-020.md) | Host, accessibility and performance qualification | SH-003, SH-005, SH-006, SH-007 |
| [SH-021](shell/SH-021.md) | Supported dependency and security baseline | SH-001, SH-013 |
| [SH-022](shell/SH-022.md) | Framework technical-readiness gate | SH-019, SH-020, SH-021, SH-032, SH-033 |
| [SH-023](shell/SH-023.md) | Reconcile the implementation baseline and Windows CI | SH-001 |
| [SH-024](shell/SH-024.md) | Extract the shared TypeScript tooling core | SH-002, SH-011, SH-015, SH-023 |
| [SH-025](shell/SH-025.md) | Deliver the central human and agent CLI | SH-024 |
| [SH-026](shell/SH-026.md) | Assemble the runnable framework developer kit | SH-013, SH-025 |
| [SH-027](shell/SH-027.md) | Implement guided setup and project JSON intake | SH-026, SH-005, SH-015 |
| [SH-028](shell/SH-028.md) | Integrate full project generation with shared makers | SH-017, SH-018, SH-024, SH-027, SH-035 |
| [SH-029](shell/SH-029.md) | Unify development, test-vault and lifecycle commands | SH-025, SH-010, SH-028 |
| [SH-030](shell/SH-030.md) | Provide ownership-aware maintenance and upgrades | SH-012, SH-018, SH-025, SH-028 |
| [SH-031](shell/SH-031.md) | Expose generated-plugin release preparation and rehearsal | SH-021, SH-025, SH-028, SH-029 |
| [SH-032](shell/SH-032.md) | Qualify the clean release-archive user journey | SH-019, SH-026, SH-027, SH-028, SH-029, SH-030, SH-031 |
| [SH-033](shell/SH-033.md) | Qualify the framework-side companion operation adapter | SH-024, SH-025, SH-028, SH-029, SH-007, SH-012 |
| [SH-034](shell/SH-034.md) | Ship the qualified framework before companion conversion | SH-022 |
| [SH-035](shell/SH-035.md) | Preserve and qualify the implemented companion project compiler | SH-015, SH-018 |

PR #20 also introduced an unrelated SH-023. Its generator task is now [SH-035](shell/SH-035.md); the original [SH-023](shell/SH-023.md) baseline task keeps its existing references. SH-028 depends on SH-035, so framework readiness still covers the generator without an ID collision or a dependency cycle. No acceptance criterion is closed by the reconciliation.

Start at SH-001. SH-022 includes the transitive prerequisites above and all newly accepted shell requirements; it cannot close with required consumer behavior only present in the concept.

## Concept development P1

Concept work may continue secondarily while shell implementation proceeds. No whole-product feature freeze is implied.

| Task | Deliverable | Depends on |
| --- | --- | --- |
| [CX-001](concept/CX-001.md) | Feature inventory and ongoing change process | SH-001 |
| [CX-002](concept/CX-002.md) | Design-only onboarding and lifecycle navigation | CX-001 |
| [CX-003](concept/CX-003.md) | Coherent editors and protected regressions | CX-001 |
| [CX-004](concept/CX-004.md) | Actions, sources and test-data interaction contracts | CX-001 |
| [CX-005](concept/CX-005.md) | Design-system editor and export concept | CX-001 |
| [CX-006](concept/CX-006.md) | Generation, ownership and recovery review concept | CX-002, CX-004 |
| [CX-007](concept/CX-007.md) | Reviewed bounded conversion baseline | CX-003, CX-005, CX-006, SH-015 |

## Native companion P2

Every CP task inherits SH-022, SH-034 and CX-007 through CP-001. Concept-only screens, virtual storage and simulated receipts do not satisfy native acceptance.

| Task | Deliverable | Depends on |
| --- | --- | --- |
| [CP-001](companion/CP-001.md) | Convert concept into a real shell-based native product | SH-022, SH-034, CX-007 |
| [CP-002](companion/CP-002.md) | Persist and resume canonical design records | CP-001 |
| [CP-003](companion/CP-003.md) | Integrate native design editors | CP-002 |
| [CP-004](companion/CP-004.md) | Optional template setup through shared operations | CP-002 |
| [CP-005](companion/CP-005.md) | Generate the working reference plugin from design | CP-003, CP-004 |
| [CP-006](companion/CP-006.md) | Native source/test-data workflows | CP-005 |
| [CP-007](companion/CP-007.md) | Native design-system authoring and export | CP-003 |
| [CP-008](companion/CP-008.md) | Development, verification and recovery UX | CP-005 |
| [CP-009](companion/CP-009.md) | End-to-end native and standalone regression qualification | CP-006, CP-007, CP-008 |
| [CP-010](companion/CP-010.md) | Native companion readiness gate | CP-009 |

## Companion publication P3

These tasks publish the companion after native qualification, referencing the previously shipped compatible framework. SH-031 owns generated-plugin release tooling; SH-034 owns the first framework shipment. Every public mutation still requires its own explicit candidate-specific approval.

| Task | Deliverable | Depends on |
| --- | --- | --- |
| [PUB-001](publication/PUB-001.md) | Resolve current policy and distribution topology | CP-010 |
| [PUB-002](publication/PUB-002.md) | Rehearse companion artifacts with shipped framework | PUB-001 |
| [PUB-003](publication/PUB-003.md) | Final onboarding, support and release documentation | PUB-002 |
| [PUB-004](publication/PUB-004.md) | Explicitly authorized publication of exact candidate | PUB-003 |
| [PUB-005](publication/PUB-005.md) | Post-publication installation and recovery verification | PUB-004 |

## Definition of ready and done

Ready means a current baseline was inspected, dependencies and scope are understood, and acceptance criteria are independently testable. It does not require every related feature to be complete. Where one task grows beyond a coherent review unit, split it and update the gate dependency coverage before implementation.

Done means the accepted scope works, regressions and negative cases are exercised, documentation and compatibility are updated, and exact evidence is attached. Record simulated, compiled, browser, native and manual results separately. Never erase a blocker or weaken thresholds to close a task. Product scope may evolve; changing a passed contract reopens affected qualification.

This backlog is Markdown documentation, not GitHub issues. No release, merge, tag, permission change, global installation or automatic enablement is authorized by creating it.
