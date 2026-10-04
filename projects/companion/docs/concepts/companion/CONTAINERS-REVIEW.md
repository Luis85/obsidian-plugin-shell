# Container and connection review

> Concept 12 · 2026-09-23 · Browser concept only. Baseline: PR #5 at `c8f4972b16a5aeaea4d17d0f941b552c27794da5`.

## Outcome

The sitemap now distinguishes a native **view container** from a content-bearing screen and a **navigation group**. A native view remains a host-owned entry surface with an explicit layout, placement and child-screen relationship. It is shown as a distinct host-layout card, not as a second visual section or a geometric box that automatically reparents nearby cards. Native host integration is still a future implementation.

Screens retain the existing library-backed content editor. Previously authored components on native views are preserved and explicitly reachable through **retained components**; this iteration does not silently delete or migrate them. New native views need no component stack. Navigation groups are compact organizational nodes in all three representations and no longer pretend to have page content or a screen wireframe.

## Findings and fixes

| Perspective / finding | Change and acceptance boundary |
| --- | --- |
| Geometry — Structure cards exceeded estimated height | One explicit rendered height drives card rectangles, section bounds, layout spacing and connectors. Removed obsolete bottom padding reserved for a retired toolbar. Current structure cards are 300 units; view containers are 300 or 326 when retaining legacy content; groups are 180. Content-bearing cards derive height from their ordered stack. |
| Section padding — the implicit main section was omitted from Fit | Fit includes visible section bounds, including the main section. Side/bottom padding is 40 units and top space 64; measured card heights are included. Section headings scale within the reserved band and hide only below overview zoom 0.25; the outline remains available. |
| Cross-section lane layout | Every automatic arrangement runs independently within each visual section, then places section results in separate vertical bands. Empty sections receive independent slots. Membership and application hierarchy are not rewritten. |
| Stable source identity | New code names derive from the label. A collision appends `-2`, `-3`, and so on. Existing names stay stable when a display name changes. Explicitly entered duplicates remain a validation error, not an implicit rename. |
| Ownership mental model | View container shows host layout, initial placement, entry designation and child count. **Add screen** starts with the correct owning parent. The opening host and its internal screens remain distinct model entities. |
| Navigation groups | Group cards display membership instead of empty content and layout placeholders. The property editor omits irrelevant layout controls; stored older metadata remains compatible. |
| Cropped layout sketches | Full, bounded SVG diagrams replace clipped miniatures on Structure cards and host-layout containers. The chosen layout name remains visible on content/wireframe screen cards as well. These are schematic previews, not rendered production layouts. |
| Truncated connection paths | The inner, transformed edge SVG previously clipped graph coordinates to its own untransformed viewport. Allow graph overflow on that SVG while keeping the outer editor viewport clipped. Far-origin pan/zoom and actual SVG hit testing are covered. |
| Connection label editing | User-flow captions remain editable. Structural captions now have an editable display label; their underlying meaning stays Contains. Visual labels live with canvas metadata, not a new relationship type. |
| Connection removal | Both editors expose removal. User-flow removal confirms and preserves surfaces. Removing containment offers a valid replacement owner where required; it cannot leave internal screens orphaned or delete their content. |
| Endpoint dragging | Selected lines expose Vue Flow updater circles. Dragging proposes changes in the existing editor; Save commits once, Cancel keeps the original, Undo restores identity and endpoints. A structural line remains identified by its child; its origin can propose another owner, and its target can move to another anchor on that same child. Changing the owned child is deliberately not a silent replacement. |
| Gesture ownership | Reconnection is separate from creating a connection. Escape and renderer cleanup remove pending gesture state. Releasing a drag never creates a duplicate edge or executes plugin code. |
| Pointer obstruction | Edge labels avoid endpoint controls. The floating card toolbar hides for selected connections and accounts for cards/labels/updater controls when placing itself. This prevents it intercepting line edits. Dense arbitrary graphs still need pan/focus; this is not a complete obstacle router. |
| Stale review | Structural edits compare the full anchor snapshot, including the display label, so a concurrent visual change cannot silently be overwritten. Semantic reparenting still validates against the complete candidate design. |
| New-card placement | Collision checks now use the proposed card's actual size, including top-side placement, rather than a legacy fixed-height estimate. |
| Context continuity | Starting Add screen immediately refreshes card selection and toolbar context; cancelling no longer leaves another card's actions visible. |
| Accessibility | Existing forms remain alternatives to dragging. Endpoint gestures use the real pinned Vue Flow API. Menus, modals, keyboard editing and viewport layouts retain scoped tests; no full accessibility certification is asserted. |
| Safety and maintainability | No root runtime, dependency pin, lockfile, test threshold, deployment scope or permission policy is changed by the concept source. All new model/interaction code is kept in readable bounded modules. |

## Task flows

**Create the opening view:** Add view → choose name and host layout → choose initial placement → Save → Add screen from the container. Stable code generation follows the visible name until deliberately edited; subsequent visible renaming never silently moves generated paths.

**Reconnect an existing user flow:** Click line → close the inspector dialog without changing it → drag one of the highlighted endpoint circles to a compatible card handle → review destination, type and label → Save or Cancel. The new destination can require a different semantic type, which remains visible in that review.

**Edit structure:** Click Contains → edit caption and/or owner and anchor sides → Save. Caption/anchor changes are visual; changing ownership is semantic. Remove relationship keeps the surface and requires a replacement owner for internal screens. This prevents a delete-line gesture from silently deleting an entire subtree.

**Arrange sections:** Arrange → choose Surface lanes, grid or hierarchy. Each section is laid out separately, including independent native views, dialogs and settings that share a visual group. The result never places another section inside its bounding rectangle.

## Technical evidence and retained limits

[Current verification](CONTAINERS-VERIFICATION.md) identifies the exact candidate and executed suites. The stored type remains `view` for compatibility. A view-container card is a semantic host representation, not a production Obsidian leaf implementation or a nested Vue Flow parent-node migration.

Fixed anchor sides take precedence over shortest-line routing. Labels may move off a path when space is too tight to keep both card content and endpoints usable. No optimal edge routing, multi-user transactions, cross-process save guarantees, native UI conformance, real source generation or deployment is claimed.

The implementation uses the pinned Vue Flow 1.48.2 controlled updater events and its existing handles. Primary API references consulted: [updatable edges](https://vueflow.dev/examples/edges/updatable-edge.html), [handles](https://vueflow.dev/guide/handle.html), [controlled flow](https://vueflow.dev/guide/controlled-flow.html). No React Flow API or dependency was introduced.
