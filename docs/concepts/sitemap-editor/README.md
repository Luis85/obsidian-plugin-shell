# Journey Lens — editor-only iteration

A sitemap editing surface built in **Vue 3 + Nuxt UI + Vue Flow**, without a surrounding SaaS application shell.

## Delivery status — read first

**This directory contains the requested-stack implementation source, not a compiled or browser-verified Vue build.** Registry access in the authoring environment failed (`EAI_AGAIN registry.npmjs.org`), and Vue/Vite/Nuxt UI/Vue Flow were not available in its package cache. Consequently, `npm install` and the actual Vue application build could not be completed here.

The source uses the real package APIs and Vue single-file components; it is not a renamed vanilla-JavaScript renderer. Nuxt UI's official standalone Vue/Vite integration is configured. However, component API compatibility, generated CSS, Vue template compilation, and Vue Flow runtime behavior still require the first dependency-equipped build and browser test. See `qa/build-attempt.txt` and `qa/design-qa.md`.

`review-preview/editor-only-review.html` is a **separate, self-contained, interactive layout review using the earlier vanilla-JavaScript renderer**. It is provided to inspect the shell-free layout now. It does **not** run Vue, Nuxt UI, or Vue Flow, and its screenshots are not evidence that the requested-stack source has been built.

## Run the requested-stack editor

Use Node.js 22.12 or newer, with network access for the initial dependency installation.

```sh
npm install
npm test
npm run dev
```

Open the development address printed by Vite. To create the intended self-contained HTML:

```sh
npm run build
```

The Vite single-file plugin is configured to produce `dist/index.html`, with JavaScript and CSS embedded. This output has **not** been generated in this delivery. After building, verify it locally in a browser, including opening it directly as a file. Initial package installation requires a network connection; the intended generated editor uses local data and bundled assets, not a backend.

Dependency ranges are specified in `package.json`. No lockfile is included because dependency resolution was unavailable. Keep and commit the generated `package-lock.json` after the first successful installation and build. Registry availability and successful resolution are not a substitute for the browser checks listed below.

## What changed

The global Companion navigation, workspace switching, profile avatars, account controls, application-library navigation, and simulated page/application previews have been removed. The root Vue component is the editor itself; `UApp` is a Nuxt UI provider, not a visible application shell. A memory router exists only for the UI library's link integration.

The visible surface consists of a slim editor toolbar, contextual breadcrumbs, the sitemap canvas or outline, an optional left page tree, and an optional right inspector. The sample SaaS pages are **nodes being edited**, not a running SaaS application around the editor. Layout names such as “App (with sidebar)” remain metadata on those page entities; they do not render that layout around the editor.

### Contextual page navigation

The inspector's **Related** tab exposes a page's parent, siblings, children, incoming navigation references, and referenced components. Selecting a related page selects that same page entity in the editor and centers it in the map. Nothing opens an application mock screen. A compact “In this section” area provides direct sibling links from the Details tab.

The left page tree is collapsible and searchable. It is an alternate representation of the sitemap, not a global product navigation rail. On small viewports the tree and inspector behave as alternative overlay panels rather than occupying the entire viewport together.

### Source implementation scope

- Vue Flow map with custom page nodes, structural edges, zoom, pan, minimap, focus, branch collapsing, manual node positioning, and automatic layout reset.
- Nuxt UI buttons, inputs, textareas, selects, switches, badges, dropdown menus, popovers, and dialogs.
- Page creation, metadata editing, parent changes, page duplication, page-only/branch deletion, and undo/redo.
- Separate hierarchy and route fields: moving a page does not rewrite its route or navigation references.
- Navigation references to existing page IDs; controls to add, remove, and reorder secondary navigation links.
- Role visibility as design intent, with restricted-state visualization. This is not authorization enforcement.
- Existing journey overlays and a create-journey dialog. Journeys remain on the sitemap; there is no walkthrough of simulated application screens.
- JSON import with a validation/confirmation step; JSON export; SVG export of the current visible hierarchy. SVG export does not include journey overlays.
- Browser storage, explicit save state, and session-only/error feedback. Export JSON for durable backups.

This list describes code included in the source. It is not a claim that its Vue runtime has been exercised here.

## Important interaction rules

**Arrange versus reparent.** In the Vue Flow source, dragging a node changes its visual position. Use **Move** or connect a source handle to a target page to propose a hierarchy change. Handle connections open a confirmation dialog; they do not silently reparent the target.

**One page, several references.** Secondary navigation links and journey steps store page IDs. They do not create duplicated pages or implicitly change the parent. The same page can therefore be reached from several contexts.

**Routes are independent.** A page's absolute route is not calculated from its parent. Equivalent dynamic route patterns are rejected. Duplicating a dynamic page appends a literal `/copy` segment, not merely a different parameter name.

**Safer removal.** In the Vue source, deleting a page can keep its children by moving them to the current parent, or delete the whole branch. Navigation references are cleaned up; journeys with fewer than two remaining steps are removed. Undo restores the prior document.

