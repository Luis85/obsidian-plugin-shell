# Workbench consistency and polishing review

## Scope and product direction

This is a refinement of PR #5 at `6a39dd03947e4f8da40c03dc42f4a8b5e34065b4`, locally reconstructed from its CI merge snapshot `8be4fd03b6cadc3185f0010042d2ee5f323c12ab`. Preserve one project per vault, the existing dark/light identity, all editors, review-before-mutation flows, data contracts and executable test-data kit. This pass does not convert the companion into a native plugin or introduce new generator semantics.

**Operate mode:** let developers identify an action, enter a value, change a declaration and return to the same context without learning another form or focus convention. Shared controls and layout rhythm should be predictable; diagram coordinates and authored design-system samples remain independent.

The inspection covered the overview, requirements, Sitemap, Entities, Data Sources, Components, Test Data, Design System, blueprints and action patterns. The six principal design surfaces were inspected at 1440, 960 and 560 CSS-pixel widths, with dark/light samples, plus a 560 × 640 short form. These are desktop/narrow-pane checks, not physical-device or formal screen-reader certification.

## Findings and corrections

| ID / priority | Finding and user consequence | Correction and evidence |
| --- | --- | --- |
| WP-01 / P1 | Ctrl/Cmd+K replaced an open editing modal, abandoning its draft and original checkpoint. | The global shortcut respects the open dialog. Close/Escape retains the existing discard review. Both platform chords, retained draft, and Keep editing are exercised. |
| WP-02 / P2 | Redraw matched only the first `data-field`; repeated property checkboxes could jump to the wrong row or shape side. | Stable focus records include ID, action/value, field, row/index/side and ordinal. Tests focus the second property and output-shape row and inspect the actual active element. |
| WP-03 / P2 | The raw invoking DOM node disappeared during a background render, losing the useful return location on Close. | Resolve the current control from its recorded identity, falling back to the content region only when no usable control remains. Test explicitly detaches the old invoker by rendering before Close. |
| WP-04 / P2 | Redraw lost text selections and form scroll offsets. | Preserve caret range and independent scroll regions; restore without scrolling the page. Number/date inputs do not receive unsupported text-selection calls. |
| WP-05 / P2 | Design System draft previews were painted by scattered callers rather than the modal lifecycle; an ordinary redraw could omit the preview and change body height. | Paint the preview through the shared modal decoration path before focus/scroll restoration. Remove redundant post-redraw calls; field editing retains its immediate preview update. |
| WP-06 / P2 | Accessible dialog names could reference the previous modal title when a replacement already supplied a different ID. | Rebind `aria-labelledby` to the currently rendered title every time; preserve authored title IDs. Test a named canvas dialog followed by an ordinary preference dialog. |
| WP-07 / P2 | Long forms made the title and final action hard to retain in a short pane. | Flex dialog shell with fixed header/action regions and a scrolling, bounded body. Test both title and footer are inside the viewport and the body really scrolls. Existing large content-editor and wizard layouts remain specialized. |
| WP-08 / P2 | Each new editor reimplemented fields with inconsistent label weight, helper associations and escaping. | `ui-fields.js` owns escaped labeled inputs/selects/textareas. Thin semantic/source/test/style wrappers preserve IDs, routing, maximum lengths, readonly state and numerical constraints. Hints are associated through `aria-describedby`; values remain normal weight. |
| WP-09 / P2 | Truthiness-based value rendering could turn numerical zero into an empty field; a removal heading also escaped a name twice. | Nullish value handling retains zero, and dialog titles have one escaping boundary. No authored HTML is interpreted. |
| WP-10 / P3 | Shell CSS embedded in a dense HTML block competed with later global palette and minimum-height overrides. | Extract the actual base stylesheet into `workbench.css`, assembled first, and remove the redundant global declarations from `workflow.css`. Preserve the previously resolved palette rather than claim the old normal button failed contrast. |
| WP-11 / P2 | Editor-specific pressed fills could turn a primary button into a soft-background button while leaving its foreground white. | Shared pressed feedback retains the primary role and adds an inset indicator/filter. Normal primary text passes the measured 4.5:1 check in both themes; pressed/hover tests verify role preservation. This is not a certification of every authored palette. |
| WP-12 / P3 | Ordinary and compact buttons, form controls and icon buttons had different accidental minimums. | One 36px regular / 32px compact shell-control contract, with explicit diagram-local exceptions. Inputs/selects have a shared height. The map-help target is enlarged without changing world geometry. |
| WP-13 / P3 | Irregular form/section gaps and inherited bold input values made adjacent editors feel unrelated. | Shared 4/8/12/16/20/24/32 spacing vocabulary, 16px field rhythm, 24px section rhythm and aligned header action groups. Normalize the newer catalog and recipe forms while preserving intentional diagram and miniature dimensions. |
| WP-14 / P2 | The map-help tooltip extended beyond the main pane, producing a small horizontal scroll range even while hidden. | Anchor edge-adjacent header/footer tooltips inward, bound their text width, and suppress idle visibility. Six routes at three widths assert document, heading and main-pane fit. No blanket SVG clipping rule is introduced. |
| WP-15 / P2 | Narrow navigation did not consistently expose expanded state or a predictable Escape/return-focus path. | Update `aria-expanded`, focus the current destination on opening, dismiss on Escape or outside click, and collapse before destination rendering. Outside clicks retain their own intended focus. |
| WP-16 / P3 | Arrangement popovers stayed open while moving to another control, and platform/theme action labels were stale. | Dismiss the nearest popover with Escape and close it on outside pointer input; use the host platform's shortcut label and the theme action's next-state label. Do not consume diagram Escape gestures or modal cancellation. |
| WP-17 / P3 | The context panel substituted the new default for retained legacy test-vault targets. | Display the actual project target. A controlled legacy `.dev-vault` fixture proves visual polish does not migrate its files or binding. |
| WP-18 / P2 | Preparation/activation labels still named `.dev-vault` and deployment copy incorrectly denied the existing `--vault` option. | Present the actual project/preparation target consistently and distinguish the explicit installer option from the watcher's retained legacy default. Copy changes do not execute or modify the installer. |

