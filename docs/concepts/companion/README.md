# Shell Workbench companion concept

> Concept 11 — unified components and stable spatial editing, 2026-09-23. Interactive browser concept, not an installable Obsidian plugin.

Open [index.html](index.html) locally in a desktop browser. All runtime scripts, styles and SVG icons are embedded, including the reviewed Vue, Pinia and Vue Flow bundles. No server, npm install or runtime CDN is needed. GitHub displays HTML source rather than executing it.

## Current iteration

All components now use the content-brick workflow. The 44-entry library supports website/application patterns, editable tags and filtering/sorting. Sections are content-aware drop zones. Connector origins stay pinned while cards move; handles appear on hover, selection, focus or drawing. Alignment guides and independent magnetic snapping support precise placement. See [code/product review](UNIFIED-REVIEW.md) and [current verification](UNIFIED-VERIFICATION.md).

## Review the current experience

Start with **Explore example → Sitemap & views → Collection → Content editor**. The reference-led canvas uses compact, content-first cards, floating selection actions, an optional Structure panel and a synchronized full-page content draft. The existing handles, typed connections, library-backed content, PRDs and design-to-setup journey remain.

The content editor supports ordered components, Markdown-source writing, per-instance purpose and region, library selection, preview navigation and one deliberate Save. Screen content is distinct from shared library definitions. Visual sections and card arrangement remain outside semantic generation inputs.

This reconciliation adds safe shortcut handling when discard confirmation is open, focused field errors, reversible removal, an explicit draft export, before/after reorder feedback, useful empty states and clearer popover dismissal. See [review](RECONCILIATION-REVIEW.md) and [historical reconciliation verification](RECONCILIATION-VERIFICATION.md).

## Source and evidence

Edit the readable modules under [src](src), not the generated HTML. Build with:

```sh
python3 scripts/concepts/build-companion.py
python3 scripts/concepts/build-companion.py --check
```

Run these browser suites from the repository root with pre-provisioned Python Playwright and Chromium:

```sh
python3 tests/concepts/companion-unified.browser.py
python3 tests/concepts/companion-reference.browser.py
python3 tests/concepts/companion-reference-graph.browser.py
python3 tests/concepts/companion-reconciliation.browser.py
```

The current qualification is 159 scoped checks on one artifact, plus syntax checks for 45 authored JavaScript files. Historical evidence is not added to this total. Some older suites assert the pre-reference toolbar layout; they need deliberate locator migration and are not declared passing here.

The template has advanced beyond the iteration-03 capabilities used by many concept fixtures. The concept's script inventory and source previews are illustrative, not live detection of current repository capabilities. Production authoring and readiness are documented in the [parent PRD](../../product/PRD.md); the [companion PRD](../../product/COMPANION-PLUGIN-PRD.md) remains a proposed product contract with its dated baseline.

## Boundaries

No real vault, filesystem adapter, template download, command execution, deployment, activation or publication is performed. Explicit exports download local Markdown/JSON supplied by the user; they do not transmit data. Do not enter secrets. The prototype is not a second production generator or proof that the native template consumes its design schema.

Browser state may be retained only through the existing opt-in demo preference. Invalid/future data is preserved for inspection; a dirty-form unload guard is a browser warning, not durable draft storage. File-origin persistence, native Obsidian behavior, complete accessibility and physical touch/pen/trackpad remain unqualified.

Third-party runtime provenance and license notices remain under [vendor](vendor). No font binaries or extracted host stylesheet are added. The surrounding panels retain concept rendering; the sitemap is the real Vue Flow island, not a claim that the entire companion is already a production Vue/Nuxt UI application.
