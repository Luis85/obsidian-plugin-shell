# Agent instructions: Sitemap Atlas

This is a standalone browser prototype, one of the five Obsidian Product Family tools. Work in this
folder as if it were its own repository. The delivered prototype it rebuilds is
`docs/concepts/sitemap-atlas` in the Workbench repository.

## Commands

- Use Node 24.21.0 (`.nvmrc`) and `npm ci` with the exact `package-lock.json`. Do not run
  `npm install` unless you are deliberately updating a dependency, and pin versions exactly.
- `npm run check` is the gate: it builds `dist/sitemap-atlas.html` and runs the protocol tests. Run it
  before you stop and report its actual output.
- `npm run test:e2e` opens the built file in Chromium (run `npm run build` first). Set
  `FAMILY_CHROMIUM_PATH` to a local Chromium, or install Playwright's with
  `node node_modules/playwright/cli.js install chromium`. Report it as not run when no browser is available.
- `npm run dev` serves the editor at `http://127.0.0.1:4173`.

## Structure

- `src/` is the shared family shell (Vue 3 + Nuxt UI) and `src/protocol.mjs` the exchange
  format. The same shell exists in the other three embedded-editor projects, and the same protocol in all
  five family projects (Resource Atlas has its own Vue shell). A change to the shell or the protocol is a
  family change: make it wherever it applies, or record why one differs.
- `editors/sitemap-atlas.html` is the Sitemap Atlas editor engine, embedded behind the adapter in
  `ADAPTER-CONTRACT.md`. It owns its native data and undo history.
- `app.config.mjs` names the one editor this project builds and the Nuxt UI component prefix.
  `vite.config.mjs` and `scripts/package.mjs` read it.
- Nuxt UI components use the `Pf` prefix (`<PfButton>`, `<PfModal>`), not the default `U`. The
  Workbench shell's Nuxt UI component detection scans the whole checkout for `U`-prefixed names, so
  a `<UButton>` here would add styles to the shell's own plugin. Keep the prefix, and keep build
  output under `dist/`, which that detection skips.
- `examples/product-family-example.json` is a real family package with records from all four
  tools. The browser test imports it. Treat it as data.

## Rules

- Keep the output one self-contained HTML file: no CDN, remote fonts, network requests or
  dynamic code compilation from imported data. The browser test blocks HTTP(S) and fails on any request.
- Do not change identity (`opf://app/workspace/kind/id`), the package schema or restoration
  behavior without reading `docs/FAMILY-GUIDE.md` first.
- Imported records stay owned by their source tool. Never overwrite local records from an import.
- Do not reach outside this folder: no imports from `../` and no `file:` dependencies.
