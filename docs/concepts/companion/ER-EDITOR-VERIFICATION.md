# Entity editor polishing: execution record

Date: 2026-09-24. Baseline PR #5 head: `cf516b0062f7a44d2b31f27e95fefbf15fd73d3f`.
Scope: the same singleton-vault companion concept, with entity-editor geometry, interaction, entry and interpretation improvements. The [research and review](ER-EDITOR-REVIEW.md) explains decisions, defects and residual qualification. Historical iteration totals are not added.

## Exact artifact

`docs/concepts/companion/index.html`: **1,232,748 bytes**, SHA-256:

```text
6fdf65ae709217dd386f655c0cac7ae3e95cb8ec37d438bfa97f68398fe636ba
```

The artifact is reconstructed from owned sources and the unchanged hash-verified Vue/Pinia/Vue Flow vendors. The builder and analyzer agree on **78 JS/CSS inputs: 59 maintained JS, 14 maintained CSS, 5 vendor assets**. Runtime source, dependency pins, lockfile and vendor bytes are unchanged by this pass.

## Completed local checks

| Check | Result |
| --- | ---: |
| Single-vault workflow | 47 passed |
| Semantic model, generation and component variants | 76 passed |
| New ER geometry, guidelines and interaction-state suite | 67 passed |
| Containers/connections | 64 passed |
| Reference workspace | 50 passed |
| Reference graph | 8 passed |
| Reconciliation/recovery | 34 passed |
| Unified library/spatial behavior | 67 passed |
| Product safety/recovery | 47 passed |
| **Current browser assertions, excluding blocked storage execution** | **460 passed** |
| Exact assembly/inventory/tamper rejection | **10 tests passed** |
| Authored JavaScript syntax | **59 files passed** |
| Python source parsing and whitespace diff check | **Passed** |

The suite uses the actual embedded renderer with HTML injection and explicitly controlled Storage fixtures. Local Node is 22.16.0, not the repository's qualified Node 24.21.0/npm 11.19.1. No qualified root-template result is inferred from local syntax checks. Reports retain each assertion's scope, artifact hash, observed errors and runtime requests.

### Important new proofs

The edge probe tests actual on-screen SVG hit detection and endpoint-to-handle distance, including far-positive/negative world positions. Reintroducing hidden inner-SVG overflow makes the probe fail; removing it restores the hit-tested lines. Reversed, stacked, self-referencing and resized entities retain attached endpoints.

Physical drag checks cover visible guidelines, transient versus committed positions, drop snapping, section geometry, Undo and Escape cancellation. Numeric alignment is checked against unchanged generator bytes. Keyboard nudge/undo/edit, append-property shortcut, Save & add another, preserved custom folders and relationship-property search exercise their public interaction paths.

Computed styles and real input cover entity hover, selection synchronization, secondary-port visibility, valid connection targets, pressed/released toolbar feedback, guideline/grid toggles, dark/light mode selection styling, visible keyboard focus and disabled editing. The tests also reject unresolved semantic color tokens. The narrow relationship list has no horizontal document overflow. Captured screenshots complement these checks; they are not substitutes for state and geometry assertions.

Assertion totals include model, synthetic/control-state, computed-style and geometry checks, not 460 independent physical-pointer journeys. No observed page/console errors or external runtime requests occurred in the completed local suites.

## Real-storage and CI boundary

The local `--real-storage` attempt stopped before its first assertion: Chromium refused loopback navigation with `net::ERR_BLOCKED_BY_ADMINISTRATOR`. The report correctly remains failed/blocked rather than claiming a storage pass or substituting a mock. This is an environment restriction, not evidence that native Storage works.

The committed read-only concept workflow must run the complete runner with `--real-storage` on GitHub. The final PR comment records actual final-head workflow IDs, results, tested commit and downloadable evidence. This local record does not predeclare those results. Require the companion, fixture baseline, showcase, setup-policy and full template-authoring workflows to finish before declaring full integration green.

Reproduction:

```sh
python3 -B scripts/concepts/build-companion.py --check
python3 -B tests/concepts/companion-assembly.test.py
CHROMIUM_EXECUTABLE=/path/to/chromium python3 -B scripts/concepts/run-browser-checks.py --real-storage
```

Raw output is retained by CI under `reports/concepts/`, with named new checks and screenshots under `er-polish/`. Ordinary source, browser and root-template workflows are not replaced by a custom success status.

## Not established

No native Obsidian/vault operations, shared CLI compiler execution, generated-project compilation, migration, file-origin persistence, atomic multi-window locking, physical-device validation, comprehensive screen-reader/WCAG certification or maximum-scale performance acceptance is established by these concept assertions. Orthogonal routing is bounded best-effort, not a guarantee against every crossing or overlapping-card obstruction. Existing model bounds remain guardrails rather than a measured scale promise.

A final regression reproduced selection remaining blocked after cancelling a drag. A new pointer-down now clears only the cancelled previous gesture; the matching click checks pass after both move and connection cancellation. The prior failing diagnostic is retained separately and is not counted as a passing run.

The final visual check also reproduced hidden connected secondary ports: a correctly routed line could still appear to end before the card. Connected ports now remain visible; unused secondary ports still recede. A failing-before/passing-after idle-port assertion complements endpoint-distance testing.
