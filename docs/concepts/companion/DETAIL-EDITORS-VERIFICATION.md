# Detail editors — verification receipt

## Identity and scope

Built on PR #5 head `1637ecdd547d71ddecc05beb06a82a4dfc87ce27`, whose tree is
`a8db94912c856a0bca43720ad1a06ecae927e38c`. This is the browser companion concept,
not a native plugin conversion or a generated implementation of designed behavior.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `index.html` | 1,710,364 | `b8b4a28bdbb040ef5dd2ba6c44283a195e168b5c4fd687977a6a4fb7ee952b3f` |
| `companion-project.json` | 181,846 | `113d5fcc481e542ed9aac4fb08575ad5f705015e0706de0c4f849f271cb55bf6` |

The self-project contains 27 surfaces, including Pages, Page editor and Component
editor. Three seeded detail documents demonstrate an import page, component
library page and reusable review-panel internals. They use the same authoring,
validation and export path as user designs. Existing Storymaps and source contracts
remain in the project. Dependencies, vendor bytes and lockfile are unchanged.

## Executed local checks

- **113 Node tests passed**, zero failures: shared full-project, Storymaps and detail
  contracts, read-only CLI and exported test-data tooling. The detail suite accounts
  for 40 of these tests, not an additional 40.
- **30 project-generator tests passed**, zero failures. The compiler retains the
  new data in project/traceability exports and emits an explicit unimplemented
  detail-runtime warning; tests do not claim generated layout or business behavior.
- **12 assembly tests passed**, including exact reconstruction, orphan-source,
  missing-inventory, tampered-vendor and stale-output rejection.
- **50 new browser assertions passed** on the exact HTML above, with no observed
  browser errors, fatal failure or external requests. This includes real controls,
  pointer drag, cancelled drag, handle connection and cancellation, plus explicitly
  labeled controlled quota, stale-draft and foreign-storage failures.

Local Node was 22.16.0. Compiler tests used its explicit TypeScript stripping flag.
The repository's hosted Node/npm matrix is a separate gate. Local maintainability
execution could not load the absent npm dependencies; no complexity/coverage pass
is claimed from that environment and no quality threshold was relaxed.

The complete local browser runner passed **1,009 named assertions across all 18
non-storage suites** on the exact HTML above, with every suite passing and no
observed browser errors or unexpected requests. This total includes the 50 new
detail-editor assertions; it is not added to them. These results are recorded in
`reports/concepts/browser-summary.json`. Real-origin Storage and the full hosted
repository matrix remain separate gates, reported on PR #5.

## Specific failure and interaction coverage

The contract rejects malformed/unknown fields, unsafe/nonliteral props, invalid
geometry, duplicate identities/owners/events, stale counters, dangling internal
references, containment cycles, excessive nesting and recursive component
composition. Missing external owners, definitions and source operations remain
explicit recoverable references. Legacy v1/v2 imports do not acquire detail data.

The browser suite checks canonical parent/order edits, subtree duplication/deletion,
shared Undo/Redo, local component overrides, definition drill-down and return,
source bindings, state visibility, escaped content, narrow preview and desktop/
mobile layouts. Actual drag changes geometry without changing the semantic
fingerprint; cancellation restores saved geometry. A failed Save restores both
history stacks and the canonical model while retaining the open draft. Leaving an
editor unmounts the Vue Flow island. Sitemap/Storymap concepts are not duplicated.

A persistence regression discovered during implementation was fixed: internal
editor routes now validate, and a reload resolves them to Pages or the Component
library while preserving saved details. The dedicated real-origin Storage suite
also tests both reloads. This container blocks loopback browser navigation with
`ERR_BLOCKED_BY_ADMINISTRATOR`, so real-origin reload/two-window evidence must come
from hosted Chromium, not the local storage adapter. That gate remains enabled.

## Reproduction and remaining gates

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

The browser runner requires Playwright and Chromium; CI provisions its pinned
isolated tooling. Assertion totals are named checks, not independent user journeys.
Visual review covered light/dark desktop, component interiors, narrow preview,
mobile outline and element forms. Native Obsidian integration, assistive-technology
and touch-device qualification, maximum-scale profiling, generated Vue layouts and
business-level TDD acceptance remain the explicit native-conversion gates in
`docs/tasks/companion/CP-003.md`.
