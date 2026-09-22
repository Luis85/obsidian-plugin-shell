# Obsidian tokens and native host styling

**Version:** 1.0 · **Date:** 2026-09-22 · **PRD:** 0.7, TOK-01–06 (product requirements; executable test IDs are separately scoped).

## Developer use

The installed host owns Obsidian's CSS variables. Plugin styles **consume** them; they do not install a second light/dark palette, change global theme defaults, or copy host CSS into the plugin bundle.

`src/styles/index.css` imports `tokens.css`. It provides 38 optional `--plugin-shell-*` aliases scoped to `:where(.plugin-shell)`. Direct `var(--text-normal)` usage remains valid; developers do not have to wrap every native variable. Apply the namespace to each view/modal root that needs the aliases. Setup must eventually rename this namespace consistently with the generated plugin identity.

```css
.plugin-shell .task-card {
  color: var(--plugin-shell-text);
  background: var(--plugin-shell-surface);
  border: 1px solid var(--plugin-shell-border);
  border-radius: var(--plugin-shell-radius-md);
  padding: var(--plugin-shell-space-lg);
}
```

The aliases resolve from the host at their owning root. An override on a descendant does not retroactively change a custom property already resolved on an ancestor: scope the aliases to the actual root of a separately themed subtree, or use the host variable directly there. Root theme changes and user snippets remain effective. Fonts are family references only; no font binaries are bundled.

## Three different token inventories

| Artifact | Meaning |
| --- | --- |
| `docs/design/obsidian-tokens.json` | 133 reviewed names from ten official reference categories, deprecation data, and two separately labeled observed runtime font names. It is a starter reference, not a claim to mirror the complete documentation. |
| `harness/styles/vendor/token-inventory.json` | 968 lexically declared custom-property names in the provided extraction. Presence is not proof of a nonempty computed value or public API stability. |
| `src/styles/tokens.css` | 38 plugin-owned aliases using selected host variables. No copied numeric/color defaults. |

Categories cover semantic/status colors, spacing, typography, icons, radiuses, layers, text inputs, modals, dialogs and buttons. Additional editor/core-plugin/window variables remain available through the host and are visible in the extracted inventory; they are not automatically advertised as reviewed public contracts. Obsidian Publish variables are not needed by this plugin baseline.

The official color reference deprecates RGB/HSL helpers as of 1.13. New aliases must use semantic color variables rather than `--color-red-rgb`, `--interactive-accent-hsl`, and related helpers. Use `color-mix()` where appropriate. Existing compatibility declarations remain in the pinned vendor snapshot, unchanged. The official spacing guide recommends its size grid; these aliases map to it rather than inventing a competing scale.

## Actual host stylesheet

The default fixture now uses the extraction requested by the owner:

- Repository: `Luis85/renovation-planner`
- Source path: `tests/harness/obsidian.css`
- Source commit: `ed5c50b76c481653b0bc19e30ebbf0a03e2da65c`
- Source Git blob: `eb7b27320341f9ed0874bf152ed9955d82d38221`
- Decoded SHA-256: `c82582f1a05fc9dc17582b028841021c537d05eb3d5f9aab551836b4cb37195c`
- Decoded size: 146,116 bytes / 4,813 lines.

The repository keeps a losslessly compressed snapshot, `harness/styles/vendor/obsidian.css.gz`, with the complete original header. No network request or dependency installation is required to use it. The fixture server serves the normal CSS URL `/harness/styles/vendor/obsidian.css` using the checked decoding/normalization helper. Static tooling may export the same bytes with `node scripts/styles/export-host-css.mjs`; future Vite harness provisioning must reuse this helper, not fetch mutable `main` during a test.

**The raw source is byte-identical, but the runtime response has one documented comment-only repair.** The original header contains `--page-*/--scale-factor`, which prematurely ends a CSS comment. The helper changes that single occurrence to `--page-* / --scale-factor`. It changes no declaration/selector. Tests check the raw source hash and that reversing this repair reproduces the original exactly. Runtime CSS has its own SHA-256 in provenance and browser reports.

The source header says the sheet was reduced from selected application states and does not record the original app version. The `1.13.0` compatibility-floor marker is not an app-version attestation. No native comparison has been performed here. The extraction is not relabeled as original MIT code; its original rights/provenance remain, with redistribution review a maintainer responsibility. No fonts or remote assets are supplied.

## Ordered layers and isolation

