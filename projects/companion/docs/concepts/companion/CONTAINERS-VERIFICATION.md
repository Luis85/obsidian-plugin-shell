# Containers and connection verification

> Concept 12 · 2026-09-23. These are current concept results, not native-plugin or production-generator qualification.

## Accepted artifact

- File: `docs/concepts/companion/index.html`
- Bytes: **1,112,611**
- SHA-256: `5fd906301223be5c7cdf4fe98b91b15190c3a713f9d1467ed79d00e1c406046a`
- Source baseline: `c8f4972b16a5aeaea4d17d0f941b552c27794da5`

## Executed checks

| Suite | Passed | Scope |
| --- | ---: | --- |
| `companion-containers.browser.py` | 64 | Current fixes: rendered bounds, host/group roles, naming, section arrangements, editable captions, deletion, actual endpoint dragging and far-origin line hit tests. |
| `companion-reference.browser.py` | 50 | Workspace, content editor, library, requirements and responsive behavior. |
| `companion-reference-graph.browser.py` | 8 | Actual connector drawing, SVG editing, card movement, ordered components and canvas settings. |
| `companion-reconciliation.browser.py` | 34 | Dirty drafts, validation, recovery, sorting, responsive writing and popovers. |
| `companion-unified.browser.py` | 67 | Unified library, migration, tags, guides, section drops, anchor stability and lifecycle checks. |
| **Current total** | **223** | All five suites ran against this exact HTML. |

All **47 authored JavaScript files** passed `node --check`. Exact deterministic HTML reassembly passed through `python3 scripts/concepts/build-companion.py --check`. `git diff --check` passed after removing one trailing space. No observed page/console errors or runtime network requests occurred in the final browser runs.

The [machine record](verification-containers.json) includes every named assertion, scope and artifact hash. Counts include model, synthetic-event, controlled-concurrency and geometry fixtures; they are not 223 physical-pointer tasks. Historical 480/159 totals are not added to these results.

## Reproduction

Use pre-provisioned Python Playwright, Chromium at `/usr/bin/chromium`, and Node. From the repository root:

```sh
python3 scripts/concepts/build-companion.py --check
python3 tests/concepts/companion-containers.browser.py
python3 tests/concepts/companion-reference.browser.py
python3 tests/concepts/companion-reference-graph.browser.py
python3 tests/concepts/companion-reconciliation.browser.py
python3 tests/concepts/companion-unified.browser.py
```

Browser scripts write local evidence below `reports/concepts/`. They do not call setup, makers, a native host or the network. Local syntax checking used **Node 22.16.0**, not the template-qualified Node 24 runtime. The embedded dependency bytes are unchanged.

## Corrections discovered during qualification

Measured height and interior padding initially disagreed due to more-specific legacy CSS. The corrected bounds now include the whole rendered card and reserved section padding. A connection label and floating toolbar could intercept updater circles; labels avoid anchors and the card toolbar yields to connection selection. A child-creation action updated selected data without refreshing its toolbar; both now refresh together.

The reference-suite content assertion was updated deliberately: all **15** example component instances remain canonical, **12** render on the four content-bearing cards, and the native view's **3** remain accessible as retained earlier content. Narrow-screen tests use the existing on-card content-editor entry when a floating toolbar has insufficient unobstructed space. No behavior assertion was replaced by unconditional success.

An initial combined runner exceeded its outer timeout during the unified suite, causing a driver pipe error. That interrupted run is not evidence. All five suites were rerun successfully against the final hash. One initial duplication assertion incorrectly expected a renamed visible label to retain its former generation stem; the corrected test duplicates a still-identically-named source and verifies the index rule directly.

## Not qualified

The managed browser denied direct file navigation; tests executed the exact HTML through injection. File-origin storage, native Obsidian, real CLI execution, production source generation, physical touch/pen/trackpad behavior, full screen-reader/keyboard conformance, cross-browser qualification and optimal dense-edge routing remain unverified. Root repository CI is reported from live GitHub results separately, never inferred from these tests.
