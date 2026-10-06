> **Framework reference — not this project's backlog or instructions; follow ./AGENTS.md**

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

After it, finish the project as any other project in `projects/`. Its `next` steps depend on the
checkout:

- In the Workbench checkout, which has `scripts/projects/projects.mjs`:
  1. Add an npm entry for `/projects/<name>` to `.github/dependabot.yml`.
  2. Run `npm run projects:sync`, which copies the site's CI workflow into the root.
  3. Run `npm run check:projects`.
  4. In the site folder, run `npm ci` and `npm run check`.
- In a kit or a generated project, which has no projects tooling, step 2 and 3 become: copy
  `projects/<name>/.github/workflows/ci.yml` into the root `.github/workflows` and scope its
  triggers, working directory and paths to `projects/<name>`. GitHub runs only root workflows.

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

`site collections` runs the same ingest as `node bin/app base ingest` for each entry. Views of
the same `.base` and vault share one read of the base and one vault scan. It then plans
`src/data/collections/<name>.collection.json` in the site:

```json
{ "schemaVersion": 2, "generatedBy": "node bin/app site collections", "recordsSha256": "…",
  "collection": { "...": "..." }, "records": [{ "path": "…", "group": "…", "values": {} }] }
```

- `collection` is the file-collection configuration: base path, SHA-256 and view, view type,
  and `fields` with property, display name and inferred type. See
  [Obsidian Bases as collection configuration](OBSIDIAN-BASES.md) for its shape and the supported
  Bases subset.
- `records` are the matching notes in view order. Each has only what pages render: `path`, the
  view-column `values` and `group` when the view groups.
- `recordsSha256` is the SHA-256 of `records` as compact JSON. It shows whether a snapshot was
  edited by hand.
- Output is deterministic: the same notes and base give the same bytes, with no timestamps.

Snapshots never carry a note's other frontmatter or its body. `node bin/app base ingest` still
returns full `properties` for fixtures; the site snapshot drops them. Snapshots are committed
with the site, so review the view columns before you publish a site built from a private vault.

Ownership of the files in `src/data/collections/`:

| Existing file | What `site collections` does |
| --- | --- |
| `<name>.collection.json` it wrote, records matching `recordsSha256` | Replaces it, or removes it when no listed collection produces it |
| `<name>.collection.json` it wrote, then edited by hand | Conflict: never replaced or removed |
| Any other `*.collection.json` | Conflict: the site would load it |
| `<name>.json` with `schemaVersion: 1` and its `generatedBy` | Removes it: the old format, which embedded full frontmatter |
| Any other file | Keeps it: the site never loads it |

A conflict blocks the whole plan. Unknown views, views that use unsupported Bases features, a
missing `.base` file and an invalid `site` section are refused before anything is written.

## Inside a site

- `src/content.config.ts` registers every `src/data/collections/*.collection.json` file as an
  Astro content collection; other files in that folder are ignored. It uses `file()` from
  `astro/loaders` with a `parser` that maps each record to an entry whose `id` is the note path
  and whose `order` is its view position, and a permissive `astro/zod` schema.
- `src/lib/snapshot.ts` checks `generatedBy` and `schemaVersion` (`2`) of every snapshot before
  use. A foreign or outdated `*.collection.json` stops the build with an error naming the file.
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
  - `dot-<name>` becomes `.<name>`, for example `dot-github/` and `dot-gitignore.tmpl`. The name
    after `dot-` starts with a letter, digit, `_` or `-`, so no path renders to `.` or `..`.
  - `param-<name>` becomes an Astro route parameter `[<name>]`.
- Rendering replaces `__SITE_NAME__`, `__SITE_TITLE__`, `__SITE_TEMPLATE__`,
  `__SITE_TEMPLATE_TITLE__`, `__SITE_TEMPLATE_SUMMARY__` and `__SITE_TEMPLATE_COLLECTIONS__`. An
  unknown `__SITE_*__` token fails the render.
- `package-lock.json.tmpl` was generated once with npm 11.19.1 for exact `astro` 7.3.5. Rendering
  sets its two `name` fields. To update Astro:
  1. Change the version in `package.json.tmpl` and `catalog.json`.
  2. Regenerate the lock with `npm install --package-lock-only` in a scratch folder.
  3. Copy it back with the name fields set to `__SITE_NAME__`.
  4. Rebuild all three templates: `node scripts/testing/qualify-site-templates.mjs`.

## Limits

- At most 200 template files of 1 MB each per site. Snapshot files are read up to 64 MB.
- Bases limits apply per collection: see [Obsidian Bases as collection configuration](OBSIDIAN-BASES.md).
- Sites are static (`output: 'static'`). No adapter, analytics, remote fonts or client scripts
  are included.
- Astro collects anonymous telemetry unless it is disabled. The site CI sets
  `ASTRO_TELEMETRY_DISABLED=1`; locally, run `npx astro telemetry disable` once.
- The shell never installs Astro. Each site's own CI runs its build, and `check:projects`
  validates its manifest, workflow, Dependabot entry and collection snapshots (below).
- The maintainer-only `.github/workflows/site-templates.yml` builds the templates themselves. It
  runs `node scripts/testing/qualify-site-templates.mjs`, which:
  1. Renders each template with `site new` into a scratch shell root, twice: with zero
     collections, and with one snapshot of the `tests/fixtures/sites` vault.
  2. Runs `npm ci` and `npm run build` in each rendered site.
  3. Requires the built pages to show the fixture's view values and never its other frontmatter.

  `--dry-run` renders without installing. Kits and generated projects carry the templates, not
  this tooling.

## Snapshot freshness in check:projects

For each `site.collections` entry, `check:projects` reads the current `.base` file:

| Failure | Meaning |
| --- | --- |
| `SITE_COLLECTION_BASE_INVALID` | The `.base` file cannot be read as a Bases file. |
| `SITE_COLLECTION_VIEW_UNKNOWN` | The listed view is not in the `.base` file. |
| `SITE_COLLECTION_MISSING` | `src/data/collections/<name>.collection.json` is absent, or was not written by `site collections`. |
| `SITE_COLLECTION_EDITED` | The snapshot's records no longer match its `recordsSha256`. |
| `SITE_COLLECTION_STALE` | The snapshot was made from another version of the `.base` file (`collection.base.sha256`) or another view. |
| `SITE_COLLECTION_ORPHAN` | A `*.collection.json` (or an old-format snapshot) belongs to no listed collection. |

The fix is `node bin/app site collections projects/<name> --yes`. The `projects-boundary`
workflow runs on every `.base` change, so a base edit without a new snapshot fails CI.

Edits to notes alone do not change the `.base` file, so `check:projects` cannot see them.
Re-run `site collections` after you change the notes a site shows, and commit the new snapshots.

Code:

- Framework-free logic: `bin/domain/site-template.ts` and `bin/domain/site-collections.ts`.
- File access: `bin/adapters/site-templates.ts`.
- Commands: `bin/adapters/framework/site-command.ts`.

Tests:

- `tests/tooling/interactive-maker-sites*.checks.mjs`
- `tests/tooling/projects-boundary.checks.mjs` (`PROJECTS-12` to `PROJECTS-15`)
- `tests/tooling/site-templates-qualification.checks.mjs` (maintainer-only)
