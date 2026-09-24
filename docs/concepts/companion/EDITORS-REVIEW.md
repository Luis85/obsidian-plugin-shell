# Three-editor code and product review

Review date: 2026-09-24. Baseline: `e72c3a6eb56f9fbb107679e41c1094d4900dab21`.

Scope: the maintained Sitemap, Entity relationships and Data Sources editors in the self-contained companion concept, their shared selection, forms, history, graph projections, generator-review boundaries and tests. This is not a native companion implementation or a new runtime data adapter.

## Assessment

The reported problems came primarily from inconsistent ownership of selection and edit transactions, not from the graph library failing to store every connection. A valid source-to-view handle drag already worked in the baseline. However, an unconfigured source silently substituted another source, some successful saves left the connection hidden, and the inspector could keep showing a previously selected surface. Together these made it difficult to tell whether the intended view and source were connected.

Retain the existing visual design, distinct navigation/containment/data relationships, source-operation contracts, semantic entity identities and one-vault workflow. Centralize selection and draft-removal behavior instead of adding another independent source of truth. No persisted schema migration or deletion of existing authored connections is required.

## Reproduced user reports

The same controlled command fixtures were executed against the exact old and corrected HTML. They complement actual browser-control and pointer tests; they are not reported as four physical-user journeys.

| Report | Baseline result | Corrected behavior |
| --- | --- | --- |
| Data source does not connect to the intended view | Asking to connect a source without operations opened another source's flow draft. Dropping on a view body did nothing. A hidden layer/collapsed parent could obscure a saved flow. | Keep the requested source identity; explain the missing operation. Compatible handles, keyboard activation, a source-handle drop on a card body, and Connect to card all open the same reviewed contract. Save reveals its endpoints. |
| New child creates two lines | New connected screen from a native view produced both `contains-<child>` and a redundant Navigate edge. | A new navigation child under its originating view adds one Contains edge. Explicit screen-to-screen transitions remain separate. |
| ER relationship cannot be removed in its modal | The edit modal had no relationship-removal action. | Remove relationship opens a second review inside the existing dialog. Keep editing/Escape restores the exact pending draft; confirm removes only the declaration. |
| Inspector displays unrelated content | An old surface selection took precedence over the selected source and retained surface-only tabs. | Source, data-flow and surface selections have mutually exclusive inspector contexts. The entire tab set and body update together. |

The raw before/after record is retained with the review evidence as `reported-defects-before-after.json`. Baseline HTML SHA-256: `a7848e4599ee2a216843686b20cf4b9618702193ca53c63a206d524cd4613da1`.

## Prioritized findings and resolutions

P1 denotes a wrong target, misleading canonical state or loss-of-work risk. P2 denotes a task-completion, comprehension, accessibility or recoverability defect. P3 denotes maintainability, performance or presentation debt. These are review priorities, not security vulnerability ratings.

