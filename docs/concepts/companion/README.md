# Shell Workbench companion concept

> **One vault, one project · three-editor correctness and polish — 2026-09-24.** Interactive browser concept, not an installable native Obsidian companion.

Open [index.html](index.html) in a desktop browser. Scripts, styles, icons and the reviewed Vue, Pinia and Vue Flow runtime are embedded; no npm, server or runtime CDN is required. GitHub displays source instead of running HTML. Local browser policy can restrict file-origin storage; no file-origin persistence claim is made.

## Three-editor review

The Sitemap, Entities and Data Sources pass corrects source/view connection targeting, duplicate child connections, relationship deletion in the edit modal and unrelated inspector content. Source/catalog selection is separate, source and flow inspector tabs are contextual, saved flows reveal hidden endpoints, and deletion/cancellation preserves the edit draft. Data-handle body drops and keyboard activation use the same reviewed contract as Connect to card.

Read [EDITORS-REVIEW.md](EDITORS-REVIEW.md) for reproduced defects, prioritized findings and code decisions, and [EDITORS-VERIFICATION.md](EDITORS-VERIFICATION.md) for exact-artifact evidence and its limits. Earlier reports retain their original commit scope. See [DATA-SOURCES.md](DATA-SOURCES.md) for source/operation/shape semantics.

## Current experience

Open an initially empty folder as an Obsidian vault, install the companion, then **design and prepare the one project belonging to that vault**. This concept starts after the first two native steps using a clearly labeled simulated host context.

The fresh overview offers **Start designing**. Define the project, capture requirements, choose a blueprint and edit the existing sitemap/components without Node/npm. The vault identity stays visible, but there is no project picker, external attachment or second-project creation. Other projects are other Obsidian vaults.

**Prepare project** stages a template and reviews additive source-root changes, not a clone over the vault. Existing host configuration, project notes and the full authored design survive. Conflicts and stale approvals block writes. Interruption/resume keeps the same project. Generated-plugin testing uses the separate contained `.dev-vault`; installing the companion is not enabling the output plugin.

Read the [single-vault decision and native implementation contract](SINGLE-VAULT.md), [updated companion PRD](../../product/COMPANION-PLUGIN-PRD.md) and [current verification](SINGLE-VAULT-VERIFICATION.md). Historical reviews retain their dated evidence; their old counts and launcher assumptions are not current acceptance results.

## Try the flow

**Start designing → define identity → Product requirements → Blueprints → Sitemap & views → Entity relationships → Component library / Variants → Prepare project.** Project details and an illustrative Project.md record are available without preparation. Author information can be completed when preparing the template. **Use example outline** starts a planning-only example only when the vault has no project; it does not fabricate successful build/install results.

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
```

The read-only companion workflow provisions isolated Python Playwright 1.57.0, checks Python/JavaScript syntax and exact assembly, runs all current browser suites and retains raw logs/screenshots. Its browser-storage suite has no substituted storage adapter. The local UI suites use HTML injection and explicit controlled-storage fixtures; actual-origin storage is a separately reported suite. Exported-kit filesystem and loopback HTTP tests are separate executable-tooling evidence. Final CI outcomes, artifact identity, totals and limitations belong in the verification record and PR receipts—not inferred from a scheduled run.

The builder and Fallow inventory agree on **103 exact inputs: 74 maintained JS, 17 maintained CSS, 7 test-kit ES modules and 5 vendor JS/CSS assets**. Missing/duplicate/extra inputs and altered retained vendor provenance are rejected. Concept/runtime boundaries and production thresholds remain unchanged. Root-template qualification, including the entire authoring/setup/platform workflows, is separate and must be checked on the final PR head.

## Boundaries

No real vault access, template acquisition, process execution, dependency installation, deployment, activation or publication occurs in the concept. Native Markdown adapters, additive archive hydration and cross-leaf operations remain implementation work. Browser assertions include model, controlled-state, synthetic and geometry checks; they are not all physical-pointer tasks, comprehensive accessibility certification or performance benchmarks.

Vendor provenance and notices remain under [vendor](vendor). No font binaries or extracted Obsidian stylesheet are added. The sitemap is a real embedded Vue Flow island; the surrounding concept panels are not a claim that a production Vue/Nuxt UI companion is already complete. Existing root-template CLI and native capabilities retain their own [parent PRD](../../product/PRD.md) and qualification records.
