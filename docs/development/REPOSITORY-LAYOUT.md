# Repository layout

> Type: explanation · Part of the [docs index](../README.md)

This page explains what each top-level folder owns and why the boundaries sit
where they do. It is derived from the "Target shape" of the archived
[scripts consolidation record](../_archive/development/SCRIPTS-CONSOLIDATION.md),
and was updated for the split of `src/` into self-contained source projects (see
the [source project split design](../superpowers/specs/2026-10-06-src-project-split-design.md)).
The binding rules (layering, line limits, coverage floors) are in
[AGENTS.md](../../AGENTS.md); exact numbers are in `configs/quality/thresholds.json`.

## Top-level folders

| Folder | Owns | Why it is separate |
| --- | --- | --- |
| `src/` | Source projects, each self-contained: its code, its own `tests/` (with fixtures and support), a `tsconfig.json` and a test `tsconfig.json`. They are declared in `workbench.sources.json`. Nothing else sits at the `src/` root. | Each project has an explicit, compiler-enforced dependency graph (below) and its own gates and coverage scope. |
| `src/shared/` | Library: `platform/` helpers, `contracts/`, and `companion/` (project schema, contracts, sitemap, visual, prototypes) used by the CLI and the companion. Imported as `#shared/*`. | One copy of the contract code for the CLI, the companion and the plugin. |
| `src/tui/` | Library: the terminal UI engine and generic terminal helpers, no entrypoint. Imported as `#tui/*`. | The CLI consumes it; command-specific terminal views stay in `src/cli`. |
| `src/cli/` | Application: the developer CLI in TypeScript. The `app.ts` entry (built to `bin/app`), its `domain`/`application`/`adapters`/`presentation` layers, the compiler (`src/cli/compiler`, with the Companion code emitters in `src/cli/compiler/emitters`), the typed Markdown documentation package (`src/cli/documentation`), the maker engine and recipes (`src/cli/adapters/makers`), the starter domain (`src/cli/adapters/starters`), the capability catalog (`src/cli/adapters/operations`), the release bundler and project readers (`src/cli/adapters/framework`), the CLI-specific tooling modules (`src/cli/tooling`) and the Workbench extension SDK with its example extension (`src/cli/sdk`, was `plugins/`). | One CLI core with its own maker coverage gate; generated projects receive the same built `bin/` so their commands match. |
| `src/companion/` | Application: the browser companion, `editor/` and `app/` (was `docs/concepts/companion/{editor,src}`). `npm run companion:build` still writes `docs/concepts/companion/index.html`. | The companion is built and verified on its own; the CLI reaches its contracts only through `src/shared`. |
| `src/plugin/` | Application: the Obsidian plugin runtime: `domain`, `application`, `features`, `infrastructure`, `presentation`, `bootstrap`, `styles`, `locales`; `main.ts` is lifecycle composition. `src/plugin/harness/` is the browser harness for the served UI and the host-style fixtures (was `harness/`). | It ships as `main.js`/`styles.css`. It never imports Node, the CLI or `tooling/`, and carries the strictest production coverage gate. The harness is never shipped in the plugin. |
| `tooling/` | Repository machinery (was `scripts/`): quality gates, suite runners, build and dev loop, release and qualification entries, the Companion tools (`tooling/companion-tools`), the agent hooks (`tooling/agent`) and `tooling/tests/` for the tests of tooling modules. Also the separately locked documentation-site package (`tooling/documentation`, its dependencies stay out of the root lockfile). | Tooling stays outside the runtime and the CLI core. `tooling/` may import source projects; source projects never import `tooling/`. See [`tooling/README.md`](../../tooling/README.md). |
| `templates/` | Generated-project template sources: `companion/runtime` (runtime modules copied or rewritten into generated projects), `companion/devkit` (developer-kit `.tmpl` text), `examples` (example-removal templates), `adoption` (the adoption skill) and `design-folder` (Claude Design folder templates). | Templates are inputs to the compiler and kit, not runtime code; they obey the same 400-code-line limit. |
| `configs/` | Lint, types, testing, bundling and quality configuration; `configs/starters/` holds the project starter definitions; `configs/wizards/`, `configs/forms/` and `configs/guides/` hold the data-driven guided processes ([wizards and forms](WIZARDS-AND-FORMS.md)). | Configuration is shared by `verify`, CI and generated projects. |
| `tests/` | Cross-project suites only: acceptance, journeys, verification, browser specimens and workflows. Tests of one source project live in `src/<project>/tests/`; tests of tooling modules in `tooling/tests/`. Every test is classified into exactly one suite by `tests/suites.json`. | See [Test suites](../testing/TEST-SUITES.md). |
| `projects/` | Standalone projects built from concepts, each its own repository-like unit. | Shell gates and workflows ignore it; see `projects/README.md`. |
| `docs/` | Documentation, concept workspaces and design folders. | See the [docs index](../README.md). |

## Source project dependency graph

```
shared     no project dependencies
tui        -> shared
cli        -> shared, tui
companion  -> shared
plugin     -> shared
```

Cross-project imports use the root `package.json` `imports` aliases (`#shared/*`,
`#tui/*`), which are derived from `workbench.sources.json`. Importing a project
that is not referenced fails type checking. Manage the projects with
`node bin/app source list`, `graph`, `check`, `add`, `link`, `unlink`, `rename` and
`remove`; see [Framework CLI](FRAMEWORK-CLI.md).

## Dependency direction

- **Source projects never import `tooling/` or root `tests/`.** `tooling/` and root
  `tests/` may import source projects. A test of a source project imports only that
  project, the projects it references and its own `tests/support|fixtures`; a test
  that needs a `tooling/` module belongs in `tooling/tests/`.
- **No tooling module is plugin runtime logic.** "Move into TypeScript" means the
  CLI's own layered source under `src/cli`.
- **`src/cli` and `tooling/` form no two-way pair.** Every `tooling/` → `src/cli`
  edge starts in a tooling entry; every `src/cli` → `tooling/` edge is avoided by
  keeping CLI-imported modules in `src/cli/tooling` or `src/shared`. The compiler and
  the Companion contract library are connected only through facades and type-only
  imports (`tooling/tests/compiler-dependency-direction.checks.mjs`).
- **Some paths are contracts.** `tooling/bundling`, `tooling/agent`,
  `tooling/dev/obsidian-dev.mjs` and `templates/companion/runtime/*` are paths that
  generated projects depend on; renaming them breaks those projects.
- **Docs paths are contracts too.** Code, tests and templates link to current
  documents by path, which is why the docs are organized by an index rather than
  by moving files.
