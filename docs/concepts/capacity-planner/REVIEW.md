# Capacity Planner — comprehensive product review and polishing pass 3

Review baseline: PR #62, `feat/cli-release-journey`, head `c1cfa2bf032a483a6c922c3c92512637d976bed6` at the start of this pass.

This pass reviews the current Capacity Planner as a delivery-manager decision surface for a custom software order. It deliberately distinguishes project facts (timeline, people, tasks, actuals) from resource-plan assumptions (FTE, rates, allocations, budget, contingency, non-labor cost) and evaluates whether the UI supports a manager making staffing, scope and commercial decisions without overclaiming precision.

## Review result

The previous UI-focus pass fixed the largest information-hierarchy problem: the current plan is now above the fold and Summary is secondary. The remaining high-impact findings were mostly **decision-integrity** rather than visual defects:

1. the summary displayed allocated work using a capacity-derived formula, producing an incorrect value;
2. budget variance and margin looked like complete EAC values even while estimated scope remained unallocated and therefore unpriced;
3. shared project actuals were costed using the currently selected scenario's rates, so actual cost could change when comparing scenarios;
4. role availability still included inactive people;
5. role-level allocations with no named person were not surfaced as an incomplete staffing decision;
6. inactive tasks could continue contributing to open-scope metrics;
7. workspace import validation covered only part of the cross-entity model;
8. the wide timeline lacked orientation to the current/next iteration;
9. allocation cards were keyboard-focusable but Enter/Space did not perform the equivalent edit action;
10. dialog focus was not restored to the invoking control;
11. Markdown handoff exported plans and tasks but omitted the project's actual-effort records.

All eleven findings are addressed in this pass.

## Product-perspective review

| Perspective | Finding | Improvement |
| --- | --- | --- |
| Product outcome | The prototype exposed a large amount of planning data, but some summary numbers could imply more certainty than the plan actually contained. | Summary and commercials now explicitly distinguish **covered forecast** from full forecast while scope remains unallocated. |
| Primary user / JTBD | A delivery manager needs to know what is staffed, what is still open, what is commercially credible, and where to act next. | Summary now reports real scope allocation coverage; planning checks surface role-level unnamed work, missing ownership/team decisions and unpriced scope. |
| Domain model | Project actuals are shared facts, but cost depended on whichever scenario was open. | Actual entries snapshot their EUR/PT rate when booked. Actual cost is therefore stable across resource-plan scenarios. |
| Scope planning | `Allocated work` was calculated as role capacity minus unallocated task scope. Capacity and task scope are different quantities. | Added explicit `scopeHours`, `allocatedScopeHours`, `unallocatedHours` and `scopeCoverage`. Sample plan now correctly shows 546 h scope, 456 h allocated and 90 h open. |
| Forecasting | EAC/margin appeared complete with 90 h of scope still unallocated. | Incomplete plans use **Covered forecast**, **Covered variance**, and **Covered margin**, with forecast coverage shown prominently. |
| Staffing | Allocations could remain at role level with no named person but were not visible in the global staffing condition. | Metrics now count role-level allocation hours and flag them as work still requiring named staffing. |
| People availability | Inactive people still contributed hours to a role envelope. | Inactive people now contribute zero availability and are excluded from people-derived role envelopes. |
| Task lifecycle | Archived tasks could still contribute open scope. | Scope metrics and the unallocated-work queue now operate on active tasks only. |
| Task accountability | Owner + many assigned people are already explicit, but missing ownership/team information did not affect planning checks. | Scope checks now show counts of active tasks without an owner or without assigned people. |
| Commercial integrity | Actual-cost changes between scenarios would undermine comparison/baseline trust. | Actual rate is stored on the booking; scenario rates now affect ETC/planned cost, not historical actual cost. |
| Scenario comparison | Plans with different degrees of allocation could be compared as though their forecasts had equal completeness. | Compare Plans now includes a **Coverage** column and labels partial forecast values as covered. |
| Information architecture | The compact plan-first layout is strong, but an eight-plus iteration horizontal matrix has weak temporal orientation. | Added a compact **Current/Next/Latest iteration** control and a subtle highlighted focus column. |
| Matrix readability | Iteration totals and cells showed issues, but role-level unnamed work was hidden. | Iteration summaries and cells now include unnamed-person hours when present. |
| Navigation | Archived roles could continue cluttering a current-plan board even when no current scenario data referenced them. | Current-plan rows hide inactive roles unless they still contain planned FTE or allocations in the active scenario. |
| Accessibility | Backlog cards supported keyboard assignment; allocated cards did not have equivalent keyboard activation. | Enter/Space on an allocated card now opens its allocation editor. |
| Dialog accessibility | Closing a dialog did not reliably return focus to the invoking control. | The shared dialog layer now preserves and restores the original opener, including nested Manage flows. |
| Data integrity | Import validation mostly checked top-level identity and task people references. | Validation now checks iteration/role/person/task/actual/allocation/non-labor references, person-role consistency, positive hours/rates and allocation totals against task estimates. |
| Persistence | Actual effort was not represented as canonical Markdown output. | Added an `Actuals` path and one frontmatter-backed Markdown record per actual booking, including snapshotted rate. |
| Responsiveness | Plan-first/mobile behavior from the prior pass remains effective. | New focus controls wrap into the board toolbar without reintroducing header density. |
| Maintainability | Source modules were already below the repository's handwritten-code ceiling. | Changes remain within the existing module boundaries; no new runtime dependency or production code path was introduced. |