**Access is informational.** Role previews describe expected visibility. They do not implement authentication, tenant boundaries, permission checks, or row-level security.

## Data and compatibility

The sample contains 28 routable pages plus one organizational root, three layout definitions, six component definitions, and three journeys.

The domain layer accepts the previous `companion.journey-lens` version-1 JSON format and the new `companion.sitemap` version-2 format. Legacy journey descriptions are mapped into the new `purpose` field. Layout/component metadata and page references are retained. The root's example description has been clarified as a non-routable organizational group.

The version-2 document stores page nodes, hierarchy IDs, route metadata, navigation references, layout and component definitions, journeys, and optional visual node positions. View filters, panel visibility, temporary selections, and undo history are session/editor state rather than portable project data.

Import validates a single root, unique IDs, valid parents, acyclic hierarchy, supported types, route uniqueness, safe external-link protocols, referenced objects, and journey destinations. The source limits imported documents to 500 nodes and files to 3 MB. It replaces the current document only after confirmation; it does not merge two documents.

## Offline review — deliberately separate

Open `review-preview/editor-only-review.html` directly in a modern browser. Its toolbar/footer and About dialog identify it as the **offline review**. All of its assets are embedded.

It is based on the previous prototype so the layout can be inspected without installing packages. It is not a compiled view of the Vue source and does not promise feature parity. In particular:

| Behavior | Requested-stack source | Offline review |
|---|---|---|
| Runtime | Vue 3, Nuxt UI, Vue Flow | Vanilla JavaScript |
| Node drag | Changes visual position | Drag onto another page to reparent |
| Reparent | Move dialog or handle connection | Move dialog, outline parent, drag target |
| Duplicate | Duplicates one page | Can duplicate an entire branch |
| Delete | Keep children or delete branch | Deletes selected branch |
| Visual positions in JSON | Preserved in v2 | Not preserved by the legacy renderer |
| Application screen preview | Removed | Removed |

The review's exported page data can be imported into the Vue source. Do not use review exports to preserve new Vue-only layout positions. The browser checks below apply only to the review renderer.

## Verification actually completed

| Check | Result | Scope |
|---|---|---|
| Domain tests | 37 passed | Real framework-independent source model |
| JavaScript/script-block syntax | 12 files passed | Scripts only; not SFC template compilation |
| Review browser tests | 22 passed | Separate vanilla-JavaScript review |
| Review console exceptions | None observed | Tested desktop/mobile interactions |
| Review network requests | None observed | Self-contained review loaded via browser content injection |
| Package installation | Blocked | Registry DNS failure |
| Vue/Vite compilation | Blocked | Dependencies unavailable |
| Vue/Nuxt UI/Vue Flow browser QA | Not run | Requires successful dependency build |

Review browser checks include shell removal, tree visibility, related-page selection, metadata editing, add page, route-preserving move, undo/redo, outline, journey overlay, JSON download, mobile panels, and horizontal overflow. Mobile touch gestures, Safari, assistive technology, high-volume performance, and the requested-stack runtime are not covered by those checks.

## Required first-build acceptance checks

1. Run `npm install`, `npm test`, and `npm run build`; resolve any package/API/compiler integration issues before considering this a finished Vue prototype.
2. Confirm actual Nuxt UI components render and Vue Flow mounts without console errors. Check dropdowns and modals, which render in portals.
3. Test selected-node state, manual dragging, handle-based move confirmation, collapse/expand, minimap, focus, and undo/redo in the real Vue Flow runtime.
4. Test invalid route feedback, import rejection, v1/v2 import, JSON round-trip, navigation reordering, role switches, and storage-unavailable behavior.
5. Verify `dist/index.html` opens directly, contains its assets, and does not fetch external scripts, styles, fonts, or icon data at runtime. Lucide data is registered locally for Nuxt UI's default icons.
6. Compare the real compiled UI at desktop and mobile widths. Confirm there is no application shell or application-screen simulation. Test keyboard focus and touch behavior separately.

## Source structure

```text
src/App.vue                       Nuxt UI provider + editor, nothing else
src/components/SitemapEditor.vue  Editor orchestration and Vue Flow integration
src/components/PageNode.vue       Custom Vue Flow page node and handles
src/components/PageTree.vue       Collapsible page hierarchy
src/components/PageInspector.vue  Page details, related pages, navigation, access
src/components/ToolButton.vue     Nuxt UI toolbar control
src/components/Icon.vue           Embedded Bootstrap icon wrapper
src/composables/useSitemap.js      Reactive document, history, selection, storage
src/domain/model.mjs              Validation and structural operations
src/data/example.json             Compatible sample document
src/data/icons.json               Licensed embedded UI icons
src/style.css                     Editor styling and responsive behavior
tests/model.test.mjs              Dependency-free model tests
qa/                              Test evidence and honest build status
review-preview/                   Separate non-Vue layout review
```

There is no backend, login, real-time collaboration, CMS integration, full visual page/component editor, or simulated business application in this source. Those are intentionally outside this editor-only iteration.
