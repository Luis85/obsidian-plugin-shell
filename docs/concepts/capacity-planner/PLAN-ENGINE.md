# Capacity Planner engine and JSON contract

The standalone prototype exposes a small planner engine so the planning model is not coupled to dialog state or browser storage.

The engine is available from the generated prototype as `window.CapacityPlannerEngine` and the same source lives in `source/engine.ts`.

## Contract versions

- Engine: `capacity-planner` version `1`
- Whole-plan document: `capacity-planner.plan` version `1`
- Browser workspace: `capacity-planner.workspace` version `2`

The **plan document** is the portable data-driven boundary. `plan.schema.json` supplies a Draft 2020-12 JSON Schema for structural/tooling validation in addition to the engine's semantic cross-reference validation. The **workspace** is application state and may contain several scenarios, audit history and UI-oriented persistence context.

## Whole-plan JSON

A whole-plan export contains all facts required to interpret exactly one resource plan:

```json
{
  "schema": "capacity-planner.plan",
  "version": 1,
  "engine": { "name": "capacity-planner", "version": 1 },
  "exportedAt": "2026-10-01T20:00:00.000Z",
  "project": {
    "id": "project-demo",
    "iterations": [],
    "roles": [],
    "people": [],
    "tasks": [],
    "actuals": []
  },
  "plan": {
    "id": "scenario-baseline",
    "name": "Baseline Delivery Plan",
    "rolePlans": {},
    "allocations": [],
    "nonLaborCosts": []
  },
  "baselines": []
}
```

`project` contains shared facts: calendar/iterations, roles, people/availability, tasks/ownership, actuals and the commercial project frame. `plan` contains scenario assumptions: FTE/rates, task allocation slices, budget, contingency, margin target and non-labor costs.

## Round-trip guarantee

The supported round trip is:

```text
workspace
  -> exportPlanDocument(...)
  -> stringifyPlanDocument(...)
  -> JSON text
  -> parsePlanJson(...)
  -> validatePlanDocument(...)
  -> workspaceFromPlanDocument(...)
```

The engine contract test performs this sequence against the built prototype. A document produced by engine v1 is valid input for engine v1 unless it has been corrupted or altered into an invalid cross-entity state.

The UI exposes the same operations as **Manage -> Export whole plan** and **Manage -> Import whole plan**.

## Import modes

A plan document can be consumed in two ways:

1. **Open as standalone workspace** — uses the project facts contained in the plan document and creates a workspace containing that one plan.
2. **Add as another plan** — available when the imported `project.id` matches the current project. Current shared project facts remain authoritative; the imported scenario is accepted only if all of its references are compatible with them.

No incompatible shared data is merged silently.

## Engine API

`CapacityPlannerEngine` exposes:

- `createPlan(workspace, input)`
- `updatePlan(workspace, planId, patch)`
- `exportPlanDocument(workspace, planId)`
- `stringifyPlanDocument(document)`
- `parsePlanJson(jsonText)`
- `validatePlanDocument(document)`
- `workspaceFromPlanDocument(document)`
- `addPlanDocument(workspace, document, options)`

Create and update are pure transaction-style operations: they clone the input workspace, apply the requested change, validate the resulting complete model, and return a new workspace. Invalid input throws before the caller replaces live application state.

## Validation invariants

The engine/workspace validators enforce, among other rules:

- unique identities for core entities;
- valid project, iteration, role, person and task references;
- person-to-role consistency;
- task owner/assignee references;
- positive allocation/actual hours;
- allocation totals not exceeding a task estimate;
- valid FTE/rate/cost numeric ranges;
- valid non-labor cost values;
- an existing active resource plan.

UI number inputs deliberately use `step="any"`. Business ranges are enforced by `min`/`max` plus engine validation rather than arbitrary display increments.

## Persistence semantics

A successful engine operation becomes durable only when the UI commits the returned workspace. Browser `localStorage` is a convenience adapter, not the domain store. When browser storage is unavailable, the explicit Save action downloads a workspace JSON backup rather than pretending persistence succeeded.

Production integration should invoke the same engine/domain operations from the Vue/Pinia/Obsidian persistence layer instead of reproducing dialog mutation logic.
