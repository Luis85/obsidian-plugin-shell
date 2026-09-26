# Design System: project-owned declarations and portable handoff

Status: implemented in the single-project companion concept. Scoped Nuxt UI stylesheet export and JSON-driven compiler application are implemented. Native authoring-vault persistence and arbitrary component-layout conversion remain separate work. The workbench theme is never replaced by the design being described.

## Product contract

A developer can describe the target plugin's visual language under **Design → Design System** and export the saved declaration as **Markdown**, a **self-contained HTML style guide**, or a **scoped Nuxt UI stylesheet**. This is a description/editor/export feature, not a font downloader, theme installer or CSS execution console.

The empty state offers **Start from Obsidian-friendly defaults** or **Start empty**. Merely opening the feature does not create project data. The starter is illustrative, not a claim about the active host theme's actual values. It contains host font roles, a compact type scale, spacing and size tokens, corner radii, light/dark fallback colors, and usage notes. Existing declarations are never replaced by a starter without user action.

| Section | Maintained values | Preview / behavior |
| --- | --- | --- |
| Overview | Name, description and design principles | Saved contract context and a sample using the declared type scale |
| Fonts | Stable key, name, host interface/text/monospace role or local family stack, fallback, usage and license/provenance notes | Locally installed font or fallback; no remote requests or embedded font binaries |
| Typography | Stable key, name, font reference, size in px/rem, weight, unitless line height, letter spacing in px and usage | Sample text with scoped styles, including unsaved valid draft preview |
| Spacing | Named dimensions and usage | Bounded ruler; exact value remains printed |
| Sizes | Control, icon, content or layout dimensions and descriptions | Bounded ruler; glyph size is not claimed as interaction-target size |
| Corner radii | Named px/rem dimensions and usage | Fixed sample with the declared radius |
| Colors | Stable semantic key, light/dark hex fallbacks, optional host variable reference and usage | Both swatches and the literal values; no injected CSS expressions |
| Usage guidelines | Named, described rules | Plain-text guidance for interactions, component variants and implementation |

Fonts referenced by typography cannot be removed until those references are changed. The model permits 12 fonts and 64 entries per other category. Names, notes, numeric ranges, units and references are validated before mutation. Stable keys are read-only on existing declarations; display names and values remain editable.

## Interaction rules

Each edit occurs on a draft. Save records one undoable transaction; an unchanged Save does not consume history, bump a revision or discard Redo. Cancel, Escape and attempted form closure retain the existing shared unsaved-edit protection. A removal review is displayed inside the current modal; Keep editing or Escape restores the exact draft. Removal and Undo affect declarations, not previously exported files or unsaved edits.

A draft binds the project owner and the complete saved design-system snapshot. Intervening changes invalidate the review and preserve the stale draft for recovery instead of applying it to a different record. Full-system validation rejects duplicate keys, missing font references, CSS/URL input where only names are accepted, and unknown schema fields.

Navigation uses selected/pressed semantics, hover styling and visible keyboard focus. Narrow workbench panes wrap category navigation and actions without horizontal page overflow. Long values wrap or scroll inside their preview, rather than enlarging the entire page. The host's existing visual vocabulary is preserved.

## Persistence and generation integration

`design.designSystem` is optional and schema-versioned. Legacy outlines without it remain valid. Saved snapshots, Undo/Redo and portable blueprint export/import retain the full object. Import validates all declarations before the canonical model changes. Restoring a snapshot from before creation removes the optional object rather than keeping stale values.

The existing source-plan preview includes:

```text
docs/design/DESIGN-SYSTEM.md
docs/design/design-system.html
docs/design/design-system.css
```

Changing a saved declaration invalidates a reviewed source plan because its handoff documents changed. Selecting another section or exporting does not mutate the design. Existing component definitions and variants are not silently restyled or rewritten. The shared compiler now binds saved tokens to scoped Nuxt UI and shell variables. See [stylesheet generation](../../development/DESIGN-SYSTEM-STYLES.md) for mappings, palette policy, generated paths and the remaining component-layout boundary.

