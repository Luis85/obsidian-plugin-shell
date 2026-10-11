# Verification of the product family prototypes

## Automated exchange checks

`npm test` runs 26 pure protocol checks. They cover all 12 directed producer/consumer combinations, independent native ownership, a third editor forwarding references, canonical identity across kinds and workspaces, keep/update conflict choices, missing-source forwarding and recovery, link retargeting and deduplication, malformed schema/identity/data, the 32 MB package limit, and Markdown connection notes.

`npm run verify` runs the real HTMLs in Chromium with external HTTP(S) blocked. The integrated run checks:

- All four editors open with the compiled shared shell and publish their real records.
- Actual packages from each editor import into each of the other three, without mutating the receiver’s native data.
- A real Atlas UI definition becomes a locally owned Storyloom story and a Dissect review snapshot.
- The shared import modal rejects invalid schema, then reviews and applies a valid package.
- A package/native workspace identity mismatch is rejected before mutation.
- A family relationship survives forwarding and repeated import without duplication.
- Each editor’s native records and family context survive browser reload independently.
- The shared export produces a real downloadable JSON file.
- No browser page errors or external network requests occur in those flows.

The final machine-readable integrated result is included in `tests/integration-result.json`; the protocol report is `tests/protocol-test-report.tap`.

## Specialized editor checks

Component Atlas and Storyloom were checked for valid/invalid native inspection, stable identities, draft protection, creation, native restoration and undo. Storyloom also passed source-Markdown editing and source-provenance round trips in JSON and Markdown. Component Atlas’s native exports, including its C4 projections, remain reachable from the shared shell.

Sitemap Atlas passed native inspection/restore, validated Atlas binding with provenance, native JSON round trip, undo/redo with selection/scope, invalid and missing source rejection, draft guards, page creation, navigation views, and narrow-screen outline/inspector behavior.

Dissect passed all three existing real interaction scenarios: project selection, valid invitation, and invalid-email rejection. It also passed safe external adoption, duplicate-adoption behavior, provenance persistence, stable legacy ID migration, duplicate/undo/redo/group naming, metadata-only runner guard, and Storybook CSF3/manifest/ZIP generation. Its previously broken SVG minimap viewport was corrected and checked.

## Visual and interaction review

The shared shell and specialized editors were inspected in dark/light themes. The device-size set included 1440px desktop, 1024px intermediate, 768px editor checks, and 390px mobile. The integrated checks covered modal containment, shared navigation, focusable controls, native exports, theme propagation, and adoption UI. The final correction batch addressed the collapsed sidebar’s minimum width, accessible names for compact Import/Export actions, and duplicate notifications after Sitemap adapter actions.

## Targeted import and recovery checks

A real 245 KB formatted Component Atlas export was checked through both the file chooser and a clipboard paste event. Both paths stage the 28-record package without changing native data or connection records. A malformed substantial paste clears any previous valid review and disables applying it. Explicit import, validated Sitemap binding, source provenance, and a separate family relationship then succeed while the Atlas source stays unchanged.

A corrupted Dissect connection index was exercised through its real recovery UI. The recovery download preserves all original bytes, including CRLF and Unicode. Import remains blocked until recovery; Cancel preserves the raw index; Start fresh changes only the connection index and preserves all native data. A valid Atlas package can then be imported normally. These targeted flows produced no page errors or external requests. Their recorded results accompany the main reports in `tests/large-import-result.json` and `tests/recovery-result.json`.

The source development server was also opened successfully through both an app query (`?app=storyloom`) and a sibling HTML shortcut (`/component-atlas.html`). Both selected the correct editor without page errors.

These checks are evidence for the delivered prototype flows. They do not constitute a complete accessibility audit, production security assessment, or certification of an installable Obsidian plugin. Browser storage behavior depends on the host browser; portable JSON/native exports remain the durable interchange mechanism.
