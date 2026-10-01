# Capacity Planner — plan-first resource planning prototype

This is the self-contained Capacity Planner concept on PR #62 (`feat/cli-release-journey`) in `Luis85/obsidian-plugin-shell`. It models a custom-software order with shared iterations, named people, role/FTE planning, task ownership/team staffing, task allocation, project actuals, commercial forecasting, scenarios, baselines and Obsidian-oriented persistence.

Open `index.html` directly in a current browser. It has no remote runtime dependencies.

See [REVIEW.md](REVIEW.md) for the comprehensive product review and this pass's findings.

## Core planning questions

The prototype separates four questions instead of compressing them into one score:

1. **Scope:** how much estimated work exists, and how much is allocated?
2. **Capacity:** how much role/person capacity is actually available and planned?
3. **Staffing:** which work still lacks enough named people or breaches availability?
4. **Commercials:** what cost/margin is supported by the currently allocated scope?

## Important forecast rule

A plan with unallocated scope does **not** claim a complete EAC.

It shows:

- estimated scope hours;
- allocated scope hours;
- allocation/forecast coverage;
- unallocated and therefore unpriced hours;
- a **Covered forecast / Covered margin** until coverage reaches 100%.

The sample data contains 546 h estimated scope, 456 h allocated and 90 h open, so forecast coverage is 83.5%.

## Task staffing

A task has:

- one optional accountable owner;
- many assigned people;
- one or more allocation slices across roles, iterations and people.

The owner is always part of the task team. Selecting another person while allocating work adds them to the team. Role-level allocations without a named person are allowed for early planning but remain visible as an incomplete staffing decision.

## Actuals and reforecasting

Actual effort is a project fact shared by every resource-plan scenario. Each actual entry snapshots its EUR/PT rate at booking time so historical actual cost cannot change when another scenario uses different future rates.

Scenario rate overrides continue to drive planned/ETC cost.

## UI hierarchy

The default desktop flow is intentionally compact:

`command bar → active plan strip → current capacity plan`

Summary remains collapsed until requested. The plan board highlights the current/next/latest iteration and provides one compact control to jump back to it after horizontal scrolling.

## Source

```text
source/
├── app.ts
├── build.mjs
├── core.ts
├── metrics.ts
├── persistence.ts
├── render.ts
├── dialogs-common.ts
├── dialogs-plan.ts
├── dialogs-team.ts
├── dialogs-work.ts
├── dialogs-governance.ts
├── dialogs-navigation.ts
├── frame.html
├── styles.css
└── tsconfig.json
```

All handwritten TypeScript modules remain below the repository's 400-code-line ceiling.

## Build and checks

Using the repository-qualified toolchain:

```sh
node docs/concepts/capacity-planner/source/build.mjs
node docs/concepts/capacity-planner/source/build.mjs --check
node node_modules/typescript/bin/tsc --noEmit --project docs/concepts/capacity-planner/source/tsconfig.json
python docs/concepts/capacity-planner/tests/static_actions.py
python docs/concepts/capacity-planner/tests/browser_journeys.py
```

Do not substitute a global TypeScript 5.x installation for the repository-pinned TypeScript 6.0.3.

## Browser/product verification in this pass

Verified locally with the self-contained artifact:

- compact plan-first UI and collapsible summary;
- correct scope/allocated/capacity math;
- covered-forecast semantics for incomplete scope;
- FTE/person availability and overload conditions;
- task owner + many assigned people;
- split allocations and role-level staffing warnings;
- actual booking with snapshotted rate;
- scenario creation/switching/comparison;
- baseline/audit/commercial/persistence flows;
- current/next iteration navigation;
- keyboard access to backlog and allocated work;
- dialog focus restoration;
- JSON exchange;
- Markdown ZIP output including project actuals;
- no-op/static action coverage;
- no browser console/page errors.

Local evidence uses the available Node/Chromium/Python environment and is prototype evidence, not a claim of the repository's qualified Node 24.21.0 / TypeScript 6.0.3 gate.

## Scope boundary

This remains a `docs/concepts` interaction prototype. Native vault writes, real collaboration/permissions, external HR/calendar/time-booking/finance integrations and production-scale virtualization belong to the implementation architecture, not the standalone browser concept.
