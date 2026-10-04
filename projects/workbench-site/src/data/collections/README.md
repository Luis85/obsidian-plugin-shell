# Collection snapshots

Each `<name>.collection.json` file here is one Obsidian Bases collection, written by
`node bin/app site collections` in the Workbench shell. Do not edit them by hand: the command
refuses to replace or remove a snapshot whose records no longer match its `recordsSha256`.

`src/content.config.ts` registers every `*.collection.json` file in this folder as the Astro
content collection `<name>`; other files here are ignored. The build stops, naming the file,
when a `*.collection.json` file is not a snapshot this site can read. A snapshot holds:

- `schemaVersion`: `2`.
- `generatedBy`: the command that wrote it.
- `recordsSha256`: the SHA-256 of `records` as compact JSON, so hand edits are detected.
- `collection`: the Bases view as a file collection: the `.base` path, its SHA-256 and view, the
  view type, and `fields` (property, display name and inferred type, in column order).
- `records`: the matching notes in view order, each with its `path`, the view-column `values`
  and its `group` when the view groups. No other frontmatter is included.
