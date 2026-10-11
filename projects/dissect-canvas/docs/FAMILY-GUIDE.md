# Obsidian Product Family — implementation and compatibility guide

This handover accompanies four independently usable HTML prototypes: Component Atlas, Storyloom, Sitemap Atlas, and Dissect. They share a compiled Nuxt UI application shell, Storyloom’s light and dark palette, and a portable exchange format. Each editor retains its specialized model and editing engine.

The deliverable is a working prototype family. It does not include installable Obsidian plugin distributions, connect to a live vault, or synchronize open tools automatically.

## 1. Open the prototypes

Open any of the four HTML files at the top level of the extracted archive in a modern browser. Its application code, styles, icons, editor engine, and demonstration data are embedded in that file. It can run offline without a development server or the other three files. Keeping the four HTML files together also makes the product switcher’s relative links useful. The optional `product-family-example.json` beside them can be imported as sample context.

Each editor saves independently in browser storage. Changing browser, clearing site data, moving files, or using a restricted preview can affect access to those saves. Export a family package or a complete native JSON backup to carry work between environments. Opening another family member does not transfer the current workspace; importing a package does.

## 2. One foundation, distinct responsibilities

| Prototype | Owns and edits | Optional use of other tools’ records |
| --- | --- | --- |
| **Component Atlas** | C4 definitions, UI definitions, contracts, variants, and definition relationships | Links stories, pages, and review evidence as context. Foreign planning records do not become definitions automatically. |
| **Storyloom** | Maps, activities, journey steps, stories, releases, and personas | Creates independent Idea stories from supported interface definitions, sitemap pages, or Dissect scenarios and instances. |
| **Sitemap Atlas** | Page hierarchy, routes, content inventory, navigation, component bindings, and tree rehearsals | Attaches a validated Component Atlas definition snapshot to a selected sitemap page. |
| **Dissect** | Review instances, local property overrides, canvas arrangement, annotations, groups, and interaction scenarios | Places supported UI and information architecture records as local metadata review snapshots. |

These boundaries let each tool remain useful alone. A missing source application does not prevent reading an imported snapshot or keeping a relationship. Updates to a source definition remain the responsibility of its owner.

