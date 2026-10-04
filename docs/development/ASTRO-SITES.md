# Astro website projects from Obsidian Bases

Workbench can create and maintain standalone [Astro](https://astro.build) websites whose pages
render Obsidian Bases collections. Each site is a project in `projects/<name>/`, built from one of
three templates:

| Template | Pages | Collections it reads |
| --- | --- | --- |
| `product-page` | One page: hero, feature cards, FAQ list | `features`, `faq` |
| `project-page` | One page: summary, roadmap table, backlog table, update cards | `roadmap`, `backlog`, `updates` |
| `documentation` | Overview with navigation, plus one reference page per collection | any |

A collection the page names but the site does not list shows an empty state, so every site
builds with zero collections.

## Opt-in boundary

- The shell never installs, imports or runs Astro. Astro (exactly `7.3.5`) is a dependency of the
  generated site only, pinned in its own `package.json` and `package-lock.json`.
- A site never imports the shell. The shell writes collection snapshots (JSON) into the site;
  the site build reads only those committed files.
- The site commands write files only through the shared reviewed file plan: they preview by
  default and write with `--yes` or `--apply <sha256>`.

## Commands

```sh
node bin/app site templates                                       # the templates and their collections
node bin/app site new projects/acme-docs --template documentation --title "Acme Docs"
node bin/app site new projects/acme-docs --template documentation --title "Acme Docs" --yes
node bin/app site collections projects/acme-docs                  # preview the snapshots
node bin/app site collections projects/acme-docs --yes            # write them
```

`site new`:

- Targets only `projects/<name>` (lowercase words joined by single hyphens) and refuses a folder
  that exists and is not empty.
- Renders the shared base plus the template's overlay and writes `workbench.project.json` with
  `site.template`, no prototypes and no collections.
- `--title` defaults to the name in title case.
- Installs and builds nothing.

After it, finish the project as any other project in `projects/`:

1. Add an npm entry for `/projects/<name>` to `.github/dependabot.yml`.
2. Run `npm run projects:sync`, which copies the site's CI workflow into the root.
3. Run `npm run check:projects`.
4. In the site folder, run `npm ci` and `npm run check`.

## The collections bridge

A site lists its collections in `workbench.project.json`:

```json
{
  "schemaVersion": 1,
  "name": "acme-docs",
  "title": "Acme Docs",
  "prototypes": [],
  "site": {
    "template": "documentation",
    "collections": [
      { "name": "features", "base": "Vault/Site/Features.base", "view": "Cards", "vault": "Vault" }
    ]
  }
}
```

| Field | Meaning |
| --- | --- |
| `name` | The collection name pages use; unique, lowercase words joined by hyphens. |
| `base` | The `.base` file, as a normalized path relative to the shell repository root. |
| `view` | One of its views (`node bin/app base views <file.base>` lists them). |
| `vault` | Optional vault folder, relative to the shell root, that holds the base and its notes. Default `.`. |

`site collections` runs the same ingest as `node bin/app base ingest` for each entry. It then
plans `src/data/collections/<name>.json` in the site:

```json
{ "schemaVersion": 1, "generatedBy": "node bin/app site collections", "collection": { "...": "..." }, "records": [] }
```

- `collection` is the file-collection configuration: base path, SHA-256 and view, view type,
  and `fields` with property, display name and inferred type.
- `records` are the matching notes in view order. See
  [Obsidian Bases as collection configuration](OBSIDIAN-BASES.md) for both shapes and the
  supported Bases subset.
- Output is deterministic: the same notes and base give the same bytes, with no timestamps.
- A snapshot whose collection is no longer listed is removed.
- A file the command did not write is never replaced or removed. A listed name that collides
  with such a file blocks the plan.
- Unknown views, views that use unsupported Bases features, a missing `.base` file and an
  invalid `site` section are refused before anything is written.

Snapshots carry each matching note's complete frontmatter in `properties`, and they are committed
with the site. Pages render only the view columns, but review a snapshot before publishing a site
built from a private vault.

## Inside a site

- `src/content.config.ts` registers every `src/data/collections/*.json` file as an Astro content
  collection. It uses `file()` from `astro/loaders` with a `parser` that maps each record to an
  entry whose `id` is the note path and whose `order` is its view position, and a permissive
  `astro/zod` schema.
- `src/lib/collections.ts` gives pages:
  - `collectionNames()` and `collectionInfo(name)`, with the fields, display names and types.
  - `collectionRecords(name)`, through `getCollection`, in view order.
  - `formatValue(value)`.
- Generic components render any collection by name:
  - `CollectionTable.astro`: a captioned table in a horizontally scrolling region.
  - `CollectionCards.astro`: a card grid, or a stacked list with `layout="list"`.
  - `CollectionFields.astro`: the field reference of a collection.
  - `EmptyState.astro`: the message for a missing or empty collection.
- `SiteLayout.astro` provides a skip link and the `header`, `main` and `footer` landmarks. Pages
  have one `h1`. At 360px width nothing scrolls horizontally: wide tables scroll inside their
  region.
- The site gate is `npm run check` (a full `astro build`). Its CI workflow installs with
  `npm ci`, builds, and meets the shell's workflow security floor:
  - read-only permissions
  - SHA-pinned actions
  - `persist-credentials: false`

## Template storage

`templates/sites/` holds `catalog.json` (the template ids, titles, summaries and collections),
a shared `base/` and one overlay folder per template. An overlay file replaces the base file with
the same output path.

Every file is stored as `.tmpl` text, so the shell's TypeScript, lint and analyzer gates never
treat it as shell source:

- The maintainability gate measures the site `.ts.tmpl` and `.mjs.tmpl` files as source in its
  templates view, with the production ceilings. Pages, styles and settings count as rendered text.
- Paths stay portable, because kits and generated projects carry `templates/`:
  - `dot-<name>` becomes `.<name>`, for example `dot-github/` and `dot-gitignore.tmpl`.
  - `param-<name>` becomes an Astro route parameter `[<name>]`.
- Rendering replaces `__SITE_NAME__`, `__SITE_TITLE__`, `__SITE_TEMPLATE__`,
  `__SITE_TEMPLATE_TITLE__`, `__SITE_TEMPLATE_SUMMARY__` and `__SITE_TEMPLATE_COLLECTIONS__`. An
  unknown `__SITE_*__` token fails the render.
- `package-lock.json.tmpl` was generated once with npm 11.19.1 for exact `astro` 7.3.5. Rendering
  sets its two `name` fields. To update Astro:
  1. Change the version in `package.json.tmpl` and `catalog.json`.
  2. Regenerate the lock with `npm install --package-lock-only` in a scratch folder.
  3. Copy it back with the name fields set to `__SITE_NAME__`.
  4. Rebuild all three templates.

## Limits

- At most 200 template files of 1 MB each per site. Snapshot files are read up to 64 MB.
- Bases limits apply per collection: see [Obsidian Bases as collection configuration](OBSIDIAN-BASES.md).
- Sites are static (`output: 'static'`). No adapter, analytics, remote fonts or client scripts
  are included.
- Astro collects anonymous telemetry unless it is disabled. The site CI sets
  `ASTRO_TELEMETRY_DISABLED=1`; locally, run `npx astro telemetry disable` once.
- The shell does not build or test the sites. Each site's own CI runs its build, and
  `check:projects` validates its manifest, workflow and Dependabot entry.

Code:

- Framework-free logic: `bin/domain/site-template.ts` and `bin/domain/site-collections.ts`.
- File access: `bin/adapters/site-templates.ts`.
- Commands: `bin/adapters/framework/site-command.ts`.

Tests:

- `tests/tooling/interactive-maker-sites*.checks.mjs`
- `tests/tooling/projects-boundary.checks.mjs` (`PROJECTS-12`, `PROJECTS-13`)
