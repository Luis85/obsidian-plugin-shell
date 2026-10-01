# Capacity Planner — comprehensive product review and polishing pass

Review baseline: PR #62, `feat/cli-release-journey`, head `2e5f9295537bd0ca07ff3b400a46ed4168fca7eb` at the start of this pass.

This review treats the concept as a delivery-manager planning surface for a custom-software order: a fixed EUR resource budget, role/FTE envelope, iteration timeline, planned FTE, PT/hours/cost, and estimated work assigned to role swimlanes. It evaluates the prototype as a product concept rather than as a production accounting or workforce-management system.

## Review result

The first version proved the core interaction, but four concepts were too closely collapsed: available staffing, planned staffing, task load and commercial budget. That made the calculations visible while leaving the manager to infer whether a plan was feasible. The polishing pass separates those concepts and makes exceptions explicit.

The revised model answers four different questions without turning them into a synthetic score:

1. **Budget:** does planned role cost fit the resource budget?
2. **Staffing:** does planned FTE fit the role's FTE envelope?
3. **Workload:** do estimated task hours fit planned capacity for that role and iteration?
4. **Completeness:** how much estimated work is still unassigned?

## Product-perspective review

| Perspective | Baseline finding | Improvement |
| --- | --- | --- |
| User/job fit | Staffing feasibility had to be inferred from the same FTE value used for planning. | Added a distinct role **FTE envelope** and planned FTE. |
| Product model | Available staffing and planned consumption were conflated. | Role envelope is stable; iteration allocations represent planned consumption. |
| Commercial planning | Whole-plan budget/cost existed, but iteration cost did not. | Added cost to role/iteration cells and iteration roll-ups. |
| Capacity planning | PT/hours existed per role/cell without a cross-role iteration answer. | Added sticky **Iteration totals** for FTE, PT, hours, cost and task utilization. |
| Decision support | Problems were buried in KPIs or cells. | Added explicit **Planning checks** for budget, FTE envelope, task overload and backlog. |
| Task lifecycle | Tasks could be created/assigned/deleted, not edited. | Added edit while preserving placement; estimate changes recalculate load immediately. |
| Assignment quality | Assignment did not show consequences before save. | Added projected load/utilization and overload preview. |
| Role lifecycle | Roles could be added but not fully maintained. | Added rename/rate/envelope editing and safe removal that returns tasks to backlog. |
| Keyboard/accessibility | Assigned compact cards lost the clear action path available in backlog. | Assigned cards retain Move/Edit/Backlog; Enter/Space opens assignment. |
| Drag/drop | Pointer interaction was primary once work was on the board. | Every location keeps button/keyboard alternatives. |
| Information architecture | Six KPIs flowed directly into a dense matrix. | Added a compact exception layer before the detailed matrix. |
| Scannability | Managers had to scan every cell to find iteration pressure. | Added iteration roll-ups and visible staffing/load warnings. |
| Calculation clarity | A capacity KPI used ambiguous “assigned hours” wording. | Renamed to planned capacity and clarified capacity vs scheduled task load. |
| Calculation quality | Average FTE weighted a partial final iteration like a full iteration. | Average planned FTE now uses FTE-weeks. |
| Timeline scalability | Visual minimum assumed eight iterations. | Timeline width is content-driven for arbitrary generated iteration counts. |
| Backlog scalability | Unassigned work became harder to scan as it grew. | Added title filtering and filtered/total count. |
| Data safety | Invalid/future local storage could fall back to demo and then be overwritten on startup. | Startup does not auto-save fallback state; invalid stored data remains untouched until an explicit mutation. |
| Destructive actions | New-plan replacement had warning copy but no confirmation. | Added explicit replacement confirmation when current work exists. |
| Import safety | Candidate validation existed. | Retained and normalized older v1 exports missing `availableFte`. |
| Responsive behavior | Main layout stacked, but new decision-support surfaces needed narrow behavior. | Added responsive planning checks, previews, and controls. |
| Maintainability | Prototype logic lived in one large source file. | Split into `core.ts`, `render.ts`, `dialogs.ts`, and small `app.ts`; each stays below the repo line ceiling. |
| Testability | Evidence depended on ad-hoc smoke interaction. | Added a repeatable optional Playwright journey. |

