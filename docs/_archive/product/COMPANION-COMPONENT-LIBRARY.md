# Component library and card refinement

Date: 2026-09-23. Scope: refine the provided Concept 07; preserve wireframe visualization and existing design-to-plugin workflows.

## Product decision

A content brick is a reusable component definition in the library. A brick on a screen is a versioned instance, not another copied definition. The separate code implementation reference remains optional: design readiness is not business-logic or test readiness.

## Reviewed findings and corrections

| Perspective | Observed problem | Correction / qualification |
| --- | --- | --- |
| Product model | Hard-coded content palette was outside the maintained frontend library. | One library, with Content bricks and UI contracts filters, shared lifecycle and usage. |
| Ownership | Shared defaults and screen-authored text could be confused. | Stable definition references, pinned versions, snapshots of previous defaults and explicitly reviewed upgrades. |
| Workflow | Component management required leaving the screen without a return path. | Manage in library and Back to screen preserve the selected surface. |
| Card hierarchy | Five floating controls in two rows competed with pan/zoom tools. | Three in-card actions; Add groups the four distinct creation intents. |
| Interaction | The bottom graph handle intercepted Add after moving the toolbar inside. | Graph hit areas moved outside the card; tested with actual pointer clicks. |
| Sorting | Old controls did not make reading order sufficiently obvious. | Numbered grips, before/after insertion indicators and inline movement alternatives. |
| Pointer stacking | New inline reorder controls could be obscured by a wireframe button. | Explicit stacking for reorder controls; actual retained pointer test reproduced and verifies the correction. |
| Keyboard | Rerender after sorting risked losing the focused instance. | Restore focus to the same stable grip after Alt+Arrow movement. |
| Discoverability | A large palette hid content/code distinctions. | Filter and search the unified catalog; no-results state clears unrelated details. |
| Lifecycle | Deprecated items should not invite new placement. | Hidden from new placement, explicitly discoverable in library; used definitions cannot be deleted. |
| Versioning | Editing defaults could overwrite local purpose/text. | Require version increment; upgrade only values still equal to the old default; preserve local overrides. |
| Integrity | Removed starter definitions could make stack creation fail after history mutation. | Preflight all three definitions before writing or recording a mutation. |
| Persistence | A new validation constant was initially initialized after saved-state validation. | Move validation bounds before hydration; rerun controlled-storage regressions. |
| Compatibility | Older designs have no content definition references. | Additive migration keeps old content and IDs; new schema marker prevents reseeding deletions. |
| Traceability | Uses only counted code bindings. | Combined usage list identifies exact content instances and code bindings. |
| Source planning | Repeated definitions could become duplicated output. | Shared definitions are collected once; ordered screen references are included in the content handoff. |
| Accessibility | Dragging must not be the only way to sort. | Earlier/Later buttons and Alt+Arrow; native assistive-technology conformance remains unverified. |
| Native fit | Six inspector tabs became compressed and unreadable. | Two rows of three tabs using existing tokens and focus treatment. |
| Scope | A complete-looking component library could imply implemented Vue business features. | Persistent design-contract and local-sketch labels; production generator and native behavior remain separate. |

## Acceptance contracts

- CL-01: One library holds both families without dropping the original six UI contracts.
- CL-02: Reusable content definitions have stable identity, default content, preview shape, version and lifecycle.
- CL-03: Screen instances keep independent identity, local content, reading order and region.
- CL-04: Library edits require a version increment when defaults change; no automatic instance rewrite.
- CL-05: An instance upgrade explains changes and preserves overrides, ID, order and optional code binding.
- CL-06: Usage reaches an exact screen instance; an in-use definition cannot be silently deleted.
- CL-07: Deprecated definitions remain inspectable but cannot be newly placed.
- CL-08: Deleted definitions do not reappear through ordinary rendering.
- CL-09: Dragging within a card is one undoable sort, not a node move or reparent.
- CL-10: Before/after drop indicators are stable; movement buttons and keyboard provide alternatives.
- CL-11: Three card actions remain accessible without overlapping graph handles or viewport controls.
- CL-12: Existing PRD, connection, intent, setup, source-review and quality workflows continue to work.
- CL-13: Legacy migration and controlled rehydration preserve authored values and definition references.
- CL-14: Missing/future definitions, stale reviews and invalid content schemas fail without destructive repair.
- CL-15: Viewport movement remains excluded from the semantic generation fingerprint; reading order remains included.

## Technical grounding

Vue describes props as one-way data flow; the design-to-instance split follows the same ownership principle, without claiming the prototype itself is a full production Vue port. See [Vue props](https://vuejs.org/guide/components/props).

W3C requires a single-pointer alternative to dragging for applicable controls. The explicit Earlier/Later actions complement, rather than merely duplicate with a keyboard, the drag interaction. See [Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements).

These references inform implementation decisions. They are not an accessibility certification. Full screen-reader, touch/pen, native-host, production-component rendering and real CLI qualification remain pending.
