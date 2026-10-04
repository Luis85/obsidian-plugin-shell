# Obsidian Bases as collection configuration

A team can curate a collection with [Obsidian Bases](https://help.obsidian.md/bases/syntax).
Workbench can then read that `.base` file and one of its views as the configuration of a
**file collection**, and ingest the matching notes as fixtures for the app or prototype being
built.

```sh
node bin/app base views Collections/Books.base                     # which views exist, which can be evaluated
node bin/app base ingest Collections/Books.base --view Shelf --json   # file-collection config + records
```

Both commands are read-only: they never write, install or call a service. `--vault <folder>`
names the vault the `.base` file and its notes belong to (default: `--root`). The `.base` path
and every note path in the output are relative to that vault.

Try it on this repository's own backlog base:

```sh
node bin/app base ingest docs/requirements/MVP.base --view Backlog --json
```

## In the project JSON

A **Collection** data source can name the base and view that configure it:

```json
{ "kind": "collection", "collectionPath": "Library", "entity": "er-entity-1",
  "base": { "path": "Collections/Books.base", "view": "Shelf" }, "...": "..." }
```

- `base.path` is a visible, vault-relative `.base` file.
- `base.view` is one of its view names.
- Only a Collection may carry `base`.
- The companion concept and the compiler validate the same shape, and editing the Collection in
  the concept keeps it.
- The browser concept never reads vault files. `base ingest` is the step that reads notes.

## What `base ingest` returns

- **`collection`:** the file-collection configuration.
  - `kind: "file-collection"`
  - `base`: path, SHA-256 and view
  - `view`: name and type
  - `folder`: from a top-level `file.inFolder("…")`
  - `fields`: one per view column, each with `property`, a display name taken from the base's
    `properties.*.displayName`, and an inferred `type`: `text`, `number`, `boolean`, `date`,
    `list`, `object`, `empty` or `mixed`
  - `sort`, `groupBy`, `limit`
- **`records`:** matching notes in view order. Each carries its `path`, its view-column `values`
  keyed by property id (`file.name`, `note.title`, `formula.stars`), its `group` when the view
  groups, and its complete frontmatter `properties`.
- **`summary`** and **`skipped`:** what was scanned and matched. Linked folders are not followed.
  Notes whose frontmatter is invalid are listed and treated as having no properties, as in
  Obsidian.

Records are deterministic for the same files:
- Sorting is total: numbers, booleans, text, structured values, then empty values last, in
  either direction.
- Ties fall back to the note path.
- File timestamps are refused, not read.

## Supported Bases subset

| Area | Supported |
| --- | --- |
| Filters | An expression, or `and` / `or` / `not` lists, nested, globally and per view. `not` matches when none of its items match. |
| Operators | `== != < <= > >= && \|\| ! + - * / %` and parentheses. Comparisons never coerce: `"1" == 1` is false, and `+` concatenates when either side is text. |
| Values | Strings, numbers, `true`, `false`, `null`, lists `[…]`, indexing `x[0]` / `x["key"]`. |
| Note properties | `note.<name>` or a bare `<name>`. |
| File properties | `file.name`, `basename`, `path`, `folder`, `ext`, `size`, `tags`; `file.inFolder(folder)`, `file.hasTag(tag, …)` (nested tags match), `file.hasProperty(name)`. |
| Formulas | `formula.<name>`, evaluated once per note. Cycles and undeclared formulas are refused. |
| Functions and methods | `if(condition, value, fallback?)`; `.contains`, `.containsAny`, `.containsAll`, `.startsWith`, `.endsWith`, `.isEmpty`, `.lower`, `.upper`, `.trim`, `.toString`, `.length`. |
| Views | `name`, `type` (any), `filters`, `order`, `sort` (`ASC`/`DESC`), `groupBy`, `limit`. Presentation-only keys such as card sizes are listed as `ignored`. |
| Notes | Markdown notes. Tags come from frontmatter `tags`/`tag` and from inline `#tags` outside code. |

Everything else is refused for the whole view, with the reason, instead of being approximated.
`base views` reports this as `supported: false` with `issues`. Examples of refused input:
- `file.ctime`, `file.mtime`, `now()`, `today()`: fixtures must not depend on timestamps
- `file.links` and other file fields
- other functions and methods
- YAML aliases, anchors, tags and directives
- paths outside the vault

## Limits

- `.base` files: at most 256 KB.
- Expressions: 2,000 characters, 400 tokens and 40 nesting levels.
- Filters: 200 items and 20 levels.
- A scan reads at most 20,000 vault entries, 5,000 notes, 1 MB per note and 32 MB in total.
  Narrow a large vault with a top-level `file.inFolder("…")`: only that folder is read.

A website can render collections too: `node bin/app site collections` snapshots the views a site
project lists into its Astro content collections. See [Astro website projects](ASTRO-SITES.md).

Code: the framework-free reader and evaluator are in `bin/domain/obsidian-base.ts`,
`base-expression*.ts` and `base-collection.ts`. File access is in `bin/adapters/obsidian-base.ts`.
Tests: `tests/tooling/interactive-maker-obsidian-bases*.checks.mjs`.