## Decision model after this pass

### Project facts

- shared iterations and calendar;
- roles and people;
- people availability, leave and active/inactive state;
- task estimates, owner and assigned people;
- actual effort with snapshotted booking rate;
- order value;
- canonical persistence paths.

### Resource-plan assumptions

- planned FTE by role and iteration;
- scenario rate overrides for future/planned work;
- task allocation slices by role, iteration and optional named person;
- resource budget and contingency;
- target margin;
- non-labor planned/actual items.

This separation is important: changing a forecast assumption must not rewrite historical actual cost.

## Forecast semantics

The planner now distinguishes three different quantities:

- **Estimated scope** — total hours implied by active task estimates;
- **Allocated scope** — task hours placed into role/iteration slices;
- **Planned capacity** — role hours available in the active resource plan.

They are intentionally not interchangeable.

When allocation coverage is below 100%, the commercial view says **Covered forecast** rather than EAC. The unallocated hours remain an explicit unpriced uncertainty. The planner does not invent a blended rate for scope that has no role or iteration yet.

Once all active estimated scope is allocated, the same metrics become normal Forecast / EAC, variance and margin values.

## Staffing semantics

Task team membership and capacity consumption remain separate:

- one task owner is accountable;
- zero or more assigned people identify the task team;
- allocation slices consume hours from a role/iteration and may name one person;
- role-level slices without a person are permitted for early scenario design but now remain visibly incomplete staffing decisions.

Inactive people no longer count toward role availability. Existing task/team references can still retain inactive people for historical continuity, but they do not contribute future capacity.

## Timeline orientation

The plan board now identifies one temporal focus iteration:

1. iteration containing today's date;
2. otherwise the next future iteration;
3. otherwise the latest iteration when the plan is historical.

The focused column is subtly highlighted and the board offers a single button to scroll back to it. This improves navigation without adding another toolbar or persistent control row.

## Import and persistence integrity

Capacity Planner v2 import now rejects workspaces with:

- missing or duplicate core identities;
- people referencing missing roles;
- tasks referencing missing owners/assignees;
- actuals referencing missing task/role/person/iteration;
- invalid actual hours/rates;
- allocations referencing missing entities;
- a named allocation person whose role does not match the allocation role;
- non-positive allocation hours;
- allocations exceeding the task estimate;
- role plans referencing missing roles;
- invalid non-labor cost values.

Normalization remains intentionally small and safe: missing historical `dayRate` on a v2 actual is filled from its role's default rate, task team membership is reconciled with existing named allocations, and the new `Actuals` persistence path receives a default when absent.

## Accessibility and interaction polish

- Summary remains collapsed by default.
- Drag/drop still has explicit Allocate/Edit controls.
- Backlog cards use Enter/Space for allocation.
- Allocation cards now use Enter/Space for editing.
- Dialog Close/Escape restores focus to the original opener when it still exists.
- Current/next iteration highlighting is not the sole signal; the focus control has text.
- Existing reduced-motion behavior is retained.

## Verification scope

The repeatable browser journey now additionally verifies:

- correct 546 h / 456 h / 90 h scope math;
- 83.5% forecast coverage on the sample plan;
- partial forecast labeling;
- current/next iteration focus navigation;
- allocation-card keyboard editing;
- actual-rate snapshot persistence;
- Markdown export of actual records and their day rate;
- Compare Plans coverage column;
- dialog focus restoration.

The static action gate continues to fail on any visible delegated action or static button without a handler.

## Remaining production boundaries

These are integration boundaries rather than unresolved prototype defects:

- the standalone concept still exports Markdown instead of writing through a native Obsidian adapter;
- multi-user locking, merge/conflict resolution and authorization are not simulated by the single-browser prototype;
- external time-booking, HR/calendar and finance-system integrations are not connected;
- national/regional holiday calendars must be supplied by a production calendar source if required;
- very large portfolios would need virtualization/pagination beyond the prototype's 100-iteration generation guard;
- production must reuse the repository's Vue/Pinia/Nuxt UI/Obsidian host pipeline rather than transplanting the standalone implementation directly.

No legacy Companion schema support or migration path is reintroduced by this concept work.
