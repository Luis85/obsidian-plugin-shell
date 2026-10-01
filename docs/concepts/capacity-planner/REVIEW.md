# Capacity Planner — closure of the comprehensive product review

This pass closes the ten product decisions left open by the previous review and fixes the reported no-op Save/New-plan experience. The concept is now a coherent project-capacity model rather than a collection of independent planning widgets.

## Product model after this pass

### Project facts versus scenario assumptions

The key architectural decision is separation of facts from assumptions.

**Project facts** are shared by every resource plan:

- project identity and order value;
- canonical iterations and timeline authority;
- working weekdays and holidays;
- role catalog and role commercial defaults;
- named people, leave and availability overrides;
- task catalog;
- actual effort;
- persistence paths and conflict policy;
- audit/revision history.

**Scenario assumptions** are plan-specific:

- resource budget;
- contingency and margin target;
- planned FTE per role/iteration;
- iteration-specific rate overrides;
- task allocation slices;
- non-labor planned/actual values;
- draft/approved status.

This prevents cloning a resource plan from creating a second truth for iteration dates, people or actuals.

## Closure of the previous remaining items

| Previous open item | Decision and implementation in this pass |
| --- | --- |
| Multiple plans / scenarios | A project now owns multiple named resource plans. New Plan can clone the active plan or start blank. Plans can be selected, compared, duplicated and archived. |
| Iteration authority | Iterations moved to the project layer. `timelineOwner` explicitly identifies Capacity Project or upstream Iteration Planner authority. Upstream mode accepts stable iteration IDs as canonical JSON; scenarios never own dates. |
| Variable role availability | Exact working dates use configured weekdays minus project holidays. People contribute base FTE or iteration override; working-day leave reduces available hours. Role availability is derived from active people, with manual FTE only as a fallback. |
| People versus roles | Named people are first-class project entities assigned to roles. Task slices may optionally name a person, enabling person-level overload checks while still permitting role-level planning. |
| Task span | Tasks now have multiple allocation slices. A single estimate may span roles, iterations and people; remaining estimate stays in Unallocated Work until fully distributed. |
| Actuals and reforecasting | Actual hours are project facts shared across plans. Forecast separates actual labor, remaining allocated work (ETC), forecast non-labor and contingency. EAC/forecast and margin update as actuals arrive. |
| Commercial depth | Added order value, plan budget, contingency, target margin, non-labor planned/actual costs, role budget buckets and iteration-specific rate overrides. |
| Collaboration/versioning | Every mutation increments a revision and appends an audit record. Baselines are immutable snapshots with optional approval and restore-as-new-plan. Import compares revision tokens and supports warn or block-older conflict policy. This is the prototype's explicit single-file concurrency contract. |
| Obsidian persistence | Configurable canonical paths now exist for project, scenarios, iterations, roles, people, tasks, baselines and audit. The prototype generates real Markdown/frontmatter bytes and packages them as an offline ZIP. Native vault writes remain an implementation adapter, not simulated browser writes. |
| Host theming | Prototype variables consume Obsidian-style host tokens first and use local fallbacks only when hosted standalone. Production should connect the same semantic variables through the repo's Nuxt UI/Obsidian style pipeline. |

## No-op and save defect review

The previous dialog pattern used `method="dialog"` together with an intercepted submit event. Although the flow could work in some browser states, it was unnecessarily ambiguous and produced the reported experience that Save/Create controls did nothing.

The new dialog contract uses:

1. a normal `<form>`;
2. a normal submit button;
3. explicit `reportValidity()`;
4. an explicit mutation callback;
5. revision/audit update;
6. persistence attempt;
7. rerender and visible status message.

There is also a top-level **Save** button. When local storage works it persists the workspace. When browser storage is unavailable, Save downloads the current JSON workspace instead. It therefore never silently succeeds without a durable result.

A static no-op gate scans all source-rendered `data-action` values and static frame buttons. A browser journey then performs the main actions and checks the resulting state or download. This prevents future visual controls from being added without behavior.

## Product perspectives

### Delivery management

The manager can answer, per project, plan, role, iteration and person:

- what capacity exists;
- what capacity is planned;
- what work is allocated;
- where staffing or work exceeds capacity;
- what has actually been spent;
- what remains to complete the allocated plan;
- whether the forecast fits the resource budget;
- whether forecast margin meets the commercial target;
- what changed from the approved baseline.

