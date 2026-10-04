# Workbench

A static [Astro](https://astro.build) website built from the **Project page** Workbench
template (`project-page`): a project status page with a roadmap table, a backlog table and update cards.

Its content comes from Obsidian Bases collections. The Workbench shell snapshots each collection
into `src/data/collections/<name>.json`; the site never reads a vault and never imports the shell.

## Develop

Use Node 24.21.0 (`.nvmrc`) and the exact lock:

```sh
npm ci
npm run dev       # local development server
npm run build     # static site in dist/
npm run preview   # serve the built site
npm run check     # the gate CI runs: a full build
```

Astro collects anonymous telemetry unless it is disabled. CI sets `ASTRO_TELEMETRY_DISABLED=1`;
locally, run `npx astro telemetry disable` once.

## Collections

This template reads these collections by name:

- `roadmap`: Roadmap milestones as a table, one column per view field.
- `backlog`: Open backlog items as a table, one column per view field.
- `updates`: Project updates as cards.

A missing or empty collection shows an empty state, so the site always builds.

List each collection in `workbench.project.json` under `site.collections`:

```json
{ "name": "features", "base": "Site/Features.base", "view": "Cards", "vault": "." }
```

- `name`: the collection name the pages use (lowercase words joined by hyphens).
- `base`: the `.base` file, relative to the shell repository root.
- `view`: one of its views; `node bin/app base views <file.base>` lists them.
- `vault`: optional vault folder the base and its notes belong to, relative to the shell root
  (default `.`).

Then, from the shell repository root, review and write the snapshots:

```sh
node bin/app site collections projects/workbench-site          # preview the plan
node bin/app site collections projects/workbench-site --yes    # write src/data/collections/*.json
```

Commit the snapshots: the site build reads only them.

## Using collections in pages

- `src/components/CollectionTable.astro`: every record as a labelled table, one column per
  view field, headed by its display name.
- `src/components/CollectionCards.astro`: every record as a card (`layout="grid"`) or a stacked
  list (`layout="list"`); the first field is the heading.
- `src/components/CollectionFields.astro`: the fields of a collection with their types.
- `src/lib/collections.ts`: `collectionNames()`, `collectionInfo(name)`,
  `collectionRecords(name)` (through Astro's `getCollection`) and `formatValue(value)`.

`src/content.config.ts` registers every snapshot as an Astro content collection with the
`file()` loader, so `getCollection('<name>')` works in any page.
