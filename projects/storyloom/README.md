# Storyloom

**Map the user’s journey.** Storyloom owns story maps, activities, journey steps, stories, releases and personas. Creates independent, unscheduled Idea stories from supported interface definitions, sitemap pages, or Dissect scenarios and instances.

Storyloom is one of the five tools in the **Obsidian Product Family**. Each tool works alone. They
share a compiled Vue 3 + Nuxt UI shell, Storyloom's dark and light theme, and a reviewed exchange
format for carrying records and connections between them:

| Project | Responsibility |
| --- | --- |
| [Component Atlas](../component-atlas/README.md) | Define the building blocks |
| **Storyloom** (this project) | Map the user’s journey |
| [Sitemap Atlas](../sitemap-atlas/README.md) | Shape information architecture |
| [Dissect](../dissect-canvas/README.md) | Explore interfaces & interactions |
| [Resource Atlas](../resource-atlas/README.md) | Plan roles and effort |

The delivered prototype is [`docs/concepts/storyloom`](../../docs/concepts/storyloom/README.md).
This project is its source. It builds the same self-contained HTML file.

## Develop

Requirements: Node 24.21.0 (`.nvmrc`) and npm 11.19.1.

```sh
npm ci
npm run check      # build dist/storyloom-prototype.html, then run the protocol tests
npm run test:e2e   # open the built file in Chromium and exercise the shell
npm run dev        # http://127.0.0.1:4173
```

`npm run build` compiles the shared shell with Vite into `dist/shell/`, then `scripts/package.mjs` embeds the shell, its
CSS and icons, the Storyloom editor engine and the third-party notices into one file:
`dist/storyloom-prototype.html`. Open it directly in a modern browser. It needs no server, account, CDN or other
family file. Keep the family files in one folder to use the family shortcuts. Each shortcut
opens a sibling file in a new tab. The development server serves only this editor.

Browser verification uses Playwright's Chromium, or the Chromium at `FAMILY_CHROMIUM_PATH`.

Nuxt UI components are registered with the `Pf` prefix (`<PfButton>`), not the default `U`, so the
Workbench shell's own component detection never picks them up. This is the only change to the
delivered shell source, besides building one editor per project.

## What the checks cover

- `npm test` runs the pure exchange-protocol tests. They cover all twenty producer and consumer
  directions between the five tools, ownership, identity, keep and update choices, missing
  sources, links, malformed input, the 32 MB limit and Markdown connection notes.
- `npm run test:e2e` opens `dist/storyloom-prototype.html` with every external request blocked. It checks the
  offline boot, import of [`examples/product-family-example.json`](examples/product-family-example.json)
  (real records from the other three tools) without changing native data, and the shared import
  dialog (invalid schema rejected, valid package applied). It also checks links, reload
  persistence, the export download, and no page errors or network requests. It also checks that a real Component Atlas UI definition can be adopted as a locally owned record. A native backup whose identity does not match is rejected before restore.

The original family-wide browser run opened all four tools together and exchanged packages in all
twelve directions. Its recorded results are in
[`docs/concepts/product-family`](../../docs/concepts/product-family/README.md). A single project
cannot repeat that run, because the other three tools live in their own projects.

## Read next

- [Family guide](docs/FAMILY-GUIDE.md): ownership, exchange format, native backups and conversions.
- [Adapter contract](ADAPTER-CONTRACT.md): the seam between the shell and the editor.

## Boundary

This is a working browser prototype, not an Obsidian plugin. It exports vault-oriented files, but it
does not access a vault directly. The editor engine stays embedded behind the adapter. It has not
been rewritten as Vue components. The iframe is an integration boundary for trusted, bundled
editor code, not an isolation guarantee for arbitrary content.
