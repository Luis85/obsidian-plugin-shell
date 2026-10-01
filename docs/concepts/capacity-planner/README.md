# Capacity Planner — self-contained resource-planning prototype

This concept is an additive prototype on PR #62 (`feat/cli-release-journey`) in `Luis85/obsidian-plugin-shell`. It does not change the Companion schema, production runtime, framework configuration, repository quality thresholds, or any retired migration path.

Open `index.html` directly in a current browser. The artifact is self-contained: no remote scripts, fonts, images, APIs, or network requests are required.

See [REVIEW.md](REVIEW.md) for the comprehensive product review, changes made in the polishing pass, and remaining production decisions.

## Scenario

A delivery manager receives a custom-software order with a resource budget and role/FTE envelope. The planner supports this flow:

1. Create a resource plan with name, EUR budget, start/due dates and iteration cadence.
2. Generate the project timeline from that date range.
3. Define roles with day rate and FTE envelope.
4. Apply planned FTE/week to one iteration or a contiguous iteration range.
5. Compare planned FTE with the role envelope and see PT, hours and cost at role, iteration and whole-plan level.
6. Capture tasks using a user-configurable estimation unit and hours/unit planning conversion.
7. Drag tasks to role/iteration cells or use the keyboard/button assignment path with projected-capacity preview.
8. See explicit planning checks for budget, staffing-envelope breaches, task overload and unassigned work.
9. Edit/remove roles and tasks without silently deleting assigned work; role removal returns work to backlog.
10. Export/import the complete prototype workspace as JSON. Local browser storage is best-effort only.

A populated custom-software-delivery example is included so the capacity behavior and warning states are visible immediately.

## Calculation model

- `PT = planned FTE/week × iteration duration in weeks × working days/FTE week`
- `hours = PT × hours/project day`
- `planned role cost = PT × role day rate`
- `task hours = estimate units × configured hours/unit`

The default task unit is `SP`, but the name and hours-per-unit planning conversion are configurable. This is a workload-planning approximation, not a claim that story points inherently convert to hours.

A partial final iteration is prorated by its calendar-day fraction. Holidays, personal absence, overtime, rate bands and exact working calendars are not modeled in this concept.

## Interaction and integrity rules

- A role's **FTE envelope** and its **planned FTE** are separate values.
- Planning above the FTE envelope or assigning tasks above planned capacity is allowed for scenario exploration, but explicitly flagged.
- Roles are swimlanes; lane height scales with total planned role capacity.
- Each role/iteration cell shows planned/envelope FTE, PT, hours, cost, task load and utilization.
- Iteration totals summarize capacity and cost across roles.
- Planning checks are explicit conditions, not a health/productivity score.
- Drag/drop always has button and keyboard alternatives.
- Assigned task cards retain Move, Edit and Backlog actions; Enter/Space opens assignment.
- Changing dates/cadence returns invalid placements to backlog instead of silently remapping them.
- Removing a role returns its assigned tasks to backlog.
- Import validates the complete candidate before replacement.
- Missing `availableFte` in an older v1 export is normalized from its existing planned FTE.
- Invalid/future browser storage is not overwritten automatically during startup fallback.
- User-provided names/titles are escaped before HTML rendering.
- The CSP blocks network connections and uses a generated SHA-256 script hash.

## Source and deterministic build

`index.html` is generated from:

- `source/core.ts` — workspace model, validation, calculations, persistence boundary
- `source/render.ts` — KPIs, planning checks, timeline, iteration/role cells, drag/drop
- `source/dialogs.ts` — plan, role, FTE, task, import/export interactions
- `source/app.ts` — small event/composition entrypoint
- `source/styles.css` — prototype visual system
- `source/frame.html` — offline HTML frame and CSP
- `source/build.mjs` — dependency-free module assembler
- `source/tsconfig.json` — TypeScript check configuration
- `tests/browser_journeys.py` — optional Chromium/Playwright journey

Each handwritten TypeScript module is below the repository's 400-code-line ceiling.

Using the repository-qualified Node/npm/TypeScript versions:

```sh
node docs/concepts/capacity-planner/source/build.mjs
node docs/concepts/capacity-planner/source/build.mjs --check
node node_modules/typescript/bin/tsc --noEmit --project docs/concepts/capacity-planner/source/tsconfig.json
```

Optional browser journey, when Python Playwright and Chromium are provisioned:

```sh
python docs/concepts/capacity-planner/tests/browser_journeys.py
# or set CHROMIUM_PATH=/path/to/chromium
```

Do not substitute a global TypeScript 5.x installation for the repository-pinned TypeScript 6.0.3.

## Verification performed for this pass

Local environment: Node 22.16.0 and Chromium 144.0.7559.96.

Passed:

- deterministic build and `--check`;
- Node strip-types syntax checks for all four TypeScript modules;
- browser journey: baseline 5-role / 8-iteration rendering;
- iteration-total and planning-check rendering;
- deliberate FTE-envelope breach;
- task editing;
- live overload preview and overloaded assignment;
- keyboard assignment from an assigned task;
- unassigned-task filtering;
- narrow/mobile rendering;
- no browser console/page errors.

The available local machine does not provide the repository-qualified Node 24.21.0 + pinned TypeScript 6.0.3 environment, so repository TypeScript qualification remains explicitly **not run** locally.

Generated `index.html` after the polishing pass:

- size: 25,191 bytes
- SHA-256: `35032ff9d95cb63bbd4363d9a08016f72b3a91ba4e019aa354a3987455ba9ceb`

## Scope boundary

This remains a design/interaction concept under `docs/concepts`. It is not a production Companion feature, native Obsidian integration, accounting system, staffing commitment or time-booking system. See `REVIEW.md` for the unresolved production decisions, especially shared iteration authority with the existing Iteration Planner, multi-plan scenarios, calendars/leave, task spanning, actuals/reforecasting and canonical Markdown/frontmatter persistence.