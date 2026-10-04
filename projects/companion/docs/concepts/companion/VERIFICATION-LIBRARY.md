# Component library and card polish — executed verification

> Concept 08 · 2026-09-23. Current evidence for [index.html](index.html). The existing `VERIFICATION.md` and `browser-checks.json` remain the historical Concept 01 record, not qualification of this candidate.

## Candidate identity

The accepted HTML is **1,001,005 bytes**, SHA-256 `ddc15ef2c7d5c7177f45064d367ba3830ca4353a1ad2a5f29ec08dd2430c1d34`. It embeds Vue 3.5.43, Pinia 4.0.3 and Vue Flow 1.48.2. Expanded concept source was committed as `32f707eb935579ca07b06bf8207142ffee0ed87b` on the existing companion PR.

All seven final suites ran against these exact bytes. Documentation changes do not alter the candidate. The source builder reproduced the accepted HTML exactly.

## Executed results

| Suite | Passed |
| --- | ---: |
| Component library and compact cards | 57/57 |
| Content bricks | 72/72 |
| Connections | 80/80 |
| Vue Flow interactions | 58/58 |
| Sitemap | 78/78 |
| Studio | 87/87 |
| Workflow | 48/48 |
| **Total** | **480/480** |

The total comprises **437 browser-labeled interaction/result observations and 43 explicitly scoped model, storage or controlled-state fixtures**. It is not a count of 480 physical-pointer journeys. Historical iteration counts are not added again. Each final suite recorded zero page/console errors and zero runtime network requests. Detailed final reports and screenshots are retained in the deliverable package; [verification-library.json](verification-library.json) contains the machine-readable summary.

## New behaviors covered

The 57 new checks cover the unified library's 14 content definitions alongside six UI contracts; filters/search/no-results; custom definition creation and placement; local instance overrides; versioned default changes; drift detection and explicit upgrades; usage counts; in-use deletion protection; deprecation/restoration; and removal without automatic reseeding.

Actual in-card pointer sorting covers above/below insertion, one Undo per completed move, cancellation, and stable card positions. Earlier/Later controls and Alt+Arrow keyboard sorting preserve focus. Additional checks cover dirty drafts, unchanged-dialog dismissal, source-preview references, malformed/future data, library limits, stale transfer rejection and atomic failure when a starter stack references a missing definition.

Retained suites were adapted to intentional changes in inventory and compact card controls without treating prototype results as native qualification. PRD, requirement, graph, binding, generation-plan, setup and recovery workflows remain exercised.

## Repository reassembly

A bounded one-time transport validated the reviewed source archive and pinned vendor artifact before writing the declared concept scope. The independent GitHub assembly reconstructed the exact accepted HTML and committed expanded source. Temporary transport chunks were removed by that commit. The transport is not an application feature, browser test or production generator.

Vendor source, license notices, hashes and CSS remain in the repository; normal reassembly does not depend on an expiring artifact or a network connection:

```sh
python3 scripts/concepts/build-companion.py
python3 scripts/concepts/build-companion.py --check
```

The [README](README.md) lists the seven browser-suite commands. They require separately provisioned Python Playwright and Chromium and are separate from root production verification. Root dependencies, lockfile and production thresholds were not changed by this concept iteration.

## Visual inspection and limits

Inspected compact selected-card controls, brick sorting, shared definitions and upgrade review, dark/light themes and 1024/390-pixel layouts. Approved content wireframes remain schematic planning visuals, not rendered production Vue components. Narrow checks found no document overflow in the exercised states, but the map remains an overview at small sizes; the outline, inspector and Focus control remain necessary.

The managed Chromium environment blocked direct file/loopback navigation. Tests injected the exact HTML and used a controlled Storage substitute for persistence cases. They executed the real embedded Vue/Pinia/Vue Flow renderer.

**Not qualified:** native Obsidian, real filesystem/CLI execution, generated production-code correctness, file-origin persistence, all browsers/themes, physical touch/pen/trackpad input, complete screen-reader accessibility, or release readiness. Other workbench panels retain concept adapters; this is not a complete Vue/Nuxt UI native-plugin port. Root `npm run verify` was not executed as part of these local concept checks.
