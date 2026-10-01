# Capacity Planner — data and code review / polishing pass

Review baseline: PR #62, `feat/cli-release-journey`, head `109ee0c2c2db473191aef89e42d57a90d240f489` at the start of this pass.

This pass focuses on the planner as a **data-driven engine** rather than adding another layer of UI. The requested outcomes were whole-plan JSON export/import, self-produced JSON as valid engine input, reliable New plan / Plan update behavior, and a full interaction audit.

## Review result

The existing domain model was already richer than the first prototype, but state-changing behavior still lived primarily in dialog callbacks. That had three weaknesses:

1. create/update correctness was coupled to the form path rather than a reusable domain operation;
2. workspace JSON was available, but there was no explicit portable **one whole plan** contract;
3. static action wiring could prove that a button had a handler without proving that the interaction updated state and the visible flow correctly.

The pass separates those concerns.

## High-impact findings and changes

| Perspective | Finding | Improvement |
| --- | --- | --- |
| Planner engine | Plan creation/update directly mutated UI state in the dialog layer. | Added `engine.ts`; create/update now clone → apply → validate → return a new workspace. |
| Data portability | Workspace JSON contained all scenarios but was not a clear one-plan integration boundary. | Added `capacity-planner.plan` v1: complete project facts + exactly one plan + its baselines. |
| Machine contract | The plan format existed only as runtime validation. | Added Draft 2020-12 `plan.schema.json` plus a generated-plan schema test. |
| Round trip | Exported data was not explicitly tested as direct engine input. | Engine contract now tests stringify → parse → validate → open and add-to-project round trips. |
| UI reliability | New plan / update could appear inert when native numeric `step` constraints rejected a valid business value before the callback ran. | Numeric controls use `step="any"`; meaningful ranges/domain validation remain explicit. |
| Validation UX | `reportValidity()` failure did not explain why Save/Create stayed open. | Invalid submission focuses the offending field and announces its label/range problem. |
| New plan | Correctness depended on a dialog callback mutating the active workspace. | `createPlan()` returns a validated new workspace and selected plan ID; UI applies it atomically. |
| Plan update | Existing scenario objects were edited in place. | `updatePlan()` validates a prospective workspace before live-state replacement. |
| Import semantics | “Import JSON” could mean workspace replacement or scenario import. | Whole-plan import explicitly chooses **Add to compatible project** or **Open standalone**. Workspace backup remains separate. |
| Cross-project safety | A plan could otherwise be merged into unrelated project facts. | Add mode requires matching `project.id`; incompatible plan docs can only be opened standalone. |
| Interaction quality | Duplicate/archive changed state behind an open stale Plans dialog. | Those actions now close stale management UI after changing/opening the active plan. |
| Interaction quality | Removing a non-labor cost left the deleted row visible. | Commercials refreshes immediately after removal. |
| Test strategy | Static wiring was stronger than behavioral action coverage. | Added an interaction matrix covering edit/remove/restore/duplicate/archive/open flows in addition to the main journey. |
| Engine observability | Domain operations were internal implementation details. | Generated prototype exposes frozen `window.CapacityPlannerEngine` for contract testing/integration exploration. |
| Code organization | Data exchange logic was mixed with persistence/UI concerns. | Plan-domain operations live in `engine.ts`; file download/Markdown remains in `persistence.ts`. |

## Data contract

The portable document identity is:

```text
schema  = capacity-planner.plan
version = 1
engine  = capacity-planner / 1
```

It contains:

- `project` — shared iterations, calendar, roles, people/availability, tasks/teams, actuals and project/persistence metadata;
- `plan` — one scenario's FTE/rate plans, allocations, budget, contingency, target margin and non-labor costs;
- `baselines` — snapshots associated with that plan.

This is intentionally different from `capacity-planner.workspace` v2, which is multi-plan browser/application state.

`plan.schema.json` provides structural validation. Engine validation adds semantic cross-reference checks that JSON Schema alone does not express.

## Engine operations

The public engine surface supports:

- `createPlan`
- `updatePlan`
- `exportPlanDocument`
- `stringifyPlanDocument`
- `parsePlanJson`
- `validatePlanDocument`
- `workspaceFromPlanDocument`
- `addPlanDocument`

All mutation-style engine calls operate on clones. Invalid results are rejected before the UI receives a replacement workspace.

## Whole-plan import semantics

### Open standalone

Uses the project facts carried by the JSON and creates a fresh workspace containing exactly that resource plan. This is the strongest round-trip interpretation: the file is self-contained.

### Add to current project

Reuses the current project's shared facts and imports the scenario as another plan. This requires a matching project identity and passes the imported scenario through the current project's complete reference validation. Incompatible data is rejected rather than silently merged.

## No-op root cause and prevention

A visible control can be wired and still appear to do nothing when browser constraint validation prevents its submit callback from running. Earlier numeric controls encoded presentation increments that were not actual domain rules.

The UI contract now matches the domain contract:

- monetary, percentage, FTE, hours and estimate inputs accept arbitrary numeric precision through `step="any"`;
- meaningful `min`/`max` constraints remain;
- engine/domain validation remains authoritative;
- invalid submissions announce which field/range needs correction and keep focus in the form.

The browser journey intentionally creates and updates a plan using non-round decimal values, then deliberately enters an out-of-range value and verifies visible feedback instead of a dead-looking submit.

## Interaction audit

The visible action inventory is covered in two layers:

1. `static_actions.py` fails when a rendered `data-action` or static button lacks a handler or behavioral-test reference.
2. `browser_journeys.py` + `interaction_matrix.py` exercise every delegated action path, including secondary edit/remove/restore/duplicate/archive/open actions.

Coverage includes plan create/update, roles, FTE/rates, people/availability, task/team edits, allocation edit/remove, actuals, non-labor add/edit/remove, baseline create/approve/restore, scenario activate/duplicate/archive, comparison, audit, persistence, whole-plan JSON, workspace JSON and Markdown output.

`engine_contract.py` separately proves the planner contract without relying on form mutation code. `plan_schema.py` validates an actual engine-exported document against the checked-in JSON Schema.

## Production implementation seam

The prototype now has a clearer architecture seam:

```text
Vue / Nuxt UI / Obsidian views
            ↓
       Pinia actions
            ↓
   planner engine/domain
            ↓
Markdown / vault / integrations
```

The standalone browser still uses `localStorage` plus download/upload adapters, but create/update/validate/round-trip semantics no longer depend on those adapters.

## Remaining boundaries

- The engine is a prototype contract, not yet a separately published package.
- Production needs exported TypeScript interfaces and repository-pinned TypeScript 6 qualification.
- Native Obsidian persistence should replace browser storage/download adapters.
- Collaboration, locking and external system synchronization remain implementation concerns.
- Large portfolio datasets will require production indexing/virtualization.

No retired Companion schema or migration path is reintroduced by this work.
