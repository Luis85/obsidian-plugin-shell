# Unified component and spatial-editor verification

Date: 2026-09-23. Concept 11, based on PR #5 at `d22cc1c86aece83624713a2d3da30d1fd048e6ed`.

## Accepted local artifact

- File: `docs/concepts/companion/index.html`
- Bytes: 1,091,653
- SHA-256: `d85e9ddf3f6177a2a9fac11a3c99bd90e6c536f2246e8c2a008b13454a4e27da`
- Scope: browser concept with actual embedded Vue, Pinia and Vue Flow. No native host, CLI or production scaffold execution.

## Executed checks

| Suite | Passed | Evidence scope |
| --- | ---: | --- |
| Unified components and spatial editor | 67 | Real pointer/card/connection/section interactions, library forms, plus labeled legacy/geometry/data fixtures. |
| Reference workspace | 50 | Content editor, forms, preservation, navigation and responsive observations. |
| Reference graph | 8 | Actual handle draw, SVG-path hit testing, connection edit, drag and on-card sort. |
| Reconciliation | 34 | Draft safety, removal recovery, validation and responsive observations. |
| **Total current scoped checks** | **159** | Same final HTML for every suite. |
| Authored JavaScript syntax | 45 | `node --check`, Node v22.16.0. Not the template's qualified Node 24 runtime. |

No page/console errors and no runtime network requests were observed in these routes. Exact Python source assembly passed. Individual results, categories and commands are in [verification-unified.json](verification-unified.json). Historical totals are not added to these results.

## Reproduction

Pre-provision Python Playwright and Chromium; these commands do not install them or launch Obsidian.

```sh
python3 scripts/concepts/build-companion.py --check
python3 tests/concepts/companion-unified.browser.py
python3 tests/concepts/companion-reference.browser.py
python3 tests/concepts/companion-reference-graph.browser.py
python3 tests/concepts/companion-reconciliation.browser.py
```

The browser harness injects the exact HTML. No claim of native file-origin persistence or full accessibility is made. Model and synthetic focus fixtures are labeled; the total is not a physical-pointer journey count.

## Defects found and corrected during qualification

A legacy ID-scoped stylesheet overrode the intended 244px card width with 272px. This was visible as disagreement between actual DOM bounds and the dimensions used for sections/guides. Card width is now set from the same geometry source as the projection. Tests assert actual measured width/height agreement.

The retained graph test clicked the midpoint of a path's bounding rectangle with `force=True`, which can hit a floating toolbar rather than the curved SVG. It now samples actual path coordinates and verifies an unobstructed DOM hit before clicking. This preserves the real SVG interaction test instead of replacing it with a model call.

The library/section assertions were migrated deliberately: a 14-item content-only palette is now the 44-entry shared inventory; section bands are now dynamic drop zones. Existing content-preservation, draft and no-source-change assertions remain.

## Remaining limits

Dense maps may contain crossing lines; fixed attachment points intentionally do not reselect sides to optimize routes. There is no automatic obstacle-routing or real-device performance claim. An overview at very low zoom is not a detailed editing scale; Focus, outline, inspector and non-drag controls remain available. Sections are independent visual memberships, not Vue Flow parents or plugin routes. Physical touch/pen/trackpad, screen-reader conformance, native vault adapters, live CLI parity and production Vue/Nuxt UI integration require their own tests.