## Export guarantees

**Markdown** contains frontmatter, design principles, complete token tables, usage notes, font provenance, and declared-palette contrast observations. Text is escaped for HTML/link/table syntax so authored notes are not interpreted as executable or clickable markup. Tables retain units and stable keys.

**HTML** is one readable, responsive file with section links, typography samples, spacing/size rulers, radii and light/dark swatches. It has no scripts, network dependencies or font files. A restrictive Content Security Policy blocks external assets, script execution, form submission and base-URL changes. Author text is escaped; only validated dimensions, font names and hex colors enter scoped sample styles. A light/dark document shell follows the viewer's preference, independently of the palette being documented. Print styling is included.

The HTML's rem preview uses an explicit 16 px root. Host font roles use documented local fallbacks outside Obsidian, so a font installed only on another computer may appear differently. Font references are not a font license, an availability guarantee or permission to redistribute binaries.

Exports contain **saved declarations only**. They do not mutate the vault, install a theme, or claim native acceptance; the separate shell generator imports the styles into the generated production build. Exported notes and descriptions are user-authored project data and may be private.

## Contrast scope

The guide compares `text/background`, `muted/background`, and `accent-text/accent` when both keys exist, in both declared light/dark palettes. It calculates relative luminance and compares the unrounded result with 4.5:1; display rounding is not used to decide a pass. These checks cover solid declared color pairs only, not the user's actual host theme, opacity, every hover/disabled state, screenshots or formal WCAG conformance. Missing pairs are not presented as passing.

## Implementation structure

- `style-guide-model.js`: starter, bounded validation, safe font/type presentation and contrast calculations.
- `style-guide-actions.js`: drafts, owner/snapshot checks, transactions, removal and export dispatch.
- `style-guide-views.js` and `style-guide.css`: section navigation, declarations, previews and modal forms.
- `style-guide-export.js`: deterministic escaped Markdown and inert standalone HTML; no DOM serialization of unrelated workbench state.

The shared selection/removal fixes for Sitemap, Entities and Data Sources remain intact. Only the common removal-return function is extended for the new modal; no parallel event listener or competing persisted selection model is added.

## Research and decisions

Reviewed 2026-09-24. The [Design Tokens Community Group format](https://www.designtokens.org/tr/2025.10/format/) describes dimensions and composite typography values; this feature follows that conceptual split while exporting the two requested documentation formats. It is **not** a full DTCG JSON interchange implementation and does not claim W3C Standard status.

[Obsidian's typography reference](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Reference/CSS%20variables/Foundations/Typography.md) and the repository's `docs/design/OBSIDIAN-TOKENS.md` support preserving host font preferences and distinguishing interface from reading text. The editor records host references and local fallback declarations rather than globally assigning authored values to `:root`.

[W3C's contrast-minimum guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) supplies the 4.5:1 normal-text threshold and the requirement not to round before comparison. [MDN's CSP reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy) informs a style-only standalone document policy; escaping and field validation remain necessary in addition to CSP.

## Acceptance evidence

`tests/concepts/companion-style-guide.browser.py` exercises real controls, draft protection, stale-save refusal, guarded deletion, Undo/Redo, blueprint round-trip, injection rejection, current-source generation and both actual download formats. It opens the exported HTML, checks no scripts/network requests, and verifies narrow-page reflow. Current totals and artifact identity belong to `TEST-DATA-DESIGN-VERIFICATION.md` and the final PR checks, not to the existence of this specification.

## Nuxt UI stylesheet authoring

The **Nuxt UI styling** section edits the saved palette policy and explicit token bindings using the same guarded drafts, Undo/Redo and stale-save checks. **Export stylesheet** produces the same deterministic CSS as the project compiler. Markdown and HTML now include effective bindings. The self-described companion JSON contains the frontend declaration and updated acceptance criteria. Native CP-007 remains unimplemented.