| ID | Priority / perspective | Finding and correction | Acceptance evidence |
| --- | --- | --- | --- |
| E01 | P1 / correctness | Targeted source selection fell back to a different source when it had no operations. Reject the targeted command and keep its identity; show Add operation guidance and disabled Connect controls. | Unconfigured-source negative control; add first operation and connect that same source to a native view. |
| E02 | P1 / information architecture | Catalog browsing and canvas selection used the same `dsUi.selected` field. Separate `catalogSelected` from canvas selection. | Browse another source, return to the map, and retain the map's selected object. |
| E03 | P1 / inspector correctness | `designUi.selected`, `canvasUi.edge` and source selection could disagree. Introduce a typed selection projection, common selection transitions and normalization on rendering/history changes. | Source/surface/data-flow switching, stale-surface fixture, tab switches and full rerenders. |
| E04 | P2 / comprehension | Source selection displayed Components/Intent/Checks intended for a surface. Render Source/Operations/Data flows tabs, and a dedicated Data flow inspector for a selected usage. | Assert the complete tab sets, headings and contracts, not only presence of a source name. |
| E05 | P2 / discoverability | Saved flows could remain invisible because the data layer was hidden or a surface's ancestor was collapsed. Reveal the saved flow, expand only its ancestor chain, and frame both endpoints. | Save against a collapsed target with the data layer disabled; assert projected and selected edge. |
| E06 | P2 / direct manipulation | A source-handle drag required a tiny target handle and a body drop provided no review. Track the actual originating handle and route eligible body drops through the existing connection review. | Real mouse drag to native-view handles and body; reverse write drag; no canonical mutation before Save. |
| E07 | P1 / relationship semantics | Native-view child creation automatically added navigation on top of containment. Treat a default navigation child as containment-only; keep explicit screen-to-screen transitions and non-navigation cases. | Actual handle menu and create form; one projected Contains line; one Undo/Redo transaction. |
| E08 | P2 / lifecycle | ER modal offered no delete action. Add in-modal removal review explaining that entities and notes remain intact. | Modal remove, confirm, entity count, implicit relationship-field disappearance, Undo. |
| E09 | P1 / draft safety | Changing an edit form into a removal form discarded entered fields and could acquire a newer review identity. Share an inline-removal controller that retains the original draft and snapshot. | Edit caption, remove, Keep editing/Escape; concurrent-change rejection; restore saved rather than uncommitted data on Undo. |
| E10 | P1 / concurrency | Generic surface and typed-edge editors relied only on revision counters. Compare actual reviewed surface/edge identity, including connection anchors, at Save. | Same-revision intervening record/anchor mutations fail without overwrite. |
| E11 | P2 / history | No-op canvas commands appended history and removed the redo branch. Compare the validated canvas candidate before recording a transaction. | No-op after Undo leaves history, future and revision unchanged. |
| E12 | P1 / input recovery | Dirty detection examined only visible DOM controls, missing unsaved fields cached in another data-shape mode. Compare semantic draft data, including modified hidden modes. | Edit a field, change mode, Close, Keep editing, and recover exact input. |
| E13 | P2 / unnecessary interruption | Untouched shape caches could make a mode round-trip appear dirty. Record per-mode baseline drafts and ignore untouched inactive caches. | Fields → Not declared yet with no edits closes without a discard prompt. |
| E14 | P2 / hover and active state | Endpoint hover feedback disappeared after a selected data flow lost hover. Combine selected and hovered endpoint feedback. | Hover a selected data line, leave it, and retain both endpoint highlights. |
| E15 | P2 / accessibility | Hidden data handles remained in keyboard navigation; port activation did not distinguish incoming/write from outgoing/read. Keep measured handles mounted, remove hidden ones from tab order, and honor direction for keyboard/click activation. | Hidden handles have negative tabindex and aria-hidden; Enter on an incoming source port chooses write. |
| E16 | P2 / interruption recovery | Connection start/end paths could leave stale pending state or produce a second draft after an accepted handle drop. Clear pending connection state before handled connect, on teardown and on cancellation. | Escape during real drag, no mutation/modal, then successful ordinary source click; duplicate flow rejection. |
| E17 | P2 / lifecycle integrity | Expired source, operation, flow, entity or section IDs could create a new form or an empty removal review. Fail closed against current identity. | Expired command fixtures preserve the canonical snapshot and leave no modal. |
| E18 | P2 / catalog context | Filtering could leave a selected detail outside the visible results without explanation. Preserve the selected identity and explicitly label it as outside the filter. | Search excludes selected source; clear search removes the warning. |
| E19 | P3 / responsiveness | Selecting a source rebuilt the graph island and unexpectedly reframed the whole map. Update selection/inspector projections without remounting; reserve framing for explicit Show/Locate and successful connection reveal. | Ordinary mouse/focus selection and catalog-to-map return; no application-wide performance claim. |
| E20 | P3 / presentation and quality evidence | Removal used an unknown icon key, showing a generic box; current inventory text was also stale. Add the missing shared trash glyph, correct inventory, and register a dedicated cross-editor suite. | Batched dark/light and wide/narrow screenshots, exact assembly and inventory tests; final CI tracked on the pushed head. |

