# Shell Workbench companion concept

## Current integrated authoring entry — 2026-09-27

Read the [PR #5 product review](../../product/PR5-PRODUCT-REVIEW.md), [improvement plan](../../product/PR5-IMPROVEMENT-PLAN.md) and [current artifact evidence](../../testing/PR5-REVIEW-EVIDENCE.md). With the qualified checkout dependencies installed, `npm run companion:build` creates `reports/companion-mvp/index.html` and its full v6 `companion-project.json`. That build contains the actual integrated Vue 3/Pinia/Nuxt UI/Vue Flow Journey Lens editor. Open that HTML to review the current authoring milestone.

The checked-in `index.html` and `companion-project.json` linked below remain the explicit **v5 compatibility pair**. Their verified legacy behavior is retained; they are not the latest v6 authoring artifact. v6 is accepted through the shared authoring/compiler adapter, while the old byte-exact inspection contract keeps its historical boundary. The catalog now has **11 starters**, including the [custom-file view and context-menu starters](../../development/native-file-integrations.md).

A [generated clickdummy](../../development/COMPANION-CLICKDUMMY.md) is a separate output built from generated Vue source, not this authoring HTML. Neither artifact is a completed native companion. The current generated receipt still has 31 pending requirements and no native companion acceptance. The sections below describe retained concept capabilities and their dated increments; use the current review to reconcile later integration.

## Retained v5 concept and feature guides

> Current page and component editors: [Visual Page and Component editors](VISUAL-EDITORS.md). [Verification scope](VISUAL-EDITORS-VERIFICATION.md). Earlier increment-specific version/count statements below retain their historical scope.
> **One vault, one project · Visual page/component editors, Storymaps and full-project JSON v5 — 2026-09-26.** Interactive browser concept, not an installable native Obsidian companion.

Open [index.html](index.html) in a desktop browser. Scripts, styles, icons and the reviewed Vue, Pinia and Vue Flow runtime are embedded; no npm, server or runtime CDN is required. GitHub displays source instead of running HTML. Local browser policy can restrict file-origin storage; no file-origin persistence claim is made.

## Project JSON and companion self-project

Choose **Load companion project** to review and load the companion's own authored design into the one-project workspace. Export the full design to JSON, import a file or pasted JSON with explicit replacement, and configure **Preferences → Configure project folders** (`src` / `tests` by default). **Prepare → Project JSON → shell** shows the read-only v1 CLI: it returns the provided export without generating files. The separate reviewed workspace compiler generates Vue SFCs with explicitly imported Nuxt UI components, slots, typed contracts and UI effects from the visual designs; [VISUAL-EDITORS.md](VISUAL-EDITORS.md) describes the current scope and the self-project's 27 page and 54 component designs.

[PROJECT-JSON.md](PROJECT-JSON.md) explains the UI, seed content and limits; [companion-project.json](companion-project.json) is the importable self-project. The [shell contract](../../development/COMPANION-PROJECT-JSON.md) documents the command and safety boundary. This extends the existing single-project model, not a multi-project launcher.

## Storymaps

**Design → Storymaps** opens the overview and a structured Vue Flow editor with activities, steps, stories, release slices and Unplanned. PRD details can create or link existing maps. Items reference existing sitemap surfaces and requirements; sitemap inspectors link back to those maps. Non-drag Move controls, Outline and the advisory Review representation share the same records. In-map text/release/finding filters, searchable requirement links, contextual return navigation and Save & add another support capture and consumption without remounting the canvas on each keystroke. Draft protection, Undo/Redo, missing-target recovery and full project JSON round trips are included.

Choose **Load companion project → Storymaps → From plugin intent to a portable design** to try the editable example. Full-project exports now use format 5/design schema 5; legacy format-1 to format-4 projects remain readable. The inspection CLI remains read-only; the separate reviewed scaffolding generator retains the full design without implementing native storymap behavior. See [STORYMAPS.md](STORYMAPS.md), the current [STORYMAPS-POLISH.md](STORYMAPS-POLISH.md), and historical [STORYMAPS-VERIFICATION.md](STORYMAPS-VERIFICATION.md). Native conversion and publication remain separate gates.

## Page and component editors

**Pages** opens content-bearing sitemap surfaces. **Open page editor** is also available from sitemap inspectors and linked storymap items. **Component library → Open component editor**, or **Open definition** on a selected component instance, opens reusable definitions. Both editors share one three-pane grammar (Outline/Insert, canvas with Design/Preview/Review, inspector) over a declarative UI tree: semantic elements, Nuxt UI catalog v1 components, project components, slots, external-library adapters, source bindings, interactions and scenarios. There is no free geometry; keyboard paths (Move to…, Alt+arrows, Undo/Redo) replace drag. **Start design** is explicit; existing shell sketches are retained.

Try the self-project: **Load companion project → Pages → Design page**. [VISUAL-EDITORS.md](VISUAL-EDITORS.md) documents entry points, both editors, component dependencies, the data contract, migration from v1–v4, the keyboard map and limits. [VISUAL-EDITORS-VERIFICATION.md](VISUAL-EDITORS-VERIFICATION.md) records executed checks and untested scope. The earlier Vue Flow detail editors ([DETAIL-EDITORS.md](DETAIL-EDITORS.md), [COMPOSITION.md](COMPOSITION.md)) are historical.

## Previous product audit

[PRODUCT-AUDIT.md](PRODUCT-AUDIT.md) reviews eleven workflow steps and twelve product perspectives, records eighteen implemented corrections, and separates concept acceptance from shell qualification, native conversion and publication. [PRODUCT-AUDIT-VERIFICATION.md](PRODUCT-AUDIT-VERIFICATION.md) records exact-artifact verification and environment limits.

The overview now exposes advisories and incomplete requirements, the workflow/tour include the expanded editors, keyboard users can skip the shell and retain focus during operation tests, and modal feedback stays inside the active dialog. Preferences offers private session export before failures; conflict recovery also exposes the retained browser copy, and stale reset cannot silently delete it. Narrow next-step layouts remain readable. Incomplete palette contrast checks and retained test-vault targets are described accurately in their relevant views/exports.

## Cross-surface consistency

The [workbench polishing review](WORKBENCH-POLISH-REVIEW.md) records shared control and spacing ownership, escaped form helpers, dialog-focus recovery, protected command shortcuts, responsive navigation and the verification boundary. The existing editor and generator behaviors are retained, not replaced by a visual mock.

Shared shell CSS now lives in `src/workbench.css`, assembled first; feature styles own their local layout and graph geometry. `src/ui-fields.js` supplies consistent named controls and helper-text associations without changing field routes or validation. Dialog redraws preserve repeated-row identity, text selection and scroll position. Design System previews remain scoped to the authored sample, never the host shell.

## Three-editor review

The Sitemap, Entities and Data Sources pass corrects source/view connection targeting, duplicate child connections, relationship deletion in the edit modal and unrelated inspector content. Source/catalog selection is separate, source and flow inspector tabs are contextual, saved flows reveal hidden endpoints, and deletion/cancellation preserves the edit draft. Data-handle body drops and keyboard activation use the same reviewed contract as Connect to card.

Read [EDITORS-REVIEW.md](EDITORS-REVIEW.md) for reproduced defects, prioritized findings and code decisions, and [EDITORS-VERIFICATION.md](EDITORS-VERIFICATION.md) for exact-artifact evidence and its limits. Earlier reports retain their original commit scope. See [DATA-SOURCES.md](DATA-SOURCES.md) for source/operation/shape semantics.

## Current experience

Open an initially empty folder as an Obsidian vault, install the companion, then **design and prepare the one project belonging to that vault**. This concept starts after the first two native steps using a clearly labeled simulated host context.

The fresh overview offers **Start designing**. Define the project, capture requirements, choose a blueprint and edit the existing sitemap/components without Node/npm. The vault identity stays visible, but there is no project picker, external attachment or second-project creation. Other projects are other Obsidian vaults.

**Prepare project** stages a template and reviews additive source-root changes, not a clone over the vault. Existing host configuration, project notes and the full authored design survive. Conflicts and stale approvals block writes. Interruption/resume keeps the same project. New-project testing uses the separate contained `.test-vault/`; existing `.dev-vault` targets remain explicit rather than being moved. Installing the companion is not enabling the output plugin.

Read the [single-vault decision and native implementation contract](SINGLE-VAULT.md), [updated companion PRD](../../product/COMPANION-PLUGIN-PRD.md) and [current verification](SINGLE-VAULT-VERIFICATION.md). Historical reviews retain their dated evidence; their old counts and launcher assumptions are not current acceptance results.

## Try the flow

**Start designing → define identity → Product requirements → Storymaps → Blueprints → Sitemap & views → Entity relationships → Component library / Variants → Prepare project.** Project details and an illustrative Project.md record are available without preparation. Author information can be completed when preparing the template. **Use example outline** starts a planning-only example only when the vault has no project; it does not fabricate successful build/install results.

The eight-step preparation review makes the current source root read-only, distinguishes the test context, lists create/unchanged/conflict states and requires trust plus explicit approval. Use Review scenarios to exercise missing Node, acquisition failure, stale plans, conflicts and interrupted installation. Keep the existing design while returning between the wizard and editor.

The retained editor supports view containers, internal screens, navigation groups, section-safe arrangement, stable code names, editable captions and draggable connection endpoints. The component library, per-instance content editor, PRDs, tags, guidelines, shared-definition versioning, source previews, draft protection and Undo/Redo remain available. The [previous product review](PRODUCT-REVIEW.md) and [container review](CONTAINERS-REVIEW.md) describe retained behavior.

## Entity relationships and component variants

**Design → Entity relationships** opens the semantic editor: entities, typed properties/defaults, runtime note folders, explicit relationships/cardinalities and visual sections. Drag handles to review a connection, or use Connect entities. Live alignment Guidelines, optional Grid snap, Alt free movement, Position / align, keyboard nudges, Arrange sections, Fit and Undo/Redo support arrangement. Entity list and Relationships provide non-canvas editing paths. Hover/select a relationship to highlight its endpoints and stored property; both cardinalities are explained in words. Quick property presets and Save & add another reduce repeated entry. **Review generator** includes declared entity interfaces, document-recipe inputs, frontmatter examples and relationship mappings in the same source plan as the sitemap.

**Component library → Variants** adds reusable named variants with validated typed prop defaults and content overrides. Choose a variant for preview or placement. Existing placements retain their pinned version/defaults and local content until reviewed upgrades. Miniatures stay within their bounded boxes at wide and narrow pane widths.

The [semantic-layer specification](SEMANTIC-LAYER.md) covers native property compatibility, single ownership of relationship fields, generation, limits and native implementation packages. These are concept source previews, not a working native blueprint CLI compiler.

Read the [research and comprehensive entity-editor review](ER-EDITOR-REVIEW.md) and [current verification](ER-EDITOR-VERIFICATION.md) for connector fixes, interaction states, acceptance evidence and remaining native/scale limitations.

## Data and recovery

Browser state is now a schema-2 singleton under `shell-workbench-single-vault-v2`; it has no project collection, active-project pointer or detached design. Existing legacy data stays under its original key. A recovery banner offers an explicit copy of **one** selected outline and a raw export of the entire old workspace. Old locations, execution approvals, trust and generated/test results are not carried over. Invalid/future records are preserved, not reset automatically.

Native implementation will use one Project.md descriptor and Markdown entities in project-owned folders. The browser's virtual file map and project-note export demonstrate that contract but **do not write native vault files or form an installable template**. Recovery exports can contain private paths and notes; do not enter secrets. Export covers committed state, not unsubmitted modal drafts. Observed storage conflicts are blocked without claiming atomic cross-window locking.

## Test data and Design System

**Design → Test data** derives operation recipes from Data Sources and shared entity shapes. Preview deterministic fixtures, try the isolated in-memory behavior, and export a runnable Node kit with safe `.test-vault` seeding/reset, a loopback API server/client and database-style memory ports. Build/install explicitly with `npm run build:local -- --vault .test-vault`; native activation and application-port wiring remain explicit. See [TEST-DATA.md](TEST-DATA.md).

**Design → Design System** describes font roles/stacks, typography, spacing, sizes, radii, light/dark colors and usage guidelines. Export saved declarations to Markdown or a self-contained HTML style guide. No font binaries, remote requests or automatic host-theme changes. See [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md).

The browser remains a concept, but its downloaded test-data kit is executable tooling. The kit is isolated from production imports, includes no live endpoint or credential configuration, and defaults to a dry plan. Its real filesystem/HTTP tests are separate from UI and native-host acceptance. See [TEST-DATA-DESIGN-VERIFICATION.md](TEST-DATA-DESIGN-VERIFICATION.md).

## Source and verification

Edit [src](src), not generated HTML. From repository root:

```sh
python3 -B scripts/concepts/build-companion.py
python3 -B scripts/concepts/build-companion.py --check
python3 -B tests/concepts/companion-assembly.test.py
node --test tests/tooling/test-data-*.checks.mjs
CHROMIUM_EXECUTABLE=/path/to/chromium python3 -B scripts/concepts/run-browser-checks.py
# Require actual browser Storage, loopback HTTP and two pages as well:
CHROMIUM_EXECUTABLE=/path/to/chromium python3 -B scripts/concepts/run-browser-checks.py --real-storage
# Visual page/component editors only (Node Playwright suite, same checks.json contract):
python3 -B scripts/concepts/run-browser-checks.py --only visual-editors
```

The visual-editors suite (`tests/concepts/companion-visual-editors.browser.mjs`) uses the repository's Node Playwright and Chromium; the other suites use Python Playwright.

The read-only companion workflow provisions isolated Python Playwright 1.57.0, checks Python/JavaScript syntax and exact assembly, runs all current browser suites and retains raw logs/screenshots. Its browser-storage suite has no substituted storage adapter. The local UI suites use HTML injection and explicit controlled-storage fixtures; actual-origin storage is a separately reported suite. Exported-kit filesystem and loopback HTTP tests are separate executable-tooling evidence. Final CI outcomes, artifact identity, totals and limitations belong in the verification record and PR receipts—not inferred from a scheduled run.

The builder and Fallow inventory agree on **140 exact inputs: 107 maintained JS, 21 maintained CSS, 7 test-kit ES modules and 5 vendor JS/CSS assets**. Missing/duplicate/extra inputs and altered retained vendor provenance are rejected. Concept/runtime boundaries and production thresholds remain unchanged. Root-template qualification, including the entire authoring/setup/platform workflows, is separate and must be checked on the final PR head.

## Boundaries

No real vault access, template acquisition, process execution, dependency installation, deployment, activation or publication occurs in the concept. Native Markdown adapters, additive archive hydration and cross-leaf operations remain implementation work. Browser assertions include model, controlled-state, synthetic and geometry checks; they are not all physical-pointer tasks, comprehensive accessibility certification or performance benchmarks.

Vendor provenance and notices remain under [vendor](vendor). No font binaries or extracted Obsidian stylesheet are added. The sitemap is a real embedded Vue Flow island; the surrounding concept panels are not a claim that a production Vue/Nuxt UI companion is already complete. Existing root-template CLI and native capabilities retain their own [parent PRD](../../product/PRD.md) and qualification records.


### Page/component editor research and polish (historical)

These records describe the superseded Vue Flow detail editors; see [VISUAL-EDITORS.md](VISUAL-EDITORS.md) for the current editors.
The [competitive research and requirements](DETAIL-EDITORS-RESEARCH.md) cover ten
reference products/tools, observed authoring issues and the next layout/slot/test
contracts. The [polishing receipt](DETAIL-EDITORS-POLISH.md) distinguishes delivered
browser behavior from native and generated-code acceptance. The [editor guide](DETAIL-EDITORS.md)
includes typed property controls, safe override repair, search, direct usage,
Review and saved-design Markdown export.

## Project Starters

The companion now offers a curated, data-only full-project starter catalog. See [usage and contract](PROJECT-STARTERS.md) and [research and selection](PROJECT-STARTERS-RESEARCH.md). Start Blank is a minimal runnable shell; focused starters add editable contracts and fixtures, not finished native business features.