```text
Default dedicated harness document
  1. obsidian.css → verified extraction + explicit host-adapter.css
  2. src/styles/index.css → plugin aliases
  3. fixture.css → scenario layout / alias examples
```

The extraction has global host rules. Use it only in a dedicated harness document or isolated iframe, never in a parent application/production plugin. `host-adapter.css` supplies only the gaps required by the specimen: scrollable document geometry, shell/settings wrapping, missing selects/notices, browser-dialog accommodations and accessibility behavior. It does not replace the extracted base palette, spacing, or typography. The manifest lists modeled surfaces; those adapters are not claimed to be native implementations.

The previous original simulator remains at `simulated.css` and `style-fixture/simulated.html`, selectable explicitly with `--host simulated`. It is **not** stacked above the extraction or chosen automatically if the snapshot is missing/corrupt. Native defaults are the initial density in the extracted profile; comfortable sizing is an explicit specimen override.

`dist/styles.css`, once the actual plugin build exists, includes only plugin modules and compiled SFC styles. It must exclude the vendor archive, host adapter, simulator, gallery and provenance catalogs. A current source-entry check covers the small token module; full Vite artifact exclusion and native styling remain later acceptance work.

## Verification now available

```sh
node scripts/styles/check-tokens.mjs
node scripts/testing/verify-baseline.mjs --repeat 3 --json
node scripts/harness/serve-style-fixture.mjs --port 4174
```

The checks validate the pinned snapshot, runtime repair/hash, inventory drift, alias grammar/scope, prohibited host-default redefinitions, missing/deprecated names, load order, profile distinction and HTTP-delivered bytes. The alias grammar check is intentionally narrow, not a new general CSS parser. Corrupt archives/oversized decoded content fail; raw source cannot bypass integrity by having a vendor-like filename.

Browser checks extend the existing 8 cases to 12 per profile. They assert native input/radius/spacing, theme override propagation, missing alias/host negative controls, and selected-profile evidence, alongside original interactions. Fixed sleeps are not used to await computed-style changes.

The archived upstream sheet is a named immutable vendor-input exception to handwritten line limits. Its decoded line count and source hash remain recorded. All handwritten CSS/JS/scripts retain 400 lines; test files retain 450; new source under `src/` is included in execution hashing. Packing a new handwritten file is not permission to bypass source policy.

## Normative additions

**TOK-01:** Supply a sourced token reference and usable plugin-scoped aliases without redefining host theme defaults.

**TOK-02:** Preserve exact upstream source identity, record unknown app version and rights, and constrain any runtime transformation to reviewed tested changes.

**TOK-03:** Default to the extracted dedicated-document host layer, with explicit adapters and deterministic host → plugin → fixture order. No silent simulator fallback.

**TOK-04:** Test theme/snippet propagation and missing-host/missing-plugin negative cases through real computed styles; record profile and input identity.

**TOK-05:** Keep extraction, compatibility declarations, font names, provenance and native-comparison claims accurately distinguished. Never distribute font binaries or relabel third-party CSS as original MIT work.

**TOK-06:** Reject unreviewed/deprecated/missing alias targets and snapshot drift; maintain separate source limits and artifact exclusion requirements.

## Primary sources

Official [CSS variable index](https://docs.obsidian.md/Reference/CSS%20variables/CSS%20variables), [Colors](https://docs.obsidian.md/Reference/CSS%20variables/Foundations/Colors), [Spacing](https://docs.obsidian.md/Reference/CSS%20variables/Foundations/Spacing), [Typography](https://docs.obsidian.md/Reference/CSS%20variables/Foundations/Typography), [Icons](https://docs.obsidian.md/Reference/CSS%20variables/Foundations/Icons), [Layers](https://docs.obsidian.md/Reference/CSS%20variables/Foundations/Layers), [Radiuses](https://docs.obsidian.md/Reference/CSS%20variables/Foundations/Radiuses), [Text input](https://docs.obsidian.md/Reference/CSS%20variables/Components/Text%20input), and [Modal](https://docs.obsidian.md/Reference/CSS%20variables/Components/Modal). The catalogue links its additional source categories. Where the website did not resolve, the corresponding files in the official `obsidianmd/obsidian-developer-docs` repository were inspected.

The [owner-supplied extraction at its pinned commit](https://github.com/Luis85/renovation-planner/blob/ed5c50b76c481653b0bc19e30ebbf0a03e2da65c/tests/harness/obsidian.css) is the stylesheet source. It is not documentation that every retained variable is a stable public API.
