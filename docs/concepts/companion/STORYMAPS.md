# Storymaps

**2026-09-24 · Browser authoring concept on PR #5. Not a native companion installation.**

Storymaps connect product intent to planned user experiences without turning the sitemap into a backlog. Activities group meaningful goals, steps describe the experience from left to right, and stories define capabilities or variations. Release lanes represent planned scope and intended outcomes, never implementation or verification evidence.

## Open and create

Open **Storymaps** in the Design navigation to browse the current vault project's maps. Search by title, purpose or audience, filter by state or linked PRD, and create, duplicate, archive or restore a map. A blank project starts with no maps. No second project or project picker is introduced.

From **Product requirements → a PRD**, use **Create linked storymap** or **Link existing**. Creating pre-fills a suggested title, audience and intended outcome, but does not fabricate stories from requirements. Map-to-PRD links are optional and many-to-many. Both entry routes open the same map. **Back to PRD** restores the originating PRD, selected tab and scroll context; **All storymaps** opens the overview.

The built-in **Load companion project** example includes *From plugin intent to a portable design*: two activities, three steps, five stories and two release slices, plus Unplanned. Its data is editable through the same model as any user project, not a hardcoded screen. The self-project also describes Storymaps overview/detail surfaces, five related requirements, and Storymap/Story authoring entities.

## Edit the experience

**Add activity** creates a meaningful goal. Use **+ Step** or the selected activity's inspector to add its steps. Use **+ Add story** in a step/release cell, or the inspector/Outline equivalent, to add a story. Titles are required; descriptions, acceptance notes and artifact links can be refined later.

**Add release** creates a named slice with its intended outcome. Unplanned is a built-in unassigned state, not a removable release record. A story belongs to exactly one step and at most one release in the same map.

| Action | Meaning |
| --- | --- |
| Drag a story into another column/lane | Change its step and/or release; insertion feedback previews the destination |
| Drag within a cell | Change the story's order within that step/release combination |
| Drag an activity | Reorder it with its steps and stories |
| Drag a step | Reorder it or move it to another activity while retaining its stories |
| Move… | Perform the same changes through named destination and insert-before controls |
| Edit a release → Move… in Outline/inspector | Change the release order without changing story identities |
| Escape during a drag | Cancel the transient gesture without changing the map |
| Undo / Redo | Reverse or reapply one committed design transaction, not individual pointer frames |

On desktop, Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y operate design history when focus is outside input fields and dialogs. Text fields keep their ordinary text-edit history. History belongs to the project design: it is not a separate undo stack that could corrupt shared artifact state. No-op moves preserve the document and redo branch.

Select a card to inspect it; selection does not reframe or remount the canvas. **Fit map**, **Locate selection** and zoom controls are explicit view operations. **Details** opens/closes the inspector. Its guide collapses on narrower panes. Panning, zoom, selection, inspector visibility and transient drag state are local view preferences, not exported authoring fields.

**Outline** is another view of the same records, with editing and Move controls. Narrow entry defaults to Outline. The canvas is intentionally pannable when the complete map does not fit; it does not shrink all card text merely to show every column at once.

## Connect artifacts, not copies

Activities, steps and stories can link multiple existing sitemap items. The searchable picker shows names and surface kinds, retains selected references while searching, and includes unresolved references so they can be unchecked. Selecting a linked surface opens and selects the existing sitemap item, revealing its inspector and ancestor path. Sitemap inspectors expose **Used in storymaps** backlinks to the map and linked item.

A story can also reference individual PRD requirements. Requirements remain owned by the PRD; the storymap neither duplicates them nor rewrites the existing direct requirement-to-surface mapping. An activity's link does not implicitly map every descendant story. Links are shown as compact references, not a permanent cross-artifact web of canvas edges.

Names resolve through stable identities. Renaming a surface changes its displayed name without changing the link. Removing an external target retains its ID and last-known label with **target missing**. Relink by selecting a replacement and unchecking the unresolved target. Missing external references produce advisory findings and remain exportable; broken internal parent/release relationships are invalid.

A story distinguishes **Not decided yet**, **Uses an interface**, and **No UI required**. Choosing No UI required while retaining surface links is rejected with a recovery message; links are not discarded automatically. An unlinked story is not automatically an error.

## Deletion, drafts and storage

Forms edit drafts, never live canonical records. Save checks the exact reviewed owner/design snapshot, revision, active operations and retained browser storage before committing. Observed stale changes keep the draft and do not overwrite current records. Failed persistence restores previous canonical data and history.

