# Repository layout

> Type: explanation · Part of the [docs index](../README.md)

This page explains what each top-level folder owns and why the boundaries sit
where they do. It is derived from the "Target shape" of the archived
[scripts consolidation record](../_archive/development/SCRIPTS-CONSOLIDATION.md)
and checked against the tree on 2026-10-04. The binding rules (layering, line
limits, coverage floors) are in [AGENTS.md](../../AGENTS.md); exact numbers are in
`configs/quality/thresholds.json`.

## Top-level folders

| Folder | Owns | Why it is separate |
| --- | --- | --- |
| `src/` | The Obsidian plugin runtime only: `domain`, `application`, `features`, `infrastructure`, `presentation`, `bootstrap`, `styles`, `locales`; `main.ts` is lifecycle composition. | It ships as `main.js`/`styles.css`. It never imports Node, the CLI, `scripts/` or `harness/`, and carries the strictest production coverage gate. |
| `bin/` | The developer CLI in TypeScript: the `app.ts` entry (run as `node bin/app`), its `domain`/`application`/`adapters`/`presentation` layers, the compiler (`src/cli/compiler`, with the Companion code emitters in `src/cli/compiler/emitters`), the typed Markdown documentation package (`src/cli/documentation`), the maker engine and recipes (`src/cli/adapters/makers`), the starter domain (`src/cli/adapters/starters`), the capability catalog (`src/cli/adapters/operations`) and the release bundler and project readers (`src/cli/adapters/framework`). | One CLI core with its own maker coverage gate; generated projects receive the same `bin/` so their commands match. |
| `scripts/` | Real scripts invoked by npm scripts or workflows: quality gates, suite runners, build and dev loop, release and qualification entries, the Companion tools (`scripts/companion-tools`). Three non-tooling holdings are deliberate: the typed contract zones (`scripts/contracts`, `scripts/shared`), the starter schema (`scripts/starters/starter.schema.json`) and the Companion contract library (`scripts/companion`). | Tooling stays outside the runtime and the CLI core; `scripts/` imports `bin/` only from thin tooling entries. See [`scripts/README.md`](../../scripts/README.md). |
| `templates/` | Generated-project template sources: `companion/runtime` (runtime modules copied or rewritten into generated projects), `companion/devkit` (developer-kit `.tmpl` text), `examples` (example-removal templates), `adoption` (the adoption skill) and `design-folder` (Claude Design folder templates). | Templates are inputs to the compiler and kit, not runtime code; they obey the same 400-code-line limit. |
| `configs/` | Lint, types, testing, bundling and quality configuration; `configs/starters/` holds the project starter definitions; `configs/wizards/`, `configs/forms/` and `configs/guides/` hold the data-driven guided processes ([wizards and forms](WIZARDS-AND-FORMS.md)). | Configuration is shared by `verify`, CI and generated projects. |
| `tests/` | Every test, classified into exactly one suite by `tests/suites.json`. | See [Test suites](../testing/TEST-SUITES.md). |
| `plugins/` | The Workbench plugin SDK and the example extension. | Extends Workbench itself; see [Workbench plugins](WORKBENCH-PLUGINS.md). |
| `harness/` | The browser harness for the served UI and the host-style fixtures. | Never shipped in the plugin. |
| `docs/` | Documentation, concept workspaces and design folders. | See the [docs index](../README.md). |
| `tooling/` | The separately locked documentation-site package (`tooling/documentation`). | Its dependencies stay out of the root lockfile. |

## Dependency direction

- **Nothing moves into `src/`.** No `scripts/` module is plugin runtime logic, and
  `src/` never imports `scripts/` or `harness/`. "Move into TypeScript" means the
  CLI's own layered source under `bin/`.
- **`bin/` and `scripts/` form no two-way pair.** Every `scripts/` → `bin/` edge
  starts in a tooling entry; every `bin/` → `scripts/` edge ends in a contract zone
  or one of a few named tooling helpers. The compiler and the Companion contract
  library are connected only through facades and type-only imports
  (`tests/tooling/compiler-dependency-direction.checks.mjs`).
- **Some paths are contracts.** `scripts/bundling`, `scripts/agent`,
  `scripts/dev/obsidian-dev.mjs` and `templates/companion/runtime/*` are paths that
  generated projects depend on; renaming them breaks those projects.
- **Docs paths are contracts too.** Code, tests and templates link to current
  documents by path, which is why the docs are organized by an index rather than
  by moving files.
