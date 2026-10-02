# Angular bricks and upstream integration — verification

Recorded on 2026-09-29. This record separates implementation, local checks and
hosted acceptance; it does not authorize merge, publication or native activation.

## Candidate and delivered changes

Renderer implementation commit: `47d2bf8e22594adb4ab8bbe9843240cc3f7a2640`.
Tree: `f34bed2149ab93193c346edb7e8a16623e161b2e`.
Eight uploaded file blobs were compared with the local tested bytes and matched.

The commit preserves the concurrent CLI help fix `a564d8286ab60d7b00754b3989b2b3f5a69c3861`.
PR #5 through `9a730e672f58b640b289d6ea49b68850e2f5df18` was incorporated by
`0ec1128a6b6b1501abdf100dd242948c13a44295`. The two resulting prototype import
conflicts were corrected in `9d3b72fb9fc69d66937f806c19386f0bb1a56486`.
Concurrent branch writes were retained through non-forced ref updates; duplicate
local commit candidates were not used to overwrite already-pushed changes.

The renderer uses the canonical validator and compiler. It emits real standalone
AOT Angular page/components, pinned revision templates, property/default/variant
bindings, projected/fallback slots, scoped layout and visibility, supported native
interactions, and browser hash routes. It records unsupported external/Nuxt/source
adapters in `design/angular-capabilities.json` rather than treating them as done.

Existing delivered setup checkpoints, shared documentation settings and reviewed
path migration are documented in [the setup guide](../../bin/PROJECT-SETUP.md),
[checkpoint guide](../../bin/CHECKPOINTS.md), [first-run guide](../../bin/FIRST-RUN.md)
and [Angular brick guide](../../bin/ANGULAR-BRICKS.md).

## Executed local checks

Linux, actual Node **24.21.0**, npm **11.19.1**, repository TypeScript **6.0.3**.
These checks used the exact source archive for PR test-merge `6d25396` (same tree
as PR52 `2e5ccb7`), the two prototype import corrections, and the eight renderer
files. The later seven upstream prototype UI/bridge/test changes and concurrent
CLI help addition were preserved remotely but were not part of that local
full-suite snapshot. Do not describe the results below as full latest-head or
cross-platform qualification.

| Executed check | Result and scope |
| --- | --- |
| `npm run test:maker` | 202 passed; 0 failed/cancelled; one Windows-only skip. Includes eight new renderer source/unit tests. |
| `npm run check:maintainability` | Passed all reported groups; no failures. |
| `npm run typecheck:compiler` | Passed after reconciling prototype imports. |
| `npm run typecheck:maker` | Passed; also repeated after guide/help reconciliation. |
| Analyzer | Full analyzer reported zero findings. |
| Compiler architecture | Passed: 169 files, seven pure entrypoints. |
| Source policy | Passed: 1,256 inputs, 202 translated keys. |
| Renderer ESLint | Passed for the new/modified renderer source and tests. |
| Prototype integrity regression | Eight passed; no failures/skips. |
| Guide/settings/checkpoint regression | 26 passed after help/readme reconciliation; no failures/skips. |
| Generated Angular fixture | Actual ngc AOT typecheck and Vite offline prototype build passed. |
| Generated AOT DOM smoke | Executed the built Angular bundle in happy-dom: props, duplicate instances, named/fallback slots, navigation, visibility and cleanup passed. This is a simulated DOM, not browser acceptance. |

The full maker run completed in 114.9 seconds. The generated Angular fixture
contains real installed Angular dependencies, not mocked Angular APIs. It was
created in a scratch directory, never in a personal vault.

An initial incorrectly launched subprocess inherited system Node 22 and failed
before TypeScript imports could load. It was stopped and replaced by the complete
Node 24 run above; that environment failure was not relabeled as a passing test.

## Hosted acceptance

The earlier extracted-kit -> setup -> install/typecheck/test/build -> edit ->
regenerate -> second ci/build -> real browser journey passed on Windows, macOS
and Linux in workflow **36632421799** for commit `4cc8a4e`. That proves the earlier
Git-root and asynchronous-navigation assertion fixes, not the new renderer.

For renderer commit `47d2bf8`, the Angular setup workflow **36640074336** was queued
when inspected. It now also asserts two rendered component instances, CSS grid,
state-changing interaction, hash route and reload after regeneration. Its outcome
must be read from the candidate-specific workflow; this record does not predict it.
Local served Chromium navigation was administratively blocked. No bypass or
substitution of simulated DOM results as real-browser acceptance was performed.

## Scope still requiring qualification or implementation

Complete latest-head hosted verification, browser/native behavior for every
supported component and the user's actual business acceptance remain separate.
Live dependency security auditing was not performed offline. No exact-pin upgrade,
policy weakening, screenshot-baseline acceptance or release was included.

The transport's canonical PRD count/scalar frontmatter limits remain. All-model
CRUD menus, complete historical CLI settings consolidation, arbitrary Nuxt/external
widget adapters, live data providers, automatic PRD-to-business implementation,
hot reload and bidirectional hand-written-source synchronization are not delivered
by this rendering change. Supported native/project bricks now render; modeled
contracts alone still do not implement backend/business semantics.

## Retained log fingerprints

SHA-256 of the completed local logs (available with this session's evidence bundle):

| Log | SHA-256 |
| --- | --- |
| `renderer-maker-regression.log` | `8044ebbda6db469bdd429662b6e9dab91d3cd48dff454dae6ae0a8ba1bf795a0` |
| `renderer-maintainability.log` | `23a61ca9edc0881e01f506c952ce72cb2510d2ecae59916297408cb2d6eb4168` |
| `renderer-aot-build.log` | `1e00db1b96030c5627f8b295af35280d0c0030a6a5aee26959b0ac68805bd952` |
| `renderer-dom-smoke.log` | `94e5e9e78a790495f94ad6850229e7b9970f06a5983cffd32d6362c503565489` |
| `docs-reconciliation-tests.log` | `0cb8e22c7e3d302229c7b562f11a68fa46f252bdae57544089e22a2c6b6cbfdf` |
| `docs-reconciliation-typecheck.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `prototype-import-fix-tests.log` | `f3db51896992e9adccc767ef765df5d02a9efb13c0572a6f8dc9eba9478d8a55` |
| `prototype-merge-typecheck.log` | `82bcbc87fa5c898c4d1d7705a2f952a7709ab1e0f032312c3614c66e752ac2b5` |