### Resource management

Availability is no longer a manually typed role envelope when named staff exists. People, FTE patterns, leave and holidays derive the envelope. Role-level fallback remains useful for early-stage planning before staffing names are known.

### Work planning

Task estimates remain independent from allocations. This avoids forcing a work item into one role/iteration just to use the capacity matrix. Partial allocations preserve the unallocated remainder and make handoffs/splits explicit.

### Finance / commercial management

The planner now distinguishes order value, internal resource budget, planned labor, actual labor, ETC labor, non-labor costs, contingency and margin. The concept is still not an accounting ledger, but it no longer collapses all commercial reasoning into one budget number.

### Governance

Baseline snapshots are immutable. Approval attaches to the snapshot, not to mutable live plan data. Restore creates a new scenario, preserving the audit trail. Revision tokens and conflict policy make import replacement behavior explicit.

### Obsidian / implementation fit

The standalone browser does not pretend to have vault APIs. Instead it produces the exact file paths and Markdown/frontmatter payloads the future Obsidian adapter would write. That makes persistence inspectable without coupling the concept to a fake native API.

### Accessibility and interaction

Primary workflows have button alternatives to drag/drop. Dialog submit behavior is standard form behavior. Status changes are textual as well as color-coded. The matrix remains horizontally scrollable; narrow layouts keep Save/New Plan and planning checks visible.

## Validation boundary

The pass has strong browser-prototype evidence but is not production qualification. Specifically not claimed:

- native Obsidian file writes;
- live synchronization with the existing Iteration Planner;
- multi-process locking across two Obsidian clients;
- payroll, invoice or accounting compliance;
- repository-pinned TypeScript 6.0.3 qualification in the local environment.

Those are implementation/qualification concerns rather than unresolved product-model decisions.

## UI-focused improvement and polishing pass

This pass changes the information hierarchy rather than adding another layer of controls.

### Header and first-screen priority

The previous screen spent two stacked bands on application actions and plan controls before the capacity matrix, followed by a seven-card KPI grid and a full-width planning-check row. At a 1440×900 viewport, the user had to visually traverse product chrome, toolbar actions, KPIs and checks before reaching the current plan.

The revised hierarchy is:

1. **46px command bar** — Capacity identity, active plan selector, storage/revision state, `+ Task`, Save, New plan and one Manage entrypoint.
2. **Current-plan strip** — scenario title/status and compact project/timeline context, plus three tiny decision signals.
3. **Current plan matrix** — the main working surface.
4. **Optional Summary** — collapsed by default; expands into compact Commercial, Delivery and Planning-check groups.

Secondary actions no longer compete with the plan. Plan settings, project/timeline, team, commercials, plan management/comparison, baselines, audit, persistence and exchange are grouped in one Manage dialog.

### KPI redesign

The seven large KPI cards and separate checks row are no longer rendered. The collapsed state exposes only three deliberately small signals: budget variance, unallocated hours and issue count. Expanding Summary shows eight compact metrics in two semantic groups and five concise planning checks. This preserves decision support without making summary information the visual center of the application.

The expanded state also deliberately reduces the matrix viewport; collapsing it immediately gives that space back to planning.

### Task ownership and many-person assignment

Task staffing now has two project-level concepts independent of scenario allocation:

- **Owner** — one accountable person (`ownerPersonId`).
- **Assigned people** — zero or more contributors (`assigneeIds`).

The owner is always included in the assigned people. Existing allocation people are retained if a task is edited, avoiding an inconsistent task team. Task cards show the owner and team size, backlog search includes owner/assigned-person names, and allocation selection prioritizes the owner and existing task team. Selecting a new role member in an allocation automatically adds that person to the task team.

This keeps accountability stable while still letting one task span many people, roles and iterations. Allocation slices remain the source of planned hours; task-level assignment does not fabricate capacity consumption.

### Visual QA result

At 1440×900 with Summary collapsed, the capacity workspace begins directly below the plan strip at roughly the first 120px of the viewport, instead of after several summary/control sections. The plan matrix therefore occupies the majority of the first screen. Summary, task-team authoring and the Manage surface were visually inspected after the browser regression suite passed.
