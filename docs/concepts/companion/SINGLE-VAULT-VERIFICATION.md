# Vault-first workspace, semantic editor and variants: verification

Date: 2026-09-24. Baseline PR head: `5d998f5de40e36e59382fa17d019c06879da02c3`.

This record covers the [single-project workspace](SINGLE-VAULT.md) and [semantic layer/component variants](SEMANTIC-LAYER.md). It supersedes earlier application totals without adding historical assertions. It is not native companion or shared CLI qualification.

## Exact tested artifact

- `docs/concepts/companion/index.html`: **1,198,728 bytes**.
- SHA-256: `dcdcce60ca4b15cb8d976c360601f5454c9b1e366fe39a64fbe0d3f5cf851bb5`.
- Local Python 3.13.5, Python Playwright 1.57.0, Chromium `/usr/bin/chromium`.
- Local JavaScript syntax checking used Node 22.16.0, not the root template's qualified Node/npm pair.

## Completed local evidence

| Current suite | Passed named assertions |
| --- | ---: |
| Single-vault project lifecycle | 47 |
| Semantic editor and component variants | 76 |
| Containers and connections | 64 |
| Reference workspace | 50 |
| Reference graph | 8 |
| Reconciliation and recovery | 34 |
| Unified library and spatial behavior | 67 |
| Product safety and recovery | 47 |
| **Total** | **393** |

The consolidated runner produced a passing `reports/concepts/browser-summary.json`, with a nonempty current report for every suite bound to the same HTML hash. All 10 assembly/inventory/tamper tests passed. All 57 authored JavaScript fragments passed syntax checking. The analyzer inventory explicitly contains 57 authored JavaScript files, 14 authored stylesheets and 5 retained vendor JS/CSS inputs: 76 inputs in total. Vendor bytes and the existing provenance manifest are unchanged.

The named checks include physical pointer interactions, DOM form actions, controlled-state fixtures, geometry measurements and direct model assertions. They are not 393 separate end-user journeys. No observed page errors, console errors or runtime network requests occurred in the exercised application routes.

New behavior exercised includes one project through interrupted preparation; legacy-outline recovery without inherited execution authority; protected vault configuration; actual Vue Flow entity dragging and handle connections; relationship ownership/cardinality; Obsidian property types and valid defaults including false/zero; cross-entity property-type conflicts; safe grouping/ungrouping; stable source fingerprints; surface-to-entity binding; input-driven TypeScript/recipe/frontmatter previews; stale reviews and bounded preview output; variant contract validation, placement, pinned defaults, version upgrade disclosure, local-override preservation and in-use deletion protection; modal discard recovery; state reload; and measured component-thumbnail containment at wide/narrow sizes.

Screenshots retained by the browser runner include empty-vault onboarding, the entity editor, component variants, narrow semantic layout and storage/recovery states. The entity and library screenshots were visually inspected; the relationship-caption styling and miniature containment were corrected before the final run.

## Real browser Storage and final CI

The separate real-origin suite has nine intended assertions, including semantic-model and variant persistence across reload, plus two-page conflict handling. It uses actual browser Storage/events on a loopback HTTP origin. That route is blocked in this local execution environment, so **those nine assertions are not claimed as locally passed**. CI invokes `scripts/concepts/run-browser-checks.py --real-storage` and retains the exact HTML, reports, logs and screenshots. Read its actual result before claiming a combined total.

The final PR must also pass the complete template-authoring, showcase, setup-policy compatibility and fixture workflows. A green companion run alone is not a green root-template pipeline. Final commit/run IDs and completed results are recorded in the PR conversation after execution; this document does not predeclare scheduled checks successful.

## Repeatable commands

```sh
python3 -B scripts/concepts/build-companion.py --check
python3 -B tests/concepts/companion-assembly.test.py
python3 -B scripts/concepts/run-browser-checks.py --real-storage
```

The browser runner requires Python Playwright and a matching Chromium executable; CI provisions its pinned tooling independently of root dependencies. Root gates retain their own qualification commands and unchanged thresholds.

## Explicit boundaries

The host vault, additive file preparation, generation and lifecycle operations are simulated in browser state. No real vault discovery, Markdown writes, npm processes, native plugin installation or permission changes were performed. Entity-driven output is a source preview and data recipe, not a qualified shared CLI compiler or proof that the generated plugin compiles/runs. Native serializers, relationship resolution/cardinality enforcement, migration safety and differential UI/CLI tests remain delivery work.

LocalStorage compare/write is not atomic locking. Full accessibility/screen-reader/device coverage, file-origin persistence, large-graph performance budgets, real Obsidian integration and release readiness remain unverified. Schema deletion does not delete runtime notes. Recovery exports contain committed in-memory concept data, potentially including private entered paths/notes, but not unsaved modal drafts.
