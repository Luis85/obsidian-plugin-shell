# Composition verification receipt

## Source and integration

Recovered implementation base: PR #5 `5ddc7a278ba639fdc78b9294a55dfdc99c5279d2`.
Publication integrates PR #5 `3cd1f7b04025df02a9fc1407fc598112a072a965` and retains its
Nuxt UI Design System stylesheet compiler, frontend roles, tests and host-owned styles.
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

The integrated local contract/CLI/test-data/compiler command passed **263 tests**,
zero failures or skips. This includes the complete-project compiler/effect suite and
37 Design System tests. The focused composition browser suite passed **111 named
assertions**, including all 80 working designs; assembly/inventory passed **13 tests**.
The full registered browser suite and hosted generated-workspace qualification are
separate gates. Their current-head results belong to the PR checks and retained
artifacts, not historical results of the recovery checkpoint.

Integration corrections preserve local/custom font provenance and valid rem sizes
in detail previews and immutable token captures. Large file/example imports retain
the complete payload outside the textarea; large export previews are explicitly
bounded, while downloads retain every byte. Paste editing stays unwrapped and exact.
The full-project test repeats review/cancel/open, file import, paste round trips,
replacement conflicts and actual download equality rather than increasing timeouts.
Numeric layout fields use bounded native number inputs; long palette labels avoid
broken words. Both concurrent stylesheet and composition browser suites are registered.
Source transport includes the canonical fixture, repairing the missing fixture seen
in the baseline archive-analyzer job (Showcase run 36128435671).

| Integrated artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `index.html` | 1,870,767 | `a2eb3c06921565a7794fbdd7616beb8bdb58c7bb5ce5de78ed3341769624ddca` |
| `companion-project.json` | 2,265,670 | `c63076f2824c8d941b3fd7e6e37e95708672db4b36d12e16b997c2515eed96e2` |

The checked-in JSON is regenerated from the embedded seed by
`export-companion-project.py`; byte equality passed locally. No staged payload or
delivery workflow belongs in the feature commit.

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