Closing a dirty form offers the existing keep/discard protection. Remove opens a second review inside the form; Keep editing or Escape restores the exact draft. Confirm applies deletion to the saved state, not unsaved edits. Undo restores that saved state.

Deleting an activity or step removes only its descendants within that map. Removing a release keeps its stories and moves them to Unplanned. Removing a whole map leaves PRDs, requirements, surfaces and other maps intact. Surface removal review names affected storymap links. No operation deletes generated code, native vault files or external artifacts.

Archived maps disable card authoring and drag operations. They remain readable/exportable; overview/map settings allow explicit restoration and map-level administration. Duplicating creates fresh internal IDs, retains external links, and starts an editable Draft. Collection counters never rewind through Undo/Redo.

The concept continues to use the existing singleton browser storage and recovery behavior. This is not atomic cross-process locking. Local file-origin persistence, assistive technology and native Obsidian persistence require independent acceptance.

## Portable data and export

**Export → Export project JSON** includes every saved storymap in the complete project, with identities, ordering, parent assignments, release assignments, PRD links, surface links and requirement links. **Export Markdown** emits a readable single-map brief, ordered by experience structure and release slices; it is not an import format.

Current full-project exports use `schemaVersion: 2` and `design.schema: 2`. Older v1 projects without storymaps remain readable and are treated as having an empty collection. A v1 envelope containing storymaps, unsupported versions, unknown record fields, duplicate IDs and invalid internal references are rejected before replacement. Older clients reject new schema-2 projects rather than silently dropping the feature. The storymaps subsystem itself starts at schema 1; these version numbers have different scopes.

The portable definition uses ordered arrays rather than persisted coordinates:

| Record | Canonical fields |
| --- | --- |
| Collection | `schema`, `nextId`, `maps` |
| Map | `id`, `title`, `purpose`, `audience`, `status`, `revision`, `updatedAt`, `prds`, `activities`, `steps`, `stories`, `releases` |
| Activity | `id`, `title`, `surfaces` |
| Step | `id`, `title`, `activityId`, `surfaces` |
| Story | `id`, `title`, `stepId`, `releaseId`, `description`, `acceptance`, `ui`, `surfaces`, `requirements` |
| Release | `id`, `title`, `outcome` |
| External reference | `{ id, label }`, with `prdId` added for a requirement |

`releaseId: null` means Unplanned. Array order is authoritative within each parent/cell. The shared `scripts/companion/storymap-contract.mjs` validator is used by the browser and read-only Node handoff. Vue Flow is a disposable projection of this model, not a second persisted source of truth.

The shell entrypoint still only validates the supplied export and target, then returns the exact input bytes. Transfer format v2 does not imply a writable generator v2. Storymap data is excluded from the older illustrative boilerplate compiler fingerprint/output; changing a lane is not authorization to generate code. Full-project JSON remains the lossless interchange route.

## Bounds and implementation ownership

The validated limits are 12 maps per project; 24 activities, 100 steps, 500 stories and 12 release lanes per map; 4,000 total map/item identities; and 120 references per reference array. Map/item titles allow 120 characters. Description and acceptance notes allow 8,000 characters each. The existing 4,000,000-byte transfer limit and allocation/depth limits also apply. These are safety limits, not a 500-card browser-performance promise.

`storymap-model.js` owns ordering, movement, references and deterministic layout. `storymap-actions.js` owns project transactions/history and navigation. Forms, overview/detail/Outline, Vue Flow runtime, Markdown export and deterministic example data live in separate modules. Existing control helpers, theme tokens, notification and dirty-draft handling are reused. Dependencies, vendored runtimes and root native plugin code are unchanged.

## Native conversion and deferred scope

Shell qualification still comes first. Native conversion must implement a typed domain and a documented repository/Markdown codec, preserve manual note edits, resolve renamed/deleted records, and qualify multi-view lifecycle and recovery. A note-backed aggregate per map with a configurable folder remains a proposal, not a feature of this browser increment.

Real-time collaboration, remote delivery-tool synchronization, reusable work-item placements, automatic story generation, dependency scheduling, baseline comparisons, standalone map import and HTML export are deferred. No sprint planning or automatic requirement implementation status was added.

Read [STORYMAPS-VERIFICATION.md](STORYMAPS-VERIFICATION.md) for tested artifact identity, named suites, controlled fixtures and remaining gates. Native conversion must account for these records and interactions under [CX-007](../../tasks/concept/CX-007.md).