## Implementation decisions

### One selection projection, not a new persisted model

`editor-selection.js` defines source, data-flow, surface and empty selections, context-specific inspector tabs, and selection normalization. Existing legacy fields remain compatibility storage for neighboring modules, but selection actions use a common transition. Catalog focus is independent. Removing a record, hiding the data layer or traversing Undo/Redo cannot leave a hidden source selected over an unrelated surface.

The inspector is painted as one context: tabs, body and selection-kind metadata. Focus restoration checks the current selection rather than reselecting an old card simply because it existed before a redraw. Selecting a source does not change the generator input or navigate to its unrelated content components.

### Review a connection before changing the graph

Dedicated source handles retain unique input/output IDs. A valid handle connection is consumed once. A body drop is considered only when the start was a dedicated data handle, the pointer is on an eligible card body, the model owner/revision is current and no modal or active simulation blocks the action. It does not turn arbitrary surface navigation drags into data connections.

Read and write operations are selected by intent, not by the first operation in a source. A successful save selects and reveals the actual resulting data flow. A repeated operation/card/direction usage is rejected rather than appended. Data remains separate from containment and screen navigation. Existing authored parallel edges are not silently cleaned up because the tool cannot infer whether their author intended them.

### Delete declarations, not records or unsaved input

`editor-removal.js` stages removal on the existing draft. No saved data changes while the removal review is shown. Keep editing and Escape return to the draft; Save confirms removal against the original snapshot. Existing guards still protect used entities, sources and operations. Relationship removal removes its implicit field declaration, not either entity or any existing Markdown file. Restoring via Undo recovers the previously saved declaration, not edits the user never saved.

### Preserve the generator boundary

No data-source transport, authentication, SQL, synchronization or native vault writes were added. Only validated concept declarations feed existing generator previews. Selection, layer visibility and positioning do not invent executable contracts. Semantic changes invalidate a reviewed generation plan through the existing transaction path. Credential fields remain symbolic references; exports may contain private notes or paths and are not a secret scanner.

## Source review and references

Reviewed the route/dispatch chain, Vue Flow projection and event ownership, source/operation/shape validation, semantic/property contracts, connection construction, source-review invalidation, schema import guards, undo/redo, modal checkpoints, CSS visibility and focus, and the declared assembly/analyzer inventory. Added two narrow shared modules rather than replacing the renderer, dependencies, storage schema or all source files.

The technical implementation was checked against the official [Vue Flow handle guide](https://vueflow.dev/guide/handle.html) and [FlowEvents interface](https://vueflow.dev/typedocs/interfaces/FlowEvents.html): unique handles and explicit direction remain important; hidden handles stay measurable; connectStart and connectEnd have different payloads. No library upgrade was needed.

The catalog's Connect to card form and Position controls remain non-drag alternatives. This is consistent with [W3C's dragging-movements guidance](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html), but the changes and browser checks do not establish full WCAG conformance.

## Residual qualification

The new regression suite exercises real control clicks, mouse drags, keyboard input, computed styles and model readback, alongside explicitly identified state/concurrency fixtures. Local UI storage is controlled; real-origin two-page storage is separately required in CI. Formal screen-reader/physical-device acceptance, production semantic-code compilation, large-graph benchmarking, guaranteed obstacle/label avoidance and atomic cross-window locking remain unqualified. Current limits are safeguards, not performance promises.

The concept's authored fragments still share a global runtime; centralizing selection and removal reduces duplication but is not a completed ES-module/TypeScript migration. Native integration should use typed state/actions and domain services, not import these concept globals into the production template. The isolated concept zone and zero-finding production thresholds remain unchanged.
