# Capacity Planner — comprehensive product review and polishing pass

Review baseline: PR #62, `feat/cli-release-journey`, head `2e5f9295537bd0ca07ff3b400a46ed4168fca7eb` at the start of this pass.

This review treats the concept as a delivery-manager planning surface for a custom-software order: a fixed EUR resource budget, role/FTE envelope, iteration timeline, planned FTE, PT/hours/cost, and estimated work assigned to role swimlanes. It evaluates the prototype as a product concept rather than as a production accounting or workforce-management system.

## Review result

The first version proved the core interaction, but four concepts were too closely collapsed: available staffing, planned staffing, task load and commercial budget. That made the calculations technically visible while leaving the manager to infer whether a plan was actually feasible. The polishing pass separates those concepts and makes the important exceptions explicit.

The revised model now answers four different questions without turning them into a synthetic score:

1. **Budget:** does planned role cost fit the resource budget?
2. **Staffing:** does planned FTE fit the role's FTE envelope?
3. **Workload:** do estimated task hours fit the planned capacity for that role and iteration?
4. **Completeness:** how much estimated work is still unassigned?

## Product-perspective review

| Perspective | Baseline finding | Improvement in this pass |
| --- | --- | --- |
| User / job fit | The manager could plan FTE and tasks, but had to mentally compare staffing feasibility. | Added an explicit role **FTE envelope** distinct from planned FTE. |
| Product model | `fteByIteration` represented both what existed and what was planned. | Roles now own a stable envelope; iteration allocations remain the planned consumption. |
| Commercial planning | Total cost and remaining budget were visible, but iteration cost was not. | Added cost to every role/iteration cell and an iteration-level commercial roll-up. |
| Capacity planning | PT/hours were visible per role/cell, but there was no cross-role iteration summary. | Added sticky **Iteration totals** with planned/envelope FTE, PT, hours, cost and task utilization. |
| Decision support | Problems were discoverable only by inspecting cells/KPIs. | Added **Planning checks** for budget, FTE envelope, task overload and backlog. These are conditions, not a health score. |
| Task planning | Tasks could be added/assigned/deleted but not edited. | Added task editing while preserving placement; estimate changes immediately affect capacity checks. |
| Task assignment | Assignment dialog did not show the consequence before saving. | Added projected load, utilization and planned/envelope FTE preview with explicit overload warning. |
| Role lifecycle | Roles could be added and have FTE/rate changed indirectly, but could not be renamed or removed. | Added role settings, envelope/rate/name editing and safe removal that returns tasks to backlog. |
| Keyboard accessibility | Backlog tasks had an assignment button; compact assigned cards lost the equivalent action path. | Assigned cards now expose Move/Edit/Backlog actions and Enter/Space opens assignment. |
| Drag/drop accessibility | Drag/drop had a dialog alternative only from unassigned cards. | All task locations now retain button/keyboard alternatives. |
| Information architecture | The board led directly from six KPIs to a dense matrix. | Added a small exception layer between summary and detailed matrix; iteration roll-up is kept with the matrix. |
| Scannability | Role rows mixed average FTE, totals and a relative scale without showing staffing envelope. | Role summaries now show weighted-average planned FTE, envelope, rate, PT/hours/cost and peak FTE. |
| Calculation clarity | “Capacity” KPI said “assigned hours,” although it represented capacity. | Renamed to **Planned capacity** and corrected supporting copy. |
| Calculation quality | Average FTE treated a short final iteration as equal to a full iteration. | Average FTE is now time-weighted using FTE-weeks. |
| Timeline behavior | CSS assumed eight iterations for minimum width. | Timeline width is content-driven; arbitrary generated iteration counts no longer inherit an eight-column visual floor. |
| Backlog usability | The sidebar becomes slow to scan as task count grows. | Added an unassigned-task title filter with visible filtered/total count. |
| Data safety | Invalid/future local storage fell back to demo and the initial save could immediately overwrite it. | Startup no longer auto-saves the fallback. Invalid stored data is surfaced and remains untouched until the user makes an explicit mutation. |
| Destructive actions | “New resource plan” replaced the workspace after a warning but without a second guard. | Added explicit replacement confirmation when the workspace contains roles/tasks. |
| Import safety | Candidate state was validated before replacement. | Retained; old v1 exports without an FTE envelope are normalized from their existing planned FTE rather than rejected. |
| Responsive behavior | The core layout stacked acceptably; the matrix remained horizontally scrollable. | Planning checks, assignment previews and destructive controls now also adapt at narrow widths. |
| Source maintainability | The first prototype kept all behavior in one large source file. | Split into `core.ts`, `render.ts`, `dialogs.ts`, and a small `app.ts`; each handwritten TS module is below the repository's 400-code-line ceiling. |
| Testability | The first pass had ad-hoc browser smoke evidence only. | Added a repeatable optional Playwright journey covering envelope warnings, overload preview, assignment, keyboard access, filtering and narrow layout. |

