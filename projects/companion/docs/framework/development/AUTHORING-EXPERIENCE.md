> **Framework reference — not this project's backlog or instructions; follow ./AGENTS.md**

# Focused sitemap authoring and arrangement

This increment builds on the existing Vue 3/Pinia/Nuxt UI/Vue Flow island; it does not replace the surrounding companion or create a second saved format. Build current authoring with `npm run companion:build`. The checked-in v5 compatibility HTML is not this output.

## Explicit editing behavior

**Focus canvas** hides the outline and inspector while preserving selection, lens and saved data. **Restore panels** restores their previous visibility. **Outline** or **Details** leaves focus mode and opens that panel in one action. Unsaved edits must be saved/cancelled before focus changes; no draft is silently discarded.

The status area remains present in narrow leaves. It distinguishes a pending name draft, unapplied dialog edits, an active operation and read-only recovery. The existing canonical session still decides whether a write committed. Cancel is unavailable during an active save, and failed edits keep their draft. Status copy is not a claim that browser storage has become native Markdown persistence.

**Arrange map** first opens a review describing its whole-map scope, including filtered-out surfaces. Confirming applies one ordinary `arrange` command, which is reversible through existing Undo/Redo and guarded against stale data. Routes, hierarchy, journey steps, component revisions and unrelated content are not changed.

**Set visual position** in Details provides X/Y controls as an alternative to dragging. Empty, nonfinite and out-of-bounds coordinates fail before saving. This changes diagram position only; **Move surface** remains the separate hierarchy operation. New surfaces without coordinates receive a deterministic fallback that avoids saved cards. Existing positions, even deliberate overlaps, are preserved until an explicit arrangement is confirmed.

## Implementation and verification

The pure [`arrangeSitemap`](../../../scripts/companion/sitemap/arrangement.ts) contract uses a 218-by-160 card footprint, spacing and canonical node order. Full arrangement distributes subtrees into columns and rows. It returns data rather than writing or approving it. Saved positions remain detached copies. The graph memoizes this calculation per committed snapshot, not per search keystroke, and each mounted editor uses its own Vue Flow instance ID. Failed/stale drags restore the committed display instead of leaving an unsaved position looking durable.

Labels clamp to the footprint while retaining full text in names/titles and the inspector. Controls have minimum target dimensions; scoped reduced-motion rules disable incidental transitions. Keyboard shortcuts ignore composition events and editable ancestors. These changes do not establish complete accessibility conformance or native mobile support.

Pure-model and actual pinned Vue/Pinia store tests cover layout bounds/determinism, coordinate preservation, invalid input, review/cancel, saved commands, Undo/Redo, focus restoration and draft protection. The existing file-origin MVP browser suite adds real arrangement, position and focus assertions; see the execution record (maintainer-only asset, not included) for whether a given candidate actually ran them. Complete assistive-technology, pointer/device and native multiple-leaf acceptance remain separate.
