# Unified components, stable connectors and spatial-editor review

Concept 11 · 2026-09-23. Source baseline: PR #5 at `d22cc1c86aece83624713a2d3da30d1fd048e6ed`.

## Product outcome

All library items now use the established content-brick workflow: select a definition, place an ordered instance, write screen-specific content, reorder it, and review shared-definition upgrades separately. There is no separate normal placement workflow for UI contracts. Their props/events/slots remain implementation metadata on the same reusable definitions.

The library contains 44 seeded definitions: 14 original brick definitions, 6 adopted UI definitions and 24 additional website/application patterns. Custom definitions use the same workflow. The serialized `bricks` key is retained for backward compatibility; it represents ordered component instances, not a separate product category.

Tags can be edited, normalized, searched and combined as intersection filters. Every tag is available in a picker; common tags have shortcuts. Sorting supports name, category, primary tag, usage and revision. Clearing a filter never removes a definition.

## Review across product and engineering perspectives

| Perspective / finding | Change or disposition |
| --- | --- |
| Product model: two concepts still had separate placement behavior | All normal library entries receive the same content specification and instance editor. Family filters and duplicate placement choices are removed. |
| Website planning lacked familiar building blocks | Added site header/footer, hero, feature grid, pricing, testimonials, FAQ, gallery, contact/newsletter, article and breadcrumbs. |
| Application planning lacked common interface patterns | Added sidebar, tabs, metrics, activity timeline, calendar, file upload, profile, code editor, conversation, progress, command search and permissions. |
| Information architecture: growing library needed classification | Search includes identifiers, names, descriptions and tags; multiple tags intersect. Five explicit sorting choices. |
| Reuse and ownership | Definitions retain stable IDs/versioned contracts; instances retain local content, ordering and overrides. No executable component code is loaded from a definition. |
| Compatibility: older UI placements could vanish during unification | Bounded one-time migration converts eligible placements, preserves current brick IDs and retains missing/over-limit references with visible warnings. |
| Data integrity: migration could repeat/reseed deleted templates | Library schema 3 makes adoption idempotent. Deleted definitions are not recreated on normal reads. |
| Source planning still enumerated only old bindings | Handoff now includes ordered instance IDs, definitions, versions and regions; retained implementation references are explicitly metadata. |
| Sections were decorative bands | Sections now expose empty-state drop zones and derive their bounds from the complete card geometry, including content height. |
| Spatial grouping was confused with hierarchy | Each card has independent visual membership. Dragging into a section does not reparent, change navigation or change the semantic fingerprint. |
| Drop-target instability while origin section expands | Drag-start destination zones remain stable for hit testing; live group bounds can grow without stealing the target. |
| Non-drag access | The surface inspector assigns a section without dragging; existing numeric position and move controls remain. |
| Undo granularity | A section drop records position and membership together; a single Undo restores both. Connected/inside creation inherits the source/parent's visual section. |
| Connector origins jumped when cards moved | Structural endpoint IDs were recomputed from relative positions on every frame. They are now stored in canvas metadata, initialized once, and edited explicitly through the line editor. |
| Layout commands could repin lines | Arrangement changes positions only. Existing structural and typed endpoint IDs survive arrangement, drag, Undo and Redo. |
| Handles were always visible or could stop receiving input | Handles retain DOM presence and dimensions; opacity controls idle visibility. Hover, selection, keyboard focus and active drawing expose relevant handles. |
| Cancelled input could leave a preview connection alive | Escape, pointer cancellation, outside release, blur, visibility loss and graph disposal clear the renderer's connection state and owned gesture state. |
| Stale callbacks could affect a replacement renderer | Delayed viewport, handle-measurement and drag-suppression callbacks are guarded against old owners/renderer instances. |
| Fixed card CSS disagreed with geometry | Inline width comes from the same measured projection contract. Padding is explicitly 8px; inner rows, grips, wireframes and footer have consistent alignment. |
| Visual alignment required trial and error | Edge/center guidelines are computed from peer cards with zoom-independent screen-pixel tolerance. Magnetic snapping is separately configurable; Alt temporarily suspends guidance. |
| Accessibility | Visible focus, keyboard handle menus, form-based connections, section select and existing non-drag sorting remain. No complete conformance claim. |
| Security and privacy | Data-only definitions; bounded tags, membership and anchor validation; text escaping; no new network dependency, credentials, host or shell access. |
| Performance | One queued paint frame updates spatial feedback; edge lists are not regenerated for every movement. Geometry updates are bounded and only scheduled on relevant mount/content changes. No FPS benchmark claimed. |
| Maintainability/release | New responsibilities are isolated into unified-library, spatial-model, spatial-runtime and unified styles. Root runtime, dependencies, locks and production quality policy are unchanged. |

## Connector contract

Explicit user-flow `sourceHandle` / `targetHandle` fields remain authoritative. Structural links now persist corresponding anchors under `canvas.anchors`. For older designs, the currently inferred side becomes their initial attachment once. Moving either card never runs side inference again. A parent change creates a new structural relationship; the relationship editor can explicitly change its endpoints. Endpoint-only changes are visual and do not invalidate generation inputs. A review also checks the original anchor snapshot to reject another view's intervening endpoint edit.

Vue Flow's documentation specifically requires stable handle IDs when several handles of the same type exist, warns against removing hidden handles from the DOM, and exposes `updateNodeInternals` for dynamic geometry. The implementation follows those boundaries without modifying vendor bundles. Controlled graph changes remain the application boundary, not a separate canonical data store.

Primary technical sources consulted 2026-09-23:
- [Vue Flow handles](https://vueflow.dev/guide/handle.html)
- [Controlled changes](https://vueflow.dev/guide/controlled-flow.html)
- [Vue Flow composables](https://vueflow.dev/guide/composables.html)
- [Action API including node internals](https://vueflow.dev/typedocs/interfaces/Actions.html)

## Section and guide contract

A section is a visual group, not a plugin parent. A drop changes one card's membership; the older root-group representation is expanded once to explicit membership for compatibility. Empty zones have stable anchors. Occupied zones include every member's card plus padding, and shrink/grow as content changes. Overlapping zones prefer an explicit destination over Main; the inspector is always the deterministic alternate route.

Guidelines compare left/center/right and top/middle/bottom anchors. The acceptance window is 7 screen pixels, converted through zoom. The guide overlay clears after commit or cancellation. Grid snap remains an independent existing preference; Alt suspends helper guidance, not the grid. No guide or section metadata is sent to business-code generation.

## Evidence and limitations

The current [verification record](UNIFIED-VERIFICATION.md) is tied to one exact HTML. The original studio remains a browser concept, not an installable native companion. The existing CLI inventory still contains historical fixtures and is not live project discovery. No automatic translation, native host qualification, real schema persistence, sandboxed project execution, compiled website or production boilerplate generator is claimed.