Component Atlas keeps the C4 distinction between systems, containers, components, and code; its UI definition hierarchy serves a separate interface concern. The [official C4 abstractions](https://c4model.com/abstractions) describe the architectural hierarchy behind that distinction.

## 3. What is actually shared

[`src/App.vue`](../src/App.vue) supplies the common navigation, responsive dashboard, title bar, contextual actions, search, Connections browser, import and export dialogs, appearance settings, and status feedback. It uses actual Nuxt UI components, including dashboard layout, buttons, inputs, dialogs, badges, and tooltips. Dependencies pin Vue to **3.5.22** and `@nuxt/ui` to **4.11.3**.

Vite compiles the Vue application and Nuxt UI’s Tailwind styles. The packager embeds that build separately in every HTML. It also embeds the relevant original editor as an iframe document, adding a common bridge and theme layer. `html.family-editor` suppresses duplicate global editor chrome while preserving specialized toolbars, canvases, inspectors, native dialogs, and export engines.

The specialized editors have **not** all been rewritten as Vue components. Their existing engines remain behind a small adapter. This preserves mature behavior while making the shared shell a concrete foundation for a later migration. The iframe is an integration boundary for trusted, bundled editor code; it is not an isolation guarantee for arbitrary executable content.

The shell owns family preferences and connections. Each native editor owns its data, validation, drafts, and native history. Switching to a family screen keeps the editor mounted, preserving its working context. Appearance follows one palette and control pattern; preferences are saved per application.

Implementation references: [`vite.config.mjs`](../vite.config.mjs), [`src/editor-theme.css`](../src/editor-theme.css), [`src/editor-bridge.js`](../src/editor-bridge.js), and [`scripts/package.mjs`](../scripts/package.mjs).

## 4. Identity and the exchange package

Every portable record has a canonical reference:

```text
opf://app/workspace/kind/id
opf://component-atlas/atlas-renovation-planner/ui.component/ui-project-card
```

Each segment is URL encoded independently. App ID, stable workspace ID, namespaced kind, and local record ID form the identity. Titles and note paths are descriptive metadata; renaming them must not create a new identity. This scheme is a portable identifier, not an installed operating system or Obsidian URI handler.

Component Atlas and Sitemap Atlas use their existing native library or project IDs. Storyloom persists its workspace identity in `extraFrontmatter.product_family_workspace_id`, including JSON and workspace Markdown round trips. Legacy maps derive their initial identity from a stable map ID. Dissect persists a workspace ID in its native model.

The common JSON envelope is defined in [`src/protocol.mjs`](../src/protocol.mjs):

```json
{
  "format": "obsidian-product-family",
  "schemaVersion": 1,
  "packageId": "package-unique-id",
  "exportedAt": "2026-10-11T12:00:00.000Z",
  "source": {
    "appId": "component-atlas",
    "workspaceId": "atlas-renovation-planner",
    "workspaceTitle": "Renovation Planner"
  },
  "completeSources": ["component-atlas/atlas-renovation-planner"],
  "entities": [],
  "links": [],
  "natives": []
}
```

This illustrates the fields, not an importable empty backup: `natives` must include the source workspace’s complete native data. Real exports contain owned entity records, retained external snapshots, directed relationships, the current native backup, and retained foreign native backups. Each entity carries its source, canonical reference, kind, title, and optional descriptive data. Links connect references and include a relation and optional note.

Packages are JSON data. Validation checks identity consistency, supported schema, duplicate IDs, safe relative note paths, reserved object keys, nesting, and collection limits. The family package limit is 32 MB; individual native importers can impose stricter limits. Choosing a JSON file or pasting more than 50 KB opens the parsed review directly, without filling the text editor with thousands of lines. No records change until you choose **Import context** or explicitly restore a native backup.

## 5. Keep, update, restore, and missing sources

Import first presents a review of additions, changed snapshots, existing local ownership, links, and missing source records. The default keeps existing external snapshots. **Update existing snapshots** accepts incoming revisions to records and retained source backups. Neither option overwrites records owned by the receiving workspace through the reference registry.

Only the exporting owner can declare its own inventory complete. If its next complete export omits a previously received record, that record is marked missing. Its last snapshot and relationships remain available for review. Forwarding a package through another tool cannot declare an unrelated owner’s inventory complete or silently clear that owner’s missing status.

Missing means a known snapshot was absent from the owner’s latest complete inventory received here. Unresolved means a relationship endpoint is not present locally. Both are visible in Connections; neither proves the source application is currently online or installed.

A package from the same app can also offer an explicit **Restore native workspace** action. `inspectNative` validates the native candidate and reports its identity before restoration, so the shell can reject a mismatch with the declared source. Restoring is a native operation followed by applying its connection data. Use native import for older formats and migration; use ordinary family import when the goal is reference context.

Native changes and connection changes have separate undo histories. While an editor is active, shell Undo delegates to that editor. In family screens, it applies to the connection registry. Adoption creates a local native item and a separate family relationship. Undoing the native creation can leave an unresolved link; review or remove that link in Connections. These histories do not form a distributed transaction across files or tools.

## 6. A manual cross-plugin walkthrough

1. **Define in Component Atlas.** Select Project card, review its UI contract, and export a family package from Import & export.
2. **Place in Sitemap Atlas.** Select a sitemap page, import the package, then open the Project card external record in Connections. Use its **Attach to…** action. This creates a page binding to the validated native library snapshot. Export the sitemap’s family package.
3. **Plan in Storyloom.** Import that package. Choose a map with at least one journey step; selecting an existing story supplies its step. Open a supported imported page or UI definition and choose **Create story draft**. The saved card starts as an unscheduled Idea. Refine its user outcome and acceptance criteria before assigning a release.
4. **Review in Dissect.** Import the sitemap or component package and choose **Place review snapshot** for a supported page or UI record. Annotate that local snapshot. For executable interaction demonstrations, use the bundled demo components and their scenario controls.
5. **Return the evidence.** Export Dissect’s package, import it in Storyloom or Component Atlas, and connect an annotation, instance, or scenario to the relevant owned record. Relationships can express uses-definition, supports-story, appears-on, explores, verifies, or relates-to.
6. **Exercise updates.** Rename a source definition without changing its ID, export again, and compare keeping versus updating its snapshot. Delete a temporary test definition in its owner, import the next complete owner export, and inspect the retained missing record. Export a backup before testing restoration.

No step requires all applications to be open. Forwarded packages can carry enough context to continue the review elsewhere.

## 7. Native files and prototype boundaries

Native exports remain available through the specialized editor and Import & export. Component Atlas retains complete JSON and vault ZIP exports, Markdown definition notes, C4-related diagram output, and Storybook scaffolding. Storyloom retains its JSON, Markdown and vault files, CSV, and Canvas-oriented exports, including editable story Markdown. Sitemap Atlas retains complete project JSON and vault ZIP, Markdown page notes, Canvas, CSV, Mermaid, and a reviewed public XML sitemap projection. Dissect retains workspace JSON, review annotations, and Storybook-oriented exports.

Use complete native JSON or the supported manifest-bearing ZIP for full restoration. Diagram, CSV, XML, Canvas, and individual note projections have different purposes and do not necessarily capture the entire native model. Storyloom’s Markdown importer preserves its supported structured fields, unknown frontmatter, and narrative content; that does not imply a universal Markdown importer across all four tools.

The common Markdown connection note includes source identities, relationships, and portable snapshot data. Its default folder is `Product/Family`. Downloaded files must be placed into a vault by the user; changing that folder preference does not write to disk or establish synchronization.

Dissect never compiles imported family metadata as a Vue template, render function, module, or iframe document. Imported records become a bundled metadata snapshot component with captured provenance. Real component rendering and executable interaction examples use the trusted demo definitions. Generated Storybook files require integration with real component implementations; they are not evidence that an external application passed tests. See [Storybook’s Vue and Vite documentation](https://storybook.js.org/docs/get-started/frameworks/vue3-vite) for that separate development environment.

## 8. Build and extend the source

From the extracted archive directory, enter its `source/` project. Use Node 22.12 or later:

```sh
cd source
npm ci
npm run build
npm test
```

Dependency installation needs network access. The build writes Vite output to `source/build/`, then produces four independent HTML files in `source/dist/`; it does not overwrite the archive’s top-level copies. Paths in the implementation links above are relative to this source project. Edit source files and rebuild; modifying a generated HTML is not a repeatable source change. `npm test` runs the packaged pure exchange protocol tests.

For the included browser suite, build first, then run from `source/`:

```sh
npx playwright install chromium
npm run verify
```

Playwright is a development dependency. Set `FAMILY_CHROMIUM_PATH` to an existing Chromium executable instead if needed. The suite reads `source/dist/`, writes `source/tests/integration-result.json`, and regenerates an example in `source/examples/`. The delivered verification summary is in [`VERIFICATION.md`](VERIFICATION.md). For interactive development, `npm run dev` serves the editor at `http://127.0.0.1:4173`; use `?app=<id>`, where the ID is `storyloom`, `component-atlas`, `sitemap-atlas`, or `dissect`.

To extend an editor, implement [`FamilyAdapter`](../ADAPTER-CONTRACT.md): `getSnapshot`, `navigate`, `command`, `setTheme`, `exportNative`, `inspectNative`, `restoreNative`, `canAdopt`, and `adopt`. Publish JSON-safe snapshots and dispatch `family:changed` after relevant changes. Keep normalization and validation ahead of mutation, preserve stable IDs and native draft guards, and return an explained disabled adoption action for unsupported kinds. The shared bridge restricts method names and checks the expected frame and handshake token.

Extend namespaced entity kinds and explicit conversions without coupling to another editor’s globals or storage keys. Keep exchange schema versions separate from native schema versions. Add migration and round-trip checks when changing either format.

## 9. Moving toward production Obsidian plugins

The next implementation step is a shared Vue and Nuxt UI view layer mounted within each plugin’s Obsidian view, with specialized domain modules behind repository interfaces. Use the [official Nuxt UI Vue/Vite integration](https://ui.nuxt.com/docs/getting-started/installation/vue); a Nuxt server or SSR application is not required for that component library. Gradually replace embedded editor views while retaining tested import, validation, and export behavior.

Replace browser storage and file downloads with deliberate vault repositories. Obsidian’s [Vault guidance](https://docs.obsidian.md/Plugins/Vault) recommends `Vault.process` for read-modify-write operations to avoid overwriting intervening changes. Its official [`FileManager.processFrontMatter` API](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts) provides atomic frontmatter modification. Preserve unrelated frontmatter and note bodies, index stable IDs independently of paths, and handle file changes, renames, deletion, plugin unload, and unavailable optional companions.

Production packaging, plugin manifests, Obsidian lifecycle integration, vault conflict handling, and desktop/mobile host verification remain development work. The present source establishes the shared interface, ownership rules, portable data contract, and working independent prototypes from which to implement that stage.
