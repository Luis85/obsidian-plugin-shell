# Shell Workbench companion concept

> Review & recovery — product review and regression hardening, 2026-09-23. Interactive browser concept, not an installable Obsidian plugin.

Open [index.html](index.html) locally in a desktop browser. All runtime scripts, styles and SVG icons are embedded, including the reviewed Vue, Pinia and Vue Flow bundles. No server, npm install or runtime CDN is needed. GitHub displays HTML source rather than executing it.

## Current iteration

The cross-product review adds recoverable import editing, observed cross-window storage conflict protection, immediate storage-failure feedback with recovery export, safe duplication limits, correct Settings defaults and no-op saves. Large-coordinate focus no longer resets the canvas. Reconnection/removal reviews also reject intervening anchor/caption changes.

Read the [product review](PRODUCT-REVIEW.md) and [current verification record](PRODUCT-VERIFICATION.md). Prior iteration reports remain historical evidence, not additional current passing tests.

Native views are depicted as **view containers** with a host layout, placement and child-screen outlet. Navigation groups are compact organizational nodes in every display. Screen cards show the selected layout name; complete Structure previews and shared dimensions prevent cropping and incorrect section padding. All automatic arrangements keep visual sections separate.

New surface code names receive an incremental suffix only on collision. Connection captions are editable, modal deletion preserves surfaces, and selected lines expose draggable endpoints that open a review before saving. Existing anchor choices stay fixed during card movement. See the preceding [container product/code review](CONTAINERS-REVIEW.md) and [verification](CONTAINERS-VERIFICATION.md).

The established 44-entry component library, ordered content editor, tags, guidelines, visual section drop zones and PRD-to-setup workflow remain available. Previously authored components on native views are retained explicitly rather than silently removed.

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

Run the current exact-artifact browser suite from the repository root with Python Playwright 1.57.0 and a provisioned Chromium executable:

```sh
python3 tests/concepts/companion-assembly.test.py
CHROMIUM_EXECUTABLE=/path/to/chromium python3 scripts/concepts/run-browser-checks.py
# Additionally require actual browser Storage, a loopback HTTP origin and two pages:
CHROMIUM_EXECUTABLE=/path/to/chromium python3 scripts/concepts/run-browser-checks.py --real-storage
```

The read-only companion workflow provisions its own test-tool environment without changing the root dependency lockfile. It runs assembly rejection tests and all current browser suites, including real-origin storage, and retains raw logs/screenshots and the exact HTML. The local controlled-storage run passed **270 named checks** on one artifact; the **five assembly tests** and **48 authored JavaScript syntax checks** are separate. See the verification record for actual CI status; a requested or merely scheduled run is not passing evidence. Some older suites assert pre-reference layouts and are not part of this current suite.

The Fallow inventory explicitly lists each assembled concept module in an isolated zone. The builder rejects missing or extra module entries. Production import rules and thresholds are unchanged; negative analyzer fixtures guard imports in both directions.

The template has advanced beyond the iteration-03 capabilities used by many concept fixtures. The concept's script inventory and source previews are illustrative, not live detection of current repository capabilities. Production authoring and readiness are documented in the [parent PRD](../../product/PRD.md); the [companion PRD](../../product/COMPANION-PLUGIN-PRD.md) remains a proposed product contract with its dated baseline.

## Boundaries

No real vault, filesystem adapter, template download, command execution, deployment, activation or publication is performed. Explicit exports download local Markdown/JSON supplied by the user; they do not transmit data. Do not enter secrets. The prototype is not a second production generator or proof that the native template consumes its design schema.

Browser state may be retained through the existing demo preference. An observed newer snapshot blocks overwriting and exposes a recovery export; this is best-effort conflict detection, not atomic multi-window locking. Recovery exports contain committed in-memory concept state, not unsaved form drafts, and can include private entered information. Invalid/future data is preserved for inspection; a dirty-form unload guard is a browser warning, not durable draft storage. File-origin persistence, native Obsidian behavior, complete accessibility and physical touch/pen/trackpad remain unqualified.

Third-party runtime provenance and license notices remain under [vendor](vendor). No font binaries or extracted host stylesheet are added. The surrounding panels retain concept rendering; the sitemap is the real Vue Flow island, not a claim that the entire companion is already a production Vue/Nuxt UI application.
