# Improvement-plan traceability

The supplied plan is revised in [COMPANION-IMPROVEMENT-PLAN.md](../product/COMPANION-IMPROVEMENT-PLAN.md). [Task files](README.md) own execution status. This crosswalk accounts for the original scope without carrying forward its companion-first sequencing or freezing concept features.

## Original work packages

| Original package | Current task coverage | Sequencing change |
| --- | --- | --- |
| E01 Product/installable contract | SH-001, SH-002, SH-011, SH-013; PUB-001, PUB-002 | Shell contracts/export first; public identity/distribution last. |
| E02 Native design-only project | SH-004, SH-005; CX-002; CP-001, CP-002 | Qualify reusable persistence before native use. |
| E03 Editor coherence/traceability | SH-015; CX-003; CP-003 | Concept improvements continue before conversion. |
| E04 Design-to-code contract | SH-011, SH-015, SH-016, SH-017; CX-004, CX-006 | Shared compiler/makers precede companion UI. |
| E05 Additive preparation | SH-012, SH-013, SH-014; CP-004 | Prove CLI/shared contract first. |
| E06 First generated plugin | SH-016, SH-017, SH-019; CP-005 | First prove an independent shell consumer. |
| E07 Ownership/iteration | SH-012, SH-018; CX-006; CP-005, CP-008 | Shared ownership safety precedes UI integration. |
| E08 Actionable data contracts | SH-008, SH-009, SH-010; CX-004; CP-006 | Include requested test-data generation as reusable shell behavior. |
| E09 Execution/recovery | SH-006, SH-011, SH-012; CX-006; CP-008 | One operation implementation and evidence model. |
| E10 Native interaction/performance | SH-003, SH-020; CX-003; CP-009 | Shell lifecycle qualification is not deferred to publishing. |
| E11 Public candidate/support | SH-021, SH-022; CP-009, CP-010; PUB-001–PUB-005 | Internal shell readiness, then native readiness, then authorized publication. |
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
| 14 Work packages | This crosswalk and 44 individual tasks; original priorities superseded. |
| 15 Incremental delivery | Strategy gates and explicit task dependencies. |
| 16 Next concept iteration | CX-001–CX-007; concept roadmap. |
| 17 Validation/sustainability | CX-002, CX-007, CP-009, PUB-003, PUB-005; no telemetry dependency. |
| 18 Public gate | CP-010 and PUB-001–PUB-005; separate authorization. |

## Additional requested capabilities retained

**Test data:** SH-009/SH-010 implement deterministic providers and contained materialization; CX-004 designs the workflow; CP-006 integrates it. Every supported data-source kind gets a declared simulation or isolated provision mode. No production fallback or authoring-vault population is implied.

**Design System:** SH-007 provides reusable tokens and Markdown/HTML exporters; CX-005 develops the concept; CP-007 supplies native authoring. This separates shared functionality from the companion UI.

**Real native conversion:** CP-001 is explicit and mandatory, and CP-002–CP-010 complete and qualify the accepted scope. Wrapping the prototype is expressly insufficient.

**Standalone shell priority:** All SH tasks precede the native lane through SH-022. Later concept discoveries may add shell tasks, but do not allow companion-private implementations to bypass the gate.

## Retained authorities

The [parent PRD](../product/PRD.md), its baseline/specification companions, the [full companion requirements baseline](../product/COMPANION-REQUIREMENTS-0.3.md), [readiness ledger](../development/TEMPLATE-READINESS-LEDGER.md) and historical evidence records are retained. This crosswalk adds delivery tasks; it does not replace their requirement IDs, waive unexecuted acceptance cases or promote old results.
