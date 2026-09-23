# Shell Workbench — component-library concept

Concept 08, 2026-09-23. This is the current companion UI concept, not a native Obsidian plugin or a production scaffolder.

Open `index.html` in a modern desktop browser. Vue, Pinia, Vue Flow, styles and icons are embedded. No CDN, npm installation or runtime network request is required. GitHub displays HTML source rather than executing it.

## What changed

Content bricks now belong to the same component library as frontend contracts. The initial library contains fourteen content definitions and six UI contracts. A screen contains ordered, version-pinned instances of those definitions. Each instance retains its own ID, purpose, text, region and optional implementation binding.

Use **Component library → Content bricks** to create, edit, duplicate, version, deprecate or remove unused definitions. Preview, Definition and Usage separate visual planning, the shared contract and its consuming screens. The approved low-fidelity wireframes are retained. These are design definitions, not compiled Vue components or proof of tested business logic.

An existing definition's content defaults cannot change without a version bump. Existing screen instances are not overwritten by a library edit. **Usage → Review upgrade** shows which fields keep a local override and which adopt the new default. Upgrading one instance preserves its ID, reading order and implementation binding. Stale pins block the illustrative boilerplate plan until reviewed.

## Card interactions

The crowded floating toolbar is replaced by a single row inside the selected card: **Edit · Add · More**. Add distinguishes a content component, a connected card, a screen inside the container, and a code-level contract placement. Handle click menus and handle dragging remain available; containment and user-flow connections remain separate.

Content grips are numbered. Drag a grip above or below another brick to reorder. An insertion marker indicates the destination without moving the card. A completed sort is one undoable operation. Earlier/Later controls appear on hover or keyboard focus; **Alt+Arrow Up/Down** works from a focused grip. Moving a screen in the map does not reorder its content. Reordering content changes reading order and invalidates the design's reviewed source plan.

Top and bottom graph handles sit outside the footer hit area, preventing them from intercepting the Add action. The inspector's six tabs use two readable rows rather than six cramped labels.

## Walkthrough

1. Choose **Explore example → Sitemap & views**, select Collection and Focus.
2. Click **Add → Content component** and choose a reusable definition. Review local content, then save the instance.
3. Reorder with the numbered grip or Later/Earlier; compare Undo and Redo.
4. Open **Component library**, filter Content bricks, duplicate Board and maintain a custom definition.
5. Place it in a screen. Edit its defaults and increase the version. Review that screen's upgrade: local text remains yours.
6. Continue to PRDs, connections, source review or setup. Those established workflows remain concept-only and do not execute commands.

## Data and compatibility

Legacy blueprints are upgraded additively when adopted. Authored text, IDs, order, notes and existing implementation references are preserved. A versioned marker prevents deliberately removed definitions from reappearing on every render. Unknown future schema versions and executable schema fields fail validation. A missing or deprecated starter definition gives recovery guidance rather than partially appending a stack.

Library definition, screen instance and implementation contract are related but not interchangeable. The optional code-level component mapping is retained: a described content block can exist before its actual Vue implementation. No source file is silently removed when an instance or definition is removed.

Only the concept's own browser state is saved. Imported data grants no execution permission. The concept makes no remote requests. Explicit Markdown/JSON exports create local files, not a plugin installation.

## Source and qualification

Edit `src/` and run `python scripts/concepts/build-companion.py` from the repository root. `--check` compares assembly with the committed HTML. Vendor bytes, licenses and source provenance are retained in `vendor/`; there are no font files.

The root plugin remains TypeScript/Vue/Pinia/Nuxt UI with its existing architecture and scripts. This concept does not change its dependency lock, manifest, permissions, lifecycle contracts or production verification gates.

See [the review and requirements](COMPONENT-LIBRARY-REVIEW.md), [verification](VERIFICATION-LIBRARY.md), the linked historical concept guides, and the [companion PRD](../../product/COMPANION-PLUGIN-PRD.md). Previous evidence remains historical, not automatic qualification of this version.
