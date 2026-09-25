# Research-led detail-editor improvement and polishing receipt

## Scope and identity

Built on PR #5 head `552a9449e0814322dc67fbe8d452214fb3b0e6a2`
(tree `376eee62da6c0ba08e45e82c0d2f3079918cb5f0`). The
[research report](DETAIL-EDITORS-RESEARCH.md) contains the comparative sources,
observed audit findings, needs hypotheses and 24 requirements. The
[editor guide](DETAIL-EDITORS.md) describes operation.

| Current artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `index.html` | 1,735,105 | `9e128db2bafacab94331ebea7b47edbfa05b4a5c8d33c9422c0225b41f648be8` |
| `companion-project.json` (unchanged) | 181,846 | `113d5fcc481e542ed9aac4fb08575ad5f705015e0706de0c4f849f271cb55bf6` |

This is a browser companion improvement, not a native conversion or a generated
implementation of its described behaviors. The portable schema remains v3.
Dependencies, vendor bytes, package files, production quality thresholds and the
shell generator are unchanged.

## Implemented changes

- Typed instance text/boolean/number controls, value provenance, individual
  Override/Use default/Remove override actions, and opt-in Advanced JSON repair.
- Retained local values when switching a definition; invalid combinations block
  Save. Mismatched contract versions and missing variants never borrow defaults.
- Page and structure search with ancestor context, one Outline tree and clickable
  ancestry. Search preserves focus and does not mutate saved design.
- Direct component usage with exact-instance navigation and restoration of the
  previous representation, search and preview context on Back.
- Advisory Review view with targeted repair links and ancestor-aware local state
  counts. Counts exclude expanded reusable internals; zero findings is not proof.
- Read-only deterministic Markdown design briefs with escaped authored text,
  stable IDs, reading order, properties/origins, source declarations, interaction
  intent and acceptance notes. Full JSON remains the editable transfer format.
- Selected-mode/state styling, explicit zoom controls, readable event labels,
  recognizable primitive controls, responsive review/property views and consolidated
  CSS rather than a second layer of duplicated overrides.

The old instance-property save/rollback pipeline is retained. New UI controls
edit its draft, not an alternate store. Shared definitions remain references, not
copies. No binding provider, imported expression or described interaction runs.

## Direct audit and visual evidence

The baseline detail suite was actually executed before changes: 50 assertions
passed. Its screenshots were retained separately before later runs. The observed
baseline lacked typed local controls, search, direct usage and a consolidated
review route. Its definition selector cleared props; current-default inheritance
was insufficiently version-bound. These are product/source observations, not
claims about how many customers experience them.

The new browser suite captures the real search, typed form, component review,
error preview, light/dark canvas and narrow review/form. The saved images were
visually inspected for target correctness, readable controls, selected modes,
connection-label treatment and horizontal overflow. Narrow modal fields remain
scrollable with Save/Cancel visible. Screenshots do not establish screen-reader,
real touch-device or native Obsidian compliance.

Reproducible capture locations:

- Existing detail captures: `reports/concepts/details/`.
- New captures and actual brief download: `reports/concepts/detail-polish/`.
- Full suite summaries: `reports/concepts/browser-summary.json`.

## Executed local verification

| Check | Result and scope |
| --- | --- |
| Complete browser regression | **1,043 named assertions in 19 non-storage suites passed**, including 50 original detail checks and 34 new polishing checks |
| Node detail/full-project/Storymaps/CLI/test-data suites | **128 tests passed**, including 55 detail-contract/derived-view tests |
| Project generator | **30 tests passed**; the generator itself is unchanged |
| Assembly and inventory | **12 tests passed**, retaining exact output and orphan/tamper rejection |

The browser total includes the focused cases; do not add them again. Assertions
include actual pointer/form/control journeys and explicitly scoped fixtures, not
1,043 independent user journeys. Reports match the HTML hash above and record no
observed browser errors, fatal failures or unexpected requests.

New tests verify false/zero/empty-text semantics; malformed literal rejection;
matching-version inheritance; definition-swap retention and blocked Save; reset
isolation and history; exact usage navigation and Back; search focus and ancestry;
state counts under hidden parents; actionable findings; escaped deterministic
briefs; actual Markdown download; zoom without semantic writes; readable label
styles; and narrow layouts.

Local Node was 22.16.0, supplementary to the repository's hosted toolchain. The
local browser uses an explicitly scoped in-memory Storage adapter. **Actual
HTTP-origin storage, two-window conflicts, the full dependency-backed analyzer,
production lint/typecheck/coverage and native host acceptance are separate gates.**
Their current-head results belong to the PR's hosted Checks, not this local receipt.
No unavailable check is relabeled as passing.

## Pre-existing CI inventory failure addressed

The baseline Showcase/setup/template verification stopped at
`tests/tooling/companion-boundaries.checks.mjs`, whose exact expected count remained
115 although the previous detail increment added eight inputs, yielding 123.
The failure was read in hosted Showcase run `36110424890`, job `107992415410`.
This pass adds four explicitly inventoried modules, making the correct count 127,
and asserts the shared detail-contract entry. Extra-file rejection remains intact.
This fixes the identified assertion; only subsequent hosted runs can establish
that no later gate fails.

## Reproduction

```sh
python3 scripts/concepts/build-companion.py --check
python3 -B tests/concepts/companion-assembly.test.py
node --test tests/tooling/companion-details.checks.mjs \
  tests/tooling/companion-project.checks.mjs \
  tests/tooling/companion-storymaps.checks.mjs \
  tests/tooling/test-data-*.checks.mjs
npm run test:generator
python3 scripts/concepts/run-browser-checks.py --real-storage
```

Hosted CI provisions isolated pinned browser tooling. The usual full repository
verification retains its existing gates; no temporary delivery files are part of
the feature tree.

## Remaining requirements

Richer layout/padding/gap/sizing/breakpoint contracts, Design System token binding,
instance slot-content mapping, immutable component revision snapshots, transitive
impact analysis, side-by-side variant frames, fixture-driven previews and executable
interaction test generation are **not implemented by this polishing pass**.
The research identifies them explicitly. Native conversion and user/assistive-
technology studies remain unexecuted. No PR merge, force push or release is part
of this increment.
