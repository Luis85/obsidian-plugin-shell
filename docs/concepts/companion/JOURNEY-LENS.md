# Companion: Journey Lens sitemap replacement

## Current review entry

From the repository root, after installing its qualified locked dependencies:

```sh
npm run companion:build
```

Open `reports/companion-mvp/companion-journey-lens.html`. Its companion export is
`reports/companion-mvp/companion-project-v6.json`. Both are byte-identical aliases
of the checked authoring outputs `index.html` and `companion-project.json` in that
**reports** directory, not the old checked-in v5 compatibility files.
The existing Companion workflow includes these files in `companion-mvp-authoring`.
The HTML embeds its runtime, CSS and icons; it needs no server or runtime CDN.

Use **Load companion project**, confirm the import, then **Design → Sitemap & views**.
Journey Lens replaces the old sitemap inside the existing Companion workbench.
The page editor, component library, data sources, requirements and other workspaces
remain in that shell. This is not a second application or a generated clickdummy.

## Interaction contract

Structure shows containment, Navigation shows explicit transitions, and Journeys
shows the selected path through those same surfaces. The outline follows the
actual hierarchy. The inspector exposes the selected surface and its parent,
siblings, children and connected surfaces. Opening its page editor uses the same
surface ID; Back restores selection, lens, search and panel state within the session.
Context is keyed to the project object and discarded when that project is replaced.
It is neither a second project store nor a claim of cross-session preference storage.

The journey step strip selects existing surfaces without opening an application
preview. Rename does not regenerate routes or code names. Add surface, edit route,
move, navigation links and journey creation use the existing validated commands.

Drag changes geometry only. **Arrange** spaces cards without changing parents,
routes, transitions or visual definitions; Undo restores the previous geometry.
Opening a design preserves explicit saved positions, including intentionally
close placements. Unsaved cards receive collision-free initial positions.
**Fit map** and **Focus** are view operations, not model writes.

A handle connection in Structure opens a parent-change review. In Navigation it
opens a link review instead; it cannot silently change containment. Journey handles
are disabled: a journey is authored through its steps, not by reparenting cards.
Save/cancel guards still protect unfinished edits before navigation or host redraws.

## Data and architecture

The retained TypeScript 6 / Vue 3 / Pinia / Nuxt UI / Vue Flow implementation remains
in `editor/`. `scripts/companion/sitemap/layout.ts` owns pure display geometry, with
no Vue or host dependencies. `scripts/concepts/mvp-bridge.js` adapts the existing
project and persistence; the immutable session checks revisions before commits.

Canonical `design.nodes`, `design.links`, `design.sitemap` and `design.features`
remain authoritative. Full project v6 import/export retains page designs, component
revisions, requirements, storymaps and source bindings. No schema bump or second
Journey Lens document is introduced by this integration pass.

The checked-in v5 HTML/JSON pair is intentionally retained as a byte-exact
compatibility fixture for existing assembly and migration checks. Do not use it
to review the replacement. No old qualification result is relabeled as new evidence.

## Verification

The existing Companion workflow typechecks the actual Vue components with the
repository-locked TypeScript 6 toolchain, executes the authoring/sitemap Node suites,
builds the integrated HTML, and runs `tests/concepts/companion-mvp.browser.py`.
The suite covers initial card overlap, the named artifact identities, Back context,
journey selection, geometry-only arrangement/Undo, existing edits and full JSON
round trips. A separate step independently generates, installs, verifies and builds
the full project before exercising the generated clickdummy.

New layout tests cover wide/deep trees, saved coordinates, non-mutation, outline
ordering, cycles, duplicate IDs, missing parents and non-finite positions. New real
Vue/Pinia store tests cover context restoration and lens-specific connection intent.
The raw workflow results and exact source-commit receipt determine passed scope.

This remains an offline browser authoring concept. Native Obsidian integration,
vault writes, complete generated Companion behavior and native acceptance are not
established by these tests. No merge, activation, release or publication is included.
