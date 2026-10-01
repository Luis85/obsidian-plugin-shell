# Capacity Planner — data-driven resource-planning prototype

This is the self-contained Capacity Planner concept on PR #62 (`feat/cli-release-journey`) in `Luis85/obsidian-plugin-shell`. It models a custom-software order with shared iterations, named people, FTE/cost planning, task ownership/team staffing, allocation, actuals, commercial forecasting, scenarios, baselines and Obsidian-oriented persistence.

Open `index.html` directly in a current browser. It has no remote runtime dependencies.

This pass moves plan creation, plan update and whole-plan JSON exchange behind a planner-engine contract. See [REVIEW.md](REVIEW.md) for the data/code review and `plan.schema.json` for the portable plan document structure.

## Planner engine

The generated artifact exposes `window.CapacityPlannerEngine` with engine version `1`.

The portable boundary is a self-contained `capacity-planner.plan` v1 JSON document containing:

- the complete shared project facts required to understand the plan;
- exactly one resource-plan scenario;
- baselines associated with that plan.

The engine can create/update plans, export a plan document, serialize it to JSON, parse/validate that same JSON, open it as a standalone workspace, or add it to a compatible current project.

The UI exposes this under **Manage -> Plan engine JSON -> Export whole plan / Import whole plan**. Workspace JSON remains available separately for backing up all scenarios and audit history.

## Create/update reliability

New plan and Plan settings no longer mutate live scenario objects directly. They:

1. create a prospective workspace through the engine;
2. validate the complete cross-entity model;
3. replace live state only after validation succeeds;
4. commit an audit revision and persistence attempt;
5. render and verify the selected plan.

Numeric inputs use range validation with `step="any"`; arbitrary valid monetary/FTE/percentage precision is no longer rejected by presentation-only increments. Invalid forms keep the dialog open, focus the invalid field and announce the field/range problem instead of looking like a no-op.

## Planning semantics

The planner continues to keep these concepts separate:

1. **Scope** — estimated versus allocated task hours.
2. **Capacity** — planned role/person hours.
3. **Staffing** — named people, availability and unresolved role-level work.
4. **Commercials** — actual + allocated/covered forecast cost and margin.

A plan with unallocated scope reports a **Covered forecast** rather than claiming a complete EAC.

## Source

```text
source/
├── app.ts
├── build.mjs
├── core.ts
├── engine.ts
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

tests/
├── browser_journeys.py
├── engine_contract.py
├── interaction_matrix.py
├── plan_schema.py
└── static_actions.py
```

All handwritten TypeScript modules remain below the repository's 400-code-line ceiling.

## Build and checks

Using the repository-qualified toolchain:

```sh
node docs/concepts/capacity-planner/source/build.mjs
node docs/concepts/capacity-planner/source/build.mjs --check
node node_modules/typescript/bin/tsc --noEmit --project docs/concepts/capacity-planner/source/tsconfig.json
python docs/concepts/capacity-planner/tests/static_actions.py
python docs/concepts/capacity-planner/tests/engine_contract.py
python docs/concepts/capacity-planner/tests/interaction_matrix.py
python docs/concepts/capacity-planner/tests/plan_schema.py
python docs/concepts/capacity-planner/tests/browser_journeys.py
```

Do not substitute a global TypeScript 5.x installation for the repository-pinned TypeScript 6.0.3.

## Verification focus for this pass

The local prototype gates cover:

- engine create and update transactions independently from dialogs;
- engine JSON stringify -> parse -> validate -> open round trip;
- whole-plan JSON export/import through the UI;
- New plan creation with arbitrary valid decimal values;
- Plan settings update and reread of saved values;
- explicit invalid-form feedback rather than dead-looking submission;
- all delegated actions represented in behavioral journeys;
- scenario duplicate/archive/open state refresh;
- non-labor remove state refresh;
- plan-first UI, task teams, allocations, actuals, commercials, baselines, audit and persistence;
- deterministic generated HTML;
- no browser console/page errors.

Local evidence uses the available Node/Chromium/Python environment and is prototype evidence, not a claim of the repository-qualified Node 24.21.0 / TypeScript 6.0.3 gate.

## Scope boundary

This remains a `docs/concepts` artifact. Native Obsidian writes, real collaboration/authorization, external HR/calendar/time-booking/finance integrations and production-scale virtualization belong to the implementation architecture. The production Vue/Pinia UI should consume the planner engine/domain contract rather than copy the standalone dialog implementation.
