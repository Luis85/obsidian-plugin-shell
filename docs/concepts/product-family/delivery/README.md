# Obsidian Product Family — prototypes 2.0

Four focused tools now share a real Nuxt UI shell, Storyloom’s dark/light theme, and reviewed family exchange. Each HTML contains its application, editor, styles, icons, and demo data.

## Open a prototype

Open any of these HTML files in a modern browser. No server or other family file is required. Keeping them in one folder enables the optional family shortcuts, which open separate tabs.

| File | Responsibility |
| --- | --- |
| [component-atlas.html](component-atlas.html) | Define C4 architecture and UI contracts, variants, and relationships. |
| [storyloom-prototype.html](storyloom-prototype.html) | Map journeys, refine stories, and organize backlog and release slices. |
| [sitemap-atlas.html](sitemap-atlas.html) | Shape page hierarchy, routes, content inventory, and navigation. |
| [dissect-canvas.html](dissect-canvas.html) | Review interfaces, annotate evidence, and explore interaction scenarios. |

Each tool saves its own native data in browser storage. Use complete native backups or family exports to carry work between environments; moving files or changing browser can affect browser saves.

## Try them together

1. Export a family package from Component Atlas.
2. In Sitemap Atlas, select a page and import that package. A file selection or substantial paste opens its review directly; choose **Import context** to apply it.
3. Open a supported UI definition in Connections and use **Attach to…** to bind it to the selected page.
4. Import the resulting package into Storyloom. A supported imported page or UI definition can create a saved, unscheduled Idea story in the selected step.
5. Import a package into Dissect and use **Place review snapshot** for a supported UI or information architecture record. Annotate the snapshot and connect the evidence back to a story, definition, or page.

The optional [product-family-example.json](product-family-example.json) contains real example records and a connection spanning the tools. Import it as context to explore the family browser. Imported records retain source identity. Native restoration is a separate choice that appears only for a compatible same-app backup.

Connections can be retained when their source is absent, forwarded through another tool, and reviewed as missing when a later complete source export omits them. Native editing and connection editing have separate undo histories.

## Source and handover

- [Implementation and compatibility guide](source/docs/FAMILY-GUIDE.md): ownership, exchange format, native backups, conversions, and a walkthrough.
- [Source README](source/README.md): installation and development commands.
- [Verification](source/docs/VERIFICATION.md): automated and targeted checks with included result reports.
- [Adapter contract](source/ADAPTER-CONTRACT.md): the integration seam for each independent editor.

To rebuild, enter `source/`, run `npm ci`, then `npm run build`. The build generates `source/dist/`. The source pins Vue 3.5.22 and Nuxt UI 4.11.3. Third-party notices are embedded in the HTMLs and included in [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt).

These are working browser prototypes. Their common shell is compiled from Vue and Nuxt UI; the specialized editor engines remain embedded behind adapters. They export vault-oriented files but do not directly access an Obsidian vault or include installable Obsidian plugin distributions. Imported Dissect definitions become metadata review snapshots; its trusted demo components provide real rendered interactions and executable scenarios.
