# Improvement-plan traceability

The supplied plan is revised in [COMPANION-IMPROVEMENT-PLAN.md](../product/COMPANION-IMPROVEMENT-PLAN.md). [Task files](README.md) own execution status. This crosswalk accounts for the original scope without carrying forward its companion-first sequencing or freezing concept features.

## Original work packages

| Original package | Current task coverage | Sequencing change |
| --- | --- | --- |
| E01 Product/installable contract | SH-001, SH-002, SH-011, SH-013, SH-024–SH-027, SH-034; PUB-001, PUB-002 | Framework archive and separately approved shipment first; companion identity/listing later. |
| E02 Native design-only project | SH-004, SH-005; CX-002; CP-001, CP-002 | Qualify reusable persistence before native use. |
| E03 Editor coherence/traceability | SH-015; CX-003; CP-003 | Concept improvements continue before conversion. |
| E04 Design-to-code contract | SH-011, SH-015, SH-016, SH-017; CX-004, CX-006 | Shared compiler/makers precede companion UI. |
| E05 Additive preparation | SH-012, SH-013, SH-014; CP-004 | Prove CLI/shared contract first. |
| E06 First generated plugin | SH-016, SH-017, SH-019; CP-005 | First prove an independent shell consumer. |
| E07 Ownership/iteration | SH-012, SH-018; CX-006; CP-005, CP-008 | Shared ownership safety precedes UI integration. |
| E08 Actionable data contracts | SH-008, SH-009, SH-010; CX-004; CP-006 | Include requested test-data generation as reusable shell behavior. |
| E09 Execution/recovery | SH-006, SH-011, SH-012; CX-006; CP-008 | One operation implementation and evidence model. |
| E10 Native interaction/performance | SH-003, SH-020; CX-003; CP-009 | Shell lifecycle qualification is not deferred to publishing. |
| E11 Public candidate/support | SH-021, SH-022, SH-031, SH-032, SH-034; CP-009, CP-010; PUB-001–PUB-005 | SH-022 technical readiness → SH-034 framework shipment → native readiness → authorized companion publication. |
| E12 Further feature development | CX-001–CX-007; SH-007; CP-007 | Concept development remains open; design-system export starts in shell. |

## Original 18 sections

| Source section | Retained responsibility / tasks |
| --- | --- |
| 1 Executive decision | Revised construction order in strategy; SH-001, SH-022, CP-001, CP-010, PUB-004. |
| 2 Evidence boundaries | SH-001; every task's evidence section; gate reviews. |
| 3 Outcomes/scope | CX-001, CX-007; independent consumers SH-019 and CP-009. |
| 4 Developer journey | CX-002, CP-002, CP-004, CP-005, CP-008. |
| 5 Distribution/packaging | SH-013, SH-014, PUB-001, PUB-002. |
| 6 IA/interactions | CX-002, CX-003, CP-003, SH-020. |
| 7 Canonical model/persistence | SH-004, SH-005, SH-015, CP-002. |
| 8 Design-to-code | SH-011, SH-016, SH-017, CP-005. |
| 9 Real generation/data sources | SH-008–SH-010, SH-019, CP-005, CP-006. |
| 10 Ownership/drift | SH-018, CX-006, CP-005, CP-008. |
| 11 Preparation/execution safety | SH-012, SH-014, CP-004, CP-008. |
| 12 Architecture | SH-002–SH-008; architecture contract; CP-001. |
| 13 Quality/accessibility/performance | SH-019–SH-022, CP-009, CP-010. |
| 14 Work packages | This crosswalk and 56 individual tasks; original priorities superseded. |
| 15 Incremental delivery | Strategy gates and explicit task dependencies. |
| 16 Next concept iteration | CX-001–CX-007; concept roadmap. |
| 17 Validation/sustainability | CX-002, CX-007, CP-009, PUB-003, PUB-005; no telemetry dependency. |
| 18 Public gate | CP-010 and PUB-001–PUB-005; separate authorization. |

## Additional requested capabilities retained

**Test data:** SH-009/SH-010 implement deterministic providers and contained materialization; CX-004 designs the workflow; CP-006 integrates it. Every supported data-source kind gets a declared simulation or isolated provision mode. No production fallback or authoring-vault population is implied.

**Design System:** SH-007 provides reusable tokens and Markdown/HTML exporters; CX-005 develops the concept; CP-007 supplies native authoring. This separates shared functionality from the companion UI.

**Real native conversion:** CP-001 is explicit and mandatory, and CP-002–CP-010 complete and qualify the accepted scope. Wrapping the prototype is expressly insufficient.

**Standalone shell priority:** All framework implementation/qualification tasks precede the native lane through SH-022, followed by separately authorized shipment SH-034. Later concept discoveries may add shell tasks, but do not allow companion-private implementations to bypass the gate.

## Retained authorities

The [parent PRD](../product/PRD.md), its baseline/specification companions, the [full companion requirements baseline](../product/COMPANION-REQUIREMENTS-0.3.md), [readiness ledger](../development/TEMPLATE-READINESS-LEDGER.md) and historical evidence records are retained. This crosswalk adds delivery tasks; it does not replace their requirement IDs, waive unexecuted acceptance cases or promote old results.

## CLI and release-archive brainstorm crosswalk — 2026-09-24

| Accepted requirement | Task coverage / qualification |
| --- | --- |
| Reuse actual prior work rather than rebuild or assume it merged | SH-001, SH-011, SH-023; PR #17 source reconciliation and Windows-CI evidence. |
| Download framework archive, no installed plugin or maintainer checkout | SH-013, SH-026, SH-032, SH-034. |
| TypeScript-authored central CLI; direct and npm invocation before installation | SH-024, SH-025, SH-026, SH-032. |
| Human and agent parity, structured output, no hidden interactive paths | SH-011, SH-025, SH-027, SH-032, SH-033. |
| Configure then import; reconcile identity/custom source/test paths | SH-005, SH-015, SH-027, SH-028. |
| One shared maker/compiler/plan implementation for CLI and companion | SH-012, SH-016–SH-018, SH-024, SH-028, SH-033. |
| Preserve current read-only exact-JSON handoff; add full compiler separately | SH-015, SH-027, SH-028, SH-032. |
| Build/test/install/fixtures without an installed companion | SH-008–SH-010, SH-019, SH-029, SH-032. |
| Preserve edits and maintain generated plugins after first release | SH-012, SH-018, SH-030, SH-032. |
| Generated-plugin publishing workflow, no automatic public actions | SH-021, SH-031, SH-032; execution requires owner approval. |
| Ship shell/generator/CLI before native companion | SH-022 → SH-034 → CP-001; CX-007 remains required. |
| Framework-side discover/plan/apply/results/recovery integration | SH-033 before shipment; CP-004/CP-008 provide later native UI. |

All original E01–E12 and 18-section scope remains accounted for. New IDs extend rather than renumber the backlog. The [detailed plan](../development/FRAMEWORK-CLI-GENERATOR-PLAN.md) defines the journey and the [bounded PR review](../development/PR5-FRAMEWORK-READINESS-REVIEW.md) distinguishes available evidence from remaining gaps.