## Interaction walkthrough after the pass

### 1. Establish the commercial and planning frame

The manager creates or edits the resource plan with budget, date range, iteration cadence, project-day assumptions and task estimate unit. Changing the calendar explicitly warns that placements may become invalid; affected tasks return to backlog rather than being silently reassigned.

### 2. Define the role envelope

A role now has:

- name;
- day rate in EUR/PT;
- FTE envelope per week;
- planned FTE by iteration.

The envelope describes the role capacity available to this plan. Planned FTE is the amount the resource plan consumes. The prototype allows an intentional over-envelope scenario, but makes it visible at cell, role, iteration and whole-plan levels.

### 3. Plan FTE across iterations

`Plan FTE` still applies one FTE/week value to a contiguous iteration range. The dialog shows the role's envelope and rate and automatically prevents an invalid From/Through ordering. FTE above the envelope is permitted for scenario exploration and flagged after application.

### 4. Read the plan at three levels

The UI now provides three planning resolutions:

- **Plan:** budget, cost, remaining budget, PT/hours, scheduled load and unassigned load.
- **Iteration:** aggregate planned/envelope FTE, PT, hours, cost and task load.
- **Role × iteration:** planned/envelope FTE, PT, hours, cost, task utilization and assigned tasks.

This reduces the need to manually sum the matrix when the manager needs an iteration-level answer.

### 5. Schedule work with consequence preview

Tasks retain a configurable unit and the configured hours/unit approximation. Before assignment, the dialog shows the projected task load and whether it will exceed the chosen role/iteration's planned capacity. Over-allocation is still allowed because the planner is a scenario tool, not a transaction gate.

### 6. Repair the plan

The manager can edit estimates, rename roles, change role envelope/rates, move tasks, return work to backlog, remove roles safely, or change FTE ranges. Planning checks update immediately so repair is observable without introducing a composite score.

## Calculation and domain notes

The current prototype deliberately keeps the original transparent model:

- `PT = planned FTE/week × iteration duration in weeks × working days/FTE week`
- `hours = PT × hours/project day`
- `planned role cost = PT × role day rate`
- `task hours = estimate units × configured hours/unit`

A partial final iteration is still prorated by its calendar-day fraction. This is acceptable for the interaction concept but should not be treated as a payroll or detailed staffing calendar.

The estimate-unit conversion is explicitly a planning approximation. A unit named `SP` does not imply that story points inherently convert to hours.

## Remaining product decisions before production integration

These are intentionally not hidden behind prototype behavior:

- **Multiple plans / scenarios:** the prototype still has one active plan per workspace. Production should decide whether a project owns multiple named resource plans, versions or compareable scenarios.
- **Iteration authority:** the existing Iteration Planner and Capacity Planner should not create competing canonical iteration records. Production integration should share iteration IDs/calendar data or establish one clear upstream owner.
- **Variable role availability:** the FTE envelope is constant per role in this concept. Leave, holidays, onboarding, part-time patterns and iteration-specific availability need a calendar/availability model if required.
- **People versus roles:** this concept intentionally plans roles, not named individuals. Assigning people to the role envelope is a separate staffing problem.
- **Task span:** one task occupies one role × iteration. Multi-role work, work spanning several iterations, splits and dependencies are not yet represented.
- **Actuals and reforecasting:** actual effort/cost, ETC/EAC, time booking and plan-versus-actual are out of scope.
- **Commercial depth:** margin, contingency, non-labor cost, rate changes and role-specific budget buckets are not modeled.
- **Calendar precision:** public holidays, personal absence and exact working-day calendars are not modeled.
- **Collaboration/versioning:** multi-user edits, approvals, plan baselines, audit history and conflict resolution need an explicit product decision.
- **Obsidian persistence:** the production feature still needs the repository's Markdown/frontmatter ownership, paths and canonical entity rules rather than browser local storage.
- **Host theming:** this standalone concept uses its own offline visual system; production should consume the Obsidian/Nuxt UI token pipeline rather than copy these colors verbatim.

## Verification boundary

The pass was exercised as a self-contained browser artifact with Chromium. The journey checks cover baseline rendering, FTE-envelope breach visibility, task estimate editing, overload preview and assignment, keyboard assignment access, backlog filtering and narrow layout. Browser console/page errors are treated as failures.

This review does not claim native Obsidian qualification, multi-user behavior, accounting correctness, calendar correctness or repository-pinned TypeScript qualification. Those require the production integration and the repository's qualified toolchain.
