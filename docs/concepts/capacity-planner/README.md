# Capacity Planner — resource planning, scenarios, staffing and reforecasting prototype

This concept is additive work for PR #62 (`feat/cli-release-journey`) in `Luis85/obsidian-plugin-shell`. It stays under `docs/concepts/capacity-planner` and does not change the Companion schema, production runtime, repository thresholds, or any retired Companion migration path.

Open `index.html` in a current browser. The artifact is self-contained and offline: no remote scripts, fonts, images, APIs or network requests are required.

## What this iteration covers

The Capacity Planner now models the full planning loop requested for a custom-software order:

1. One **project** owns canonical iterations, roles, people, tasks, holidays, actuals and persistence settings.
2. A project owns multiple named **resource plans / scenarios**. New plans can be blank or cloned from the active plan; switching plans never duplicates canonical project facts.
3. Iterations have one explicit authority: Capacity Project or upstream Iteration Planner. Scenarios reference shared iteration IDs and never own competing dates.
4. Named people are assigned to roles. Working weekdays, project holidays, leave and per-iteration FTE overrides derive actual role availability.
5. Scenario staffing plans planned FTE and optional iteration-specific rate overrides against that people-derived availability.
6. Tasks can be split across several role × iteration × person allocations. Remaining estimate stays visible until fully allocated.
7. Project actuals are recorded against allocations and are shared across every scenario. Forecasting separates actual cost, remaining allocated work (ETC) and EAC/forecast.
8. Commercial planning includes order value, resource budget, contingency, target margin, non-labor planned/actual costs, rate changes and role budget buckets.
9. Baselines are immutable snapshots. They can be approved, compared with the live plan and restored only as a new scenario.
10. Every mutation increments a revision and writes an audit entry. Imports compare revision tokens and follow the configured conflict policy.
11. Obsidian persistence settings define canonical target paths. The prototype exports those entities as a real Markdown ZIP with frontmatter rather than pretending browser local storage is native vault persistence.
12. UI colors consume Obsidian-style host tokens first, with offline fallbacks for the standalone prototype.

## Save behavior and no-op prevention

The prototype now has an explicit **Save** button. Mutating actions also autosave when browser storage is available.

If browser storage is unavailable, Save is not a dead control: it downloads a complete workspace JSON backup. The dialog helper no longer uses `method="dialog"`; every Create/Save/Apply action uses a normal submit handler, native validity checks, an explicit state mutation and an observable success result.

Two regressions guard this:

- `tests/browser_journeys.py` exercises the main product flows, downloads and dynamic action buttons in Chromium.
- `tests/static_actions.py` fails if a rendered `data-action` has no delegated handler or a static button has no listener.

## Calculation model

Availability is based on exact project working dates:

- project weekdays minus project holidays;
- person base FTE or iteration override;
- minus working-day leave;
- summed to a role envelope when named people exist;
- otherwise the role's manual fallback FTE is used.

Scenario planning uses:

- `planned PT = planned FTE × project working days in iteration`;
- `planned hours = PT × hours/project day`;
- `planned labor cost = PT × iteration rate (override or role default)`;
- `task estimate hours = units × configured hours/unit`;
- `ETC = max(allocated task hours − actual hours, 0)` at role/iteration level;
- `forecast internal cost = actual labor + ETC labor + forecast non-labor`;
- `forecast incl. contingency = forecast internal cost × (1 + contingency%)`;
- `forecast margin = order value − forecast incl. contingency`.

The estimate-unit conversion remains an explicit planning approximation. A unit named `SP` does not claim that story points intrinsically convert to hours.

## Source

`index.html` is built deterministically from:

- `source/core.ts` — workspace model, revisions, persistence boundary and shared timeline data
- `source/metrics.ts` — calendar availability, staffing, allocation, actual and forecast calculations
- `source/persistence.ts` — JSON import/export, revision conflict policy, Markdown/frontmatter generation and ZIP packaging
- `source/render.ts` — KPIs, planning checks, task backlog, capacity matrix and baseline comparison
- `source/dialogs-common.ts` — normal-form dialog lifecycle and validation
- `source/dialogs-plan.ts` — plans/scenarios and canonical timeline authority
- `source/dialogs-team.ts` — roles, people, leave, availability, FTE and rate planning
- `source/dialogs-work.ts` — tasks, multi-slice allocation and actuals
- `source/dialogs-governance.ts` — commercials, baselines, audit, comparison and Obsidian persistence
- `source/app.ts` — action routing and composition
- `source/styles.css` / `source/frame.html` — standalone shell using host-token fallbacks
- `source/build.mjs` — dependency-free deterministic assembler
- `tests/browser_journeys.py` / `tests/static_actions.py` — behavior and no-op regression checks

Every handwritten TypeScript module remains below the repository's 400-code-line ceiling.

## Build and verify

Using the repository-qualified toolchain:

```sh
node docs/concepts/capacity-planner/source/build.mjs
node docs/concepts/capacity-planner/source/build.mjs --check
node node_modules/typescript/bin/tsc --noEmit --project docs/concepts/capacity-planner/source/tsconfig.json
python docs/concepts/capacity-planner/tests/static_actions.py
python docs/concepts/capacity-planner/tests/browser_journeys.py
```

Do not substitute global TypeScript 5.x for the repository-pinned TypeScript 6.0.3.

## Verification for this pass

Local environment: Node 22.16.0, Python 3.13.5, Chromium 144.

Passed:

- deterministic build and byte-for-byte `--check`;
- all ten TypeScript modules through Node's strip-types/assembly path;
- static action wiring: every delegated action and every static button has a handler;
- explicit Save fallback download when storage is unavailable;
- New plan creation and plan settings persistence;
- canonical timeline/project save and upstream Iteration Planner authority switch;
- role creation, named-person staffing and per-iteration availability;
- FTE planning and rate override;
- task creation, split allocation, drag/drop allocation and actuals;
- commercial non-labor cost planning;
- baseline creation, approval and restore-as-new-plan;
- plan comparison, duplication/archive management and scenario switching;
- audit/revision history;
- persistence path save and Markdown ZIP export;
- workspace JSON export and import file-chooser wiring;
- narrow/mobile rendering;
- no browser console/page errors.

Local Node is not the repository-qualified Node 24.21.0 and the local environment does not provide the pinned TypeScript 6.0.3 package, so repository TypeScript qualification remains explicitly not claimed locally.

Generated artifact for this pass:

- size: 41,233 bytes
- SHA-256: `337e488d7805bf6a7a219e895264abba5fb5786cb4f4cb2a99848ef61f8653d0`

## Scope boundary

This is still a design/interaction concept, not production vault code. It now makes the product decisions and persistence contract concrete, but native Obsidian writes, real integration with an installed Iteration Planner, multi-process conflict detection and repository-qualified runtime behavior belong to the implementation phase. The prototype does not claim payroll/accounting correctness or replace an ERP/time-booking system.
