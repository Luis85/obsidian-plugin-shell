# Capacity Planner — self-contained resource-planning prototype

This concept is an additive prototype for PR #62 (`feat/cli-release-journey`) in `Luis85/obsidian-plugin-shell`. It does not change the Companion schema, production runtime, framework configuration, repository quality thresholds, or any removed legacy/migration path.

Open `index.html` directly in a current browser. The artifact is self-contained: no remote scripts, fonts, images, APIs, or network requests are required.

## Scenario

A delivery manager receives a custom-software order with a budget and a role/FTE envelope. The planner supports the following flow:

1. Create a resource plan with name, EUR budget, start/due dates and iteration cadence.
2. Generate the project timeline from that date range.
3. Add delivery roles and assign FTE/week over one iteration or a contiguous iteration range.
4. See the resulting project days (PT), hours and planned role cost per role, per iteration and for the whole plan.
5. Capture tasks with an estimate in a configurable planning unit.
6. Drag tasks from the backlog to role/iteration cells, move them between cells, or use the accessible **Assign** dialog.
7. Compare scheduled task load with role capacity and surface overloaded cells without treating utilization as a productivity score.
8. Export/import the complete prototype workspace as JSON. Local browser storage is best-effort only.

A populated custom-software-delivery example is included so the capacity behavior is visible immediately.

## Calculation model

The prototype uses explicit, editable assumptions rather than implicit conversions:

- `PT = FTE/week × iteration duration in weeks × working days/FTE week`
- `hours = PT × hours/project day`
- `planned role cost = PT × role day rate`
- `task hours = estimate units × configured hours/unit`

The default task unit is `SP`, but both its name and the hours-per-unit planning conversion are configurable. This is a workload-planning approximation, not a claim that story points inherently convert to hours.

Calendar holidays, personal absence, partial-day calendars, overtime, rate bands, role-specific working calendars and commercial contingencies are not modeled in this first concept. Partial final iterations use their actual calendar-day fraction.

## Interaction and UI rules

- Roles are swimlanes; each lane's height scales relative to that role's total allocated capacity.
- Every role/iteration cell shows FTE, PT, hours, task load and utilization.
- Capacity overload is expressed with text/value changes in addition to color.
- Drag/drop has a button/dialog alternative for keyboard and assistive-technology use.
- The timeline scrolls horizontally at narrow widths while project summary and backlog remain usable.
- User-provided names/titles are escaped before rendering.
- Import validates the complete candidate before replacing in-memory state.
- The CSP blocks network connections and uses a generated SHA-256 script hash.

## Source and deterministic build

`index.html` is generated from the supplied source:

- `source/app.ts` — interaction/state/calculation logic
- `source/styles.css` — prototype visual system
- `source/frame.html` — offline HTML frame and CSP
- `source/build.mjs` — dependency-free assembler
- `source/tsconfig.json` — TypeScript check configuration

From the repository root, using the versions required by the root `AGENTS.md`:

```sh
node docs/concepts/capacity-planner/source/build.mjs
node docs/concepts/capacity-planner/source/build.mjs --check
node node_modules/typescript/bin/tsc --noEmit --project docs/concepts/capacity-planner/source/tsconfig.json
```

Do not substitute a global TypeScript 5.x installation for the repository-pinned TypeScript 6.0.3.

## Local verification performed before publication

The artifact was assembled and checked deterministically. A Chromium smoke journey exercised:

- initial 8-iteration / 5-role sample rendering;
- contiguous iteration-range FTE editing;
- task creation and button-based assignment;
- drag/drop reassignment;
- configurable estimate unit name and conversion;
- deliberate zero-capacity overload detection;
- JSON export;
- narrow/mobile layout rendering;
- absence of browser console/page errors.

Local evidence environment: Node 22.16.0 and Chromium 144.0.7559.96. This is useful prototype evidence but is **not** the repository's qualified Node 24.21.0 environment. The local machine exposed only global TypeScript 5.8.3, so the TypeScript check was deliberately **not run**; it must use the repository-pinned TypeScript 6.0.3 in the checkout/hosted qualification.

Generated `index.html` before publication:

- size: 43,752 bytes
- SHA-256: `fa2882f1811ba46ae513fdfb919fc752ccf28b852d00bbff648b2950fb4ee6d8`

## Scope boundary

This is a design/interaction concept under `docs/concepts`. It is not yet a production Companion feature, a native Obsidian integration, a project accounting system, or a staffing commitment. Persistence, Markdown/frontmatter ownership, integration with the existing Iteration Planner, calendars/holidays, rates, actuals, leave, scenario comparison and multi-user conflict handling remain later product decisions.