## Shared implementation boundaries

`src/workbench.css` owns baseline shell colors, regular/compact control sizes, common field spacing, focus rings, dialog framing and responsive shell rules. `src/workflow.css` still owns workflow composition; its former global palette/minimum-height copies are removed. Graph-specific CSS retains card measurements, handles, routing colors and the existing visible-edge overflow correction.

`src/ui-fields.js` has a small responsibility: escaped, named form markup. Extra attributes are trusted internal template fragments, never user-provided HTML. Feature wrappers remain responsible for domain-specific limits and field names. This is not a generic runtime form framework or a schema change.

`src/interaction-polish.js` owns stable focus records, modal redraw preservation and transient shell navigation. The existing stale-review, removal, history, persistence and test-data session contracts remain in their owning modules. Generated output is rebuilt from source; there is no runtime function override, eval, copied vendor modification or new dependency.

The source/analyzer inventory is **105 exact inputs: 75 maintained JS, 18 maintained CSS, seven test-kit ES modules and five unchanged vendor assets**. The explicit fixture count and assembly registration are updated together. Additional files still fail inventory checks; there is no broad exclusion or relaxed production threshold.

## Verification contract

The new `companion-consistency.browser.py` suite is registered in `run-browser-checks.py` alongside all retained suites. Its **89 named assertions** cover ten route/heading/current-navigation contexts in each theme, measured regular/compact control behavior, primary fill and focus, disabled states, four families of form labels/hints, exact draft/focus/scroll retention, legacy context, responsive dimensions, popover dismissal and reduced motion. It also records page/console errors and runtime requests.

Local reference artifact: **1,490,957 bytes**, SHA-256 **`c77e4e45e640b58e0008722f49ff1afe58a3e2cc5f6c371c150130a543f44f0e`**. Assembly/inventory/tamper tests: **10 passed**. Node test-kit checks: **27 passed**, with real temporary files and loopback HTTP. Authored JS syntax and concept Python parsing pass. Full-suite results and final-head CI are recorded in the delivery receipt, not inferred from a scheduled workflow.

Normal UI suites use their explicit browser Storage test adapter. `--real-storage` additionally requires the separate actual-origin, multi-page storage suite; it must not be counted as passed when an environment blocks its navigation. Browser assertion totals include model, geometry, controlled-state and actual input checks, not independent end-to-end user journeys.

Local tooling is Chromium and Node 22.16.0, not the qualified CI toolchain. Required root-template workflows must independently verify the final pushed head on their pinned toolchain. A provisional earlier local run was correctly rejected after the HTML changed during execution; none of its aggregate results are used as final qualification.

## Remaining limitations and follow-through

This pass consolidates shared UI seams; it does not pretend that every legacy compact rendering function has been rewritten, that every declared color combination is accessible, or that the browser concept is the real companion. Full native Obsidian, assistive-technology/device acceptance, maximum-scale profiling, file-origin storage and production adapter integration retain their separate qualification gates. Test Data and Design System exports keep their existing explicit scope and safety boundaries.

The exported Design System describes the target plugin, not this workbench. Neither token editing nor theme changes silently restyle the user's generated project. No runtime schema migration, automatic test-vault movement, source-regeneration behavior, live endpoint access, dependency pin or production quality threshold is changed by this polishing pass.

## Primary guidance

- [WAI-ARIA dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): focus stays within an active dialog, and returns to a useful invoking location afterward.
- [WAI-ARIA modal dialog example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/dialog/): long content and title visibility need deliberate scroll/focus behavior.
- [WCAG 2.2 target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum): 24px minimum or applicable spacing exceptions. The shell's 32/36px convention is a product choice; it does not certify small diagram handles or every gesture.

These sources inform specific interaction decisions; they are not evidence of complete WCAG conformance.
