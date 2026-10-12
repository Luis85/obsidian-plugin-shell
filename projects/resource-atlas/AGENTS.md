# Agent instructions: Resource Atlas

This is a standalone browser prototype, the fifth Obsidian Product Family tool. Work in this
folder as if it were its own repository. The delivered prototype it rebuilds is
`docs/concepts/resource-atlas` in the Workbench repository. Product language and UI copy are
German; code, comments and developer docs are English.

## Commands

- Use Node 24.21.0 (`.nvmrc`) and `npm ci` with the exact `package-lock.json`. Do not run
  `npm install` unless you are deliberately updating a dependency, and pin versions exactly.
- `npm run check` is the gate: it builds `dist/resource-atlas.html` and runs the calculation and
  serialization tests. Run it before you stop and report its actual output.
- `npm run test:e2e` (also `npm run verify`) opens the built file in Chromium; build first.
  `npm run verify:edge-cases` runs the focused regressions. Set `RESOURCE_CHROMIUM_PATH` to a local
  Chromium, or install Playwright's with `node node_modules/playwright/cli.js install chromium`.
  `FAMILY_DIST_PATH` may point at a folder holding the four other built family HTML files for the
  exchange checks; without it they are reported as skipped. Report a check as not run when no
  browser is available.
- `npm run dev` serves the app at `http://127.0.0.1:4176`.

## Structure

- `src/domain.mjs` and `src/io.mjs` are pure: calculation, validation and serialization. Keep them
  free of UI and browser dependencies; `docs/CALCULATION-GUIDE.md` is their specification.
- `src/usePlanner.js` owns application state; the Vue components render and emit changes.
- `src/family-protocol.mjs` is the shared Product Family exchange format. The same protocol is in
  the other four family projects; a change to it is a family change. Make it in all five.

## Rules

- Nuxt UI components use the `Pf` prefix (`<PfButton>`), not the default `U`. The Workbench
  shell's Nuxt UI component detection scans the whole checkout for `U`-prefixed names, so a
  `<UButton>` here would add styles to the shell's own plugin. Keep the prefix, and keep build
  output under `dist/`, which that detection skips.
- Keep the output one self-contained HTML file: no CDN, remote fonts or network requests.
- Effort is explainable at daily precision: 1 FTE on 1 available workday is 1 PT. Do not change a
  formula without updating `docs/CALCULATION-GUIDE.md` and its tests.
- Imported family records stay owned by their source tool. Never overwrite local records from an import.
- Do not reach outside this folder: no imports from `../` and no `file:` dependencies.