## End-to-end experience after the pass

### 1. Establish the planning frame
The manager creates or edits the plan with budget, date range, cadence, project-day assumptions and estimate conversion. Calendar/cadence changes explicitly warn that placements can become invalid; invalid placements return to backlog rather than being silently remapped.

### 2. Define the staffing envelope
Each role has name, EUR/PT rate, FTE envelope/week, and planned FTE by iteration. The envelope describes available capacity for this plan; planned FTE describes what the plan consumes. Intentional over-envelope scenarios are allowed but visible.

### 3. Allocate FTE across ranges
`Plan FTE` applies one planned FTE/week value to a contiguous range. From/Through ordering is guarded. Values above the envelope remain possible for scenario exploration and immediately create warnings.

### 4. Read the plan at three levels
- **Plan:** budget, cost, remaining budget, PT/hours, scheduled load and unassigned load.
- **Iteration:** planned/envelope FTE, PT, hours, cost and task load.
- **Role × iteration:** planned/envelope FTE, PT, hours, cost, utilization and assigned tasks.

This removes the need to manually sum the matrix for common delivery-management questions.

### 5. Schedule work with consequence preview
Tasks use the configured planning unit and hours/unit approximation. Assignment previews projected hours, utilization and staffing envelope before save. Overload remains allowed because this is a planning/scenario tool, not a transaction gate.

### 6. Repair the plan
The manager can edit estimates, rename roles, change rate/envelope, adjust FTE ranges, move tasks, return work to backlog, or remove a role safely. Planning checks update immediately.

## Domain and calculation notes

The prototype deliberately retains a transparent model:

- `PT = planned FTE/week × iteration duration in weeks × working days/FTE week`
- `hours = PT × hours/project day`
- `planned role cost = PT × role day rate`
- `task hours = estimate units × configured hours/unit`

A partial final iteration is prorated by its calendar-day fraction. This is appropriate for an interaction prototype, not payroll or detailed staffing-calendar accuracy. The estimate-unit conversion is explicitly an approximation; a unit named `SP` does not imply story points inherently convert to hours.

## Remaining product decisions before production integration

- **Multiple plans/scenarios:** decide whether a project owns multiple named plans, versions, or comparable scenarios.
- **Iteration authority:** the existing Iteration Planner and Capacity Planner must not create competing canonical iterations. Share iteration IDs/calendar data or establish one upstream owner.
- **Variable availability:** constant role envelopes do not model leave, holidays, onboarding, part-time patterns or iteration-specific availability.
- **People vs roles:** this concept deliberately plans role capacity rather than named individuals.
- **Task span:** one task occupies one role × iteration; multi-role work, splits, spanning, and dependencies remain open.
- **Actuals/reforecasting:** actual effort/cost, ETC/EAC, time booking and plan-vs-actual are out of scope.
- **Commercial depth:** margin, contingency, non-labor cost, rate changes and role-specific budget buckets are not modeled.
- **Collaboration/versioning:** approvals, plan baselines, audit history, simultaneous editing and conflict resolution require explicit design.
- **Obsidian persistence:** production still needs the repository's Markdown/frontmatter ownership, paths and canonical entity rules instead of browser local storage.
- **Host theming:** production should consume the Obsidian/Nuxt UI token pipeline rather than copy the standalone concept colors verbatim.

## Verification boundary

The polished artifact was exercised in Chromium for baseline rendering, FTE-envelope warnings, iteration summaries, task editing, overload preview/assignment, keyboard assignment, backlog filtering, narrow layout, and browser console/page errors. Deterministic build/check and Node strip-types syntax checks passed locally.

This review does not claim native Obsidian qualification, accounting/calendar correctness, multi-user behavior, or repository-pinned TypeScript qualification. Those require the production integration and repository-qualified toolchain.
