# Composition verification receipt

## Source and integration

Implementation base: PR #5 `5ddc7a278ba639fdc78b9294a55dfdc99c5279d2`.
The Storymaps polishing on that base is preserved. The detail compiler from PR #21
`7e600df16ad5b35230d117ba06282b0bbe3202fb` is incorporated and extended. Its older
three-design qualification is historical, not evidence for the expanded project.

The current requirements and operating guide are in [COMPOSITION.md](COMPOSITION.md).
This is an offline companion concept plus executable generated UI scaffolding, not
a completed native companion implementation.

## Retained test scopes

The new composition browser suite exercises actual Layout, fixture capture, Play,
comparison, slot editing, publication confirmation, individual upgrade, grouping,
copy/paste and Undo controls. It visits each of the 80 complete self-project designs
and records which coverage checks use direct route setup rather than full navigation
journeys. It measures representative render calls without asserting a native budget.

The original 50 detail-editor and 34 polishing browser checks run their frozen v3
fixture through the actual import controls, preserving backward compatibility.
Other companion suites retain their checks. Storymap history checks assert the
exact preceding snapshot and atomic Undo, rather than assuming that storage-bounded
history grows forever with the larger self-project.

Node tests cover schema/version rejection, literal-safe layouts/tokens, fixture
values, known slot kinds/cardinality, immutable revision retention, compiler lowering,
nonoverlapping arrangement and actual effect outcomes. The generated standalone
Node tests are executed, including a negative control that deliberately breaks
focus behavior. Child test processes remove only Node's inherited test-runner
context to ensure they execute real nested tests rather than silently emitting
runner protocol. Business TODOs are never counted as passing acceptance.

## Executed local evidence and limits

The current focused composition browser suite passed **111 named assertions**.
The contract/CLI/test-data and compiler regression command passed **220 tests**; a separate three-case complete-project compiler suite passed, including execution of the generated model tests for all 134 lowered documents (**179 passing UI/navigation assertions and three business TODOs**). The assembly/inventory suite passed **12 tests**. Complete current-tree regression
results and generated-workspace build/type/Vitest qualification are reported in the
PR's current-head checks and retained artifacts; no earlier-head result substitutes
for them. Counts from separate or repeated runs must not be added together.

Local Node is 22.16.0; Chromium uses the explicitly scoped in-memory Storage adapter.
Local root npm dependencies are unavailable, so no local full Vue compilation,
Fallow/coverage/lint matrix or actual HTTP-origin Storage pass is claimed here.
Hosted CI retains all those applicable gates with its pinned toolchain. No
production quality threshold, vendor package or lockfile dependency is weakened.

## Reproduction

```sh
python3 scripts/concepts/build-companion.py --check
python3 -B tests/concepts/companion-assembly.test.py
node --test tests/tooling/companion-*.checks.mjs tests/tooling/project-generator*.checks.mjs
python3 scripts/concepts/run-browser-checks.py --real-storage
npm run typecheck:generator
# On the explicitly generated workspace:
npm ci
npm run verify:project
```

Older Node releases require their explicit TypeScript-stripping flag for compiler
tests. Native Obsidian, assistive technologies, physical touch/pen, maximum-scale
paint/memory profiling and completed business acceptance remain independent gates.
