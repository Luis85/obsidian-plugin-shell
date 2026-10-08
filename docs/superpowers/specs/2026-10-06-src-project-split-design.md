# Split `src/` into self-contained TypeScript projects and tidy the repository by concern

Date: 2026-10-06. Base: PR #96 (`pr/main-reconciliation/main-reconciliation-1`, head `50760a72`).

## Goal

Every application or library under `src/` is its own TypeScript project with an
explicit, compiler-enforced dependency graph:

```
src/shared     ← no project dependencies
src/tui        → shared
src/cli        → shared, tui
src/companion  → shared
src/plugin     → shared
```

No project imports `cli`, `companion` or `plugin`. Nothing remains loose at the
`src/` root except the solution files described below.

## Decisions (owner, 2026-10-06)

1. The Obsidian plugin runtime moves to `src/plugin`.
2. `src/companion` holds the browser companion application; its contracts and
   schema, which the CLI also uses, move to `src/shared`.
3. `src/tui` is a reusable terminal UI library without an entrypoint; the CLI
   consumes it. Command-specific terminal views stay in `src/cli`.
4. Every Workbench project may hold several source projects under `src/`,
   declared in a manifest; the CLI lists, graphs, checks, adds, links, renames
   and removes them. Makers target a named source project; projects without a
   manifest keep working as one implicit plugin project (legacy flat `src/`).
   New projects and starters emit a manifest and `src/plugin`.
5. Approach A: TypeScript project references plus `#` subpath imports.
6. One draft pull request stacked on PR #96 (restructure and management
   commands together). Implementation is parallelized with sub-agents. When
   everything passes, push and open the pull request (owner request).
7. Every source project is self-contained: its code, its own `tests/` folder,
   its `tsconfig.json` (and a test tsconfig), its test fixtures and support.
8. The repository is organized by concern:

```
src/          source projects, each self-contained
  shared/     library: platform helpers, contracts, companion schema/contracts
  tui/        library: terminal UI engine and generic terminal helpers
  cli/        application: Workbench CLI, compiler, documentation, sdk/ (was plugins/)
  companion/  application: browser companion editor and app
  plugin/     application: Obsidian plugin runtime, harness/ (was harness/)
tooling/      repository machinery (was scripts/): quality, testing, release,
              delivery, agent, bundling, styles, ... plus tooling/tests/
configs/      lint, types, testing, bundling, quality, starters, wizards, ...
templates/    generation templates
tests/        cross-project suites only (acceptance, journeys, verification)
projects/     standalone projects (unchanged)
docs/         documentation
```

   Direction rule: `tooling/` and root `tests/` may import source projects;
   source projects never import `tooling/` or root `tests/`.

## Project mechanics

- Each `src/<name>/tsconfig.json` sets `composite: true`,
  `emitDeclarationOnly: true` and `declarationDir: ../../.cache/tsbuild/<name>`
  (type output only, git-ignored), and lists its dependencies in `references`.
  Shared compiler options come from `configs/types/tsconfig.base.json`, split into
  a Node base (NodeNext, `types: ["node"]`) and a browser base (Bundler, DOM,
  `vite/client`).
- The root `tsconfig.json` becomes a solution file: `files: []` plus references
  to all five projects and to the test/tooling projects.
- Cross-project imports use root `package.json` `"imports"`, derived from the
  manifest (see "Source projects as a managed concept"); for this repository:
  `"#shared/*": "./src/shared/*"`, `"#tui/*": "./src/tui/*"`. Imports keep the
  explicit `.ts`/`.mjs` extension. This resolves natively in Node type stripping
  (`node src/cli/app.ts`), esbuild (`build:cli`), Vite, Vitest and TypeScript.
  Relative imports remain the rule inside one project.
- Importing a source file of a project that is not referenced fails type checking
  (TS6307); that is the boundary enforcement. The existing boundary gate keeps its
  rules, updated to the new paths, as a second line.
- `npm run typecheck` runs `vue-tsc -b` on the solution. The existing
  `typecheck:*` scripts are kept as names and point at the corresponding project.
- Mixed `.mjs` + `.d.mts` contract files keep their form; `src/shared` and
  `src/companion` set `allowJs: true`, `checkJs: false`, matching today.

## Moves

| From | To |
| --- | --- |
| `scripts/shared/**` | `src/shared/platform/**` |
| `scripts/contracts/**` | `src/shared/contracts/**` |
| `scripts/companion/**` (pure library: contracts, schema, concepts, journey, prototypes, sitemap, visual) | `src/shared/companion/**` |
| `templates/companion/runtime/contract.ts` | `src/shared/companion/runtime-contract.ts` (template keeps a re-export so generated runtimes are unchanged) |
| `src/cli/presentation/tui/**` | `src/tui/engine/**` |
| generic `src/cli/presentation/{prompts.ts,terminal/terminal-render.ts,terminal/terminal-style.ts}` and the error type tui needs from `src/cli/domain/errors.ts` | `src/tui/**` (error type to `src/shared/contracts` if CLI-wide) |
| `docs/concepts/companion/{editor,src}/**` | `src/companion/{editor,app}/**` |
| `src/{application,bootstrap,domain,features,infrastructure,presentation,styles,locales}`, `src/main.ts` | `src/plugin/**` |
| `harness/**` | `src/plugin/harness/**` |
| `plugins/**` (Workbench extension SDK, example extension) | `src/cli/sdk/**` |
| tooling modules the CLI imports (`scripts/release/{prepare,promotion-plan}`, `scripts/delivery/{acceptance-stubs,handoff,config,repository,run}`, `scripts/testing/{suite-manifest,browser-executable}`, `scripts/agent/mcp-config`, `scripts/ui/gallery-options`, and their transitive imports) | `src/cli/**` (CLI-specific) or `src/shared/**` (also used by companion/plugin); `tooling/` imports them from there |
| `scripts/**` (rest) | `tooling/**` (same subfolder names; existing `tooling/documentation` kept) |
| `src/cli/**` (rest) | unchanged |

Template strings that name paths inside a *generated* project (for example
`../scripts/bundling/vite-shared.mjs` in compiler emitters, `scripts/makers/custom`)
describe the generated project's layout and are not rewritten by the move.

`npm run companion:build` keeps writing `docs/concepts/companion/index.html`; only
its inputs move. Companion concept documents stay in `docs/concepts/companion`.

### Tests

Each source project owns `src/<name>/tests/` with its own fixtures and support
and a `tests/tsconfig.json` that references the project. Assignment rule per test
file: the single source project it exercises; a test exercising a project plus
`shared` belongs to that project; a test of `tooling/` modules goes to
`tooling/tests/`; a test that drives several applications end to end stays in
root `tests/`.

| From | To |
| --- | --- |
| `tests/runtime/**` | `src/plugin/tests/unit/**` |
| `tests/e2e/**`, `tests/obsidian/**`, `tests/harness-styles/**`, `tests/support/obsidian/**` | `src/plugin/tests/{e2e,obsidian,harness-styles,support}/**` |
| `tests/tooling/**` exercising the CLI (incl. compiler, documentation, sdk) | `src/cli/tests/**` |
| `tests/tooling/**` exercising companion editor/app | `src/companion/tests/**` |
| `tests/tooling/**` exercising only tui or only shared | `src/{tui,shared}/tests/**` |
| `tests/tooling/**` exercising `scripts/*`, `tests/hindsight/**` | `tooling/tests/**` |
| `tests/concepts/**` | `src/companion/tests/concepts/**` when it tests companion concept inputs, else `tooling/tests/concepts/**` |
| `tests/fixtures/**`, `tests/support/**` (rest) | next to the tests that use them; fixtures used by several projects stay in root `tests/fixtures` |
| `tests/acceptance/**`, `tests/verification/**`, `tests/browser-*/**` | root `tests/` (cross-project) |

The classification is produced by a scratch script (imports resolved per file),
reviewed, and recorded as the move map; files the rule cannot place are listed
and decided individually. `tests/suites.json` keeps every suite name and its
test-pyramid level; only globs change. Per-suite test counts are recorded before
and after and must match.

## Source projects as a managed concept

Every Workbench project (this repository, generated and adopted projects) can
hold several source projects under `src/`. The CLI manages them.

### Manifest

`workbench.sources.json` at the project root, validated by
`configs/schemas/source-projects.schema.json`:

```json
{
  "schemaVersion": 1,
  "projects": [
    { "name": "shared", "kind": "library", "path": "src/shared", "references": [] },
    { "name": "tui", "kind": "library", "path": "src/tui", "references": ["shared"] },
    { "name": "cli", "kind": "cli", "path": "src/cli", "references": ["shared", "tui"] },
    { "name": "companion", "kind": "companion", "path": "src/companion", "references": ["shared"] },
    { "name": "plugin", "kind": "plugin", "path": "src/plugin", "references": ["shared"] }
  ]
}
```

- `name`: kebab-case, unique; also the `#<name>/*` import alias for library kinds.
- `kind`: `plugin` (Obsidian runtime, browser base, vue-tsc), `cli` (Node
  application with entrypoint), `companion` (browser application, Vite),
  `library` (no entrypoint, Node or browser base via `platform`). Kinds are
  templates in `templates/sources/<kind>/`.
- `path`: directly under `src/`; `references`: names, must form a DAG.
- Unknown keys, unknown schema versions and corrupt files are rejected and left
  untouched (same rule as other stored data).

The manifest is the single source of truth. Derived from it: each project's
`tsconfig.json` `references`, the root solution `tsconfig.json`, the root
`package.json` `"imports"` aliases, and the gate scopes listed under "Tooling".
JavaScript configs (ESLint, Vitest, bundling) read the manifest through one
shared reader in `src/shared/platform`; JSON configs (for example fallow) are
regenerated by reviewed plans and drift-checked.

### Commands: `node bin/app source <op>`

All writing operations use the existing safe-plan engine: preview by default,
`--apply <planHash>` or `--yes`, `--json` output, no overwrite of conflicting or
edited files, hash-guarded removal that retains edited files.

| Operation | Effect |
| --- | --- |
| `list [--json]` | Projects with kind, path, references and derived alias. |
| `graph [--json]` | Dependency graph (text tree; JSON adjacency), reverse dependents. |
| `check [--json]` | Validates: manifest schema, DAG (no cycles), every path exists with a matching `tsconfig.json`, tsconfig `references` and `#` aliases match the manifest, no source import crosses into an unreferenced project, every project is in scope of lint, line-limit, coverage and analyzer gates. Exit non-zero on findings; each fixable finding names the plan that fixes it. |
| `check --fix` | Reviewed plan regenerating derived files (tsconfigs, solution, imports, JSON gate configs) from the manifest. |
| `add <name> --kind <kind> [--platform node\|browser] [--references a,b]` | Scaffolds self-contained `src/<name>` (code, `tests/` with one passing test, both tsconfigs) from the kind template, adds the manifest entry, derived files and suite entry. Refuses an existing path. |
| `link <from> <to>` / `unlink <from> <to>` | Adds/removes a reference; `link` refuses cycles, `unlink` refuses while `from` still imports `to`. |
| `rename <old> <new>` | Moves the folder (`git mv` when tracked), rewrites the manifest, references, aliases and every import specifier of the alias or path across the project. |
| `remove <name>` | Refuses while other projects reference it; otherwise removes the folder only when every file still matches its template hash, else retains edited files and reports them; removes manifest entry and derived wiring. |

Legacy projects without a manifest: commands treat them as one implicit `plugin`
project at `src/` (or `src/plugin`), report `SOURCE_MANIFEST_MISSING` from
`check`, and `check --fix` proposes writing the manifest without moving files.

### Makers and consumers

- Makers (`src/cli/adapters/makers/**`) and compiler emitters target a named
  source project: `--source <name>`, default the only project of the required
  kind (`plugin` for feature/entity/event/setting/ui makers); ambiguity is an
  error listing candidates. The resolved project path and the relative import
  depth replace every hard-coded `src/features`, `src/application`,
  `src/presentation`, `src/domain` and `src/infrastructure` in template strings.
- Starters, `new`, adopt plans and the companion runtime template write a
  manifest and emit `src/plugin`.
- Regression tests generate a feature into a legacy flat-`src` fixture, a
  `src/plugin` manifest fixture and a two-plugin fixture (`--source` required),
  and type-check each.

## Tooling updated to new paths

esbuild/Vite entries (`tooling/bundling/*`, `configs/bundling/*`), ESLint and
oxlint scopes, fallow config, Vitest includes and both coverage gates
(`test:coverage`, `test:coverage:production`, domain/application/features 95%/90%
floors now under `src/plugin`), `check:presentation`, `check:source`, line-limit
policy, boundary gate, `events:check`, `entities:check`, style hash guards, suite
inventory (`tests/suites.json`), workflows, `projects:sync` inputs, AGENTS.md path
table, README, DEVELOPER_GUIDE and live docs. No threshold, guard or include
scope is weakened; every gate must cover the same files at their new paths.

Path-keyed hashes (hash-guarded style modules, golden baselines, evidence
inventories) are re-recorded only when the content is byte-identical and the
key is the only change; any other drift stops and is reported.

## Phases

1. **Baseline** (orchestrator): record per-suite test counts, plugin bundle
   hashes, `build:cli` output listing, current gate results.
2. **Mechanical move** (orchestrator, one commit): one move map covering every
   table above; `git mv` driven by a scratch script; a scratch codemod resolves
   every relative specifier (static imports, `import()`, `new URL(..., import.meta.url)`,
   path literals in configs, `package.json` scripts and workflows) against the old
   tree and rewrites it to the new location. Cross-project specifiers become
   `#<name>/...`. Neither script is committed. This commit need not be green.
3. **Parallel repair** (sub-agents, disjoint file ownership, each ends with its
   area's gates green):
   - A. Type projects: per-project and test tsconfigs, solution, bases,
     `typecheck*` scripts, TS6307 negative fixture.
   - B. Test runners: Vitest configs, Playwright config, `tests/suites.json`,
     suite runner, coverage includes and floors at new paths, count parity.
   - C. Build and bundling: plugin build (byte-identical `main.js`/`styles.css`/
     `manifest.json`), `build:cli` + copied-`bin` check, harness, companion build,
     style hash guards.
   - D. Quality gates: ESLint/oxlint scopes, fallow, line limits, presentation,
     source, boundary, events, entities, docs-launchers, repository policy,
     self-review guard.
   - E. Workflows, `package.json` scripts, agent hooks (`.claude/settings`,
     session-start/stop-check), `projects:sync`, AGENTS.md, README,
     DEVELOPER_GUIDE, live docs and skills.
   - F. Source manifest + `node bin/app source` commands + kind templates (new
     code, isolated worktree, merged after A–E).
   - G. Makers target named source projects; starters/`new`/adopt emit manifest
     and `src/plugin`; regression fixtures (after F's domain lands).
4. **Integration** (orchestrator): merge F/G, `source check` on this repo,
   changelog, Definition of Done, full `npm run verify -- --json --keep-going`,
   self-review, push, draft PR via `node bin/app pr` plan stacked on PR #96.

## Delivery

Change pull request `main-reconciliation-2` in increment `main-reconciliation`
(planned via `node bin/app pr` reviewed plan), stacked on PR #96, draft, with a
`CHANGELOG.md` `## [Unreleased]` entry. The owner requested push and pull
request creation once everything passes; no release, tag or merge.

## Testing

- `vue-tsc -b` on the solution passes; a negative fixture (a `src/plugin` file
  importing `src/cli`) fails with TS6307, proving enforcement.
- All existing suites pass at their new paths with unchanged counts; record
  before/after test counts per suite.
- `build:cli` standalone copied-`bin` check passes; plugin build output
  (`main.js`, `styles.css`, `manifest.json`) is byte-compared before/after.
- Maker regressions for legacy, manifest and two-plugin fixtures (above).
- `source` commands: domain tests for manifest validation, DAG/cycle detection,
  drift findings and plan construction; CLI tests run each operation against a
  real temporary project (preview writes nothing, `--apply` with a stale hash
  fails, `remove` retains an edited file, `rename` rewrites imports and the
  result passes `vue-tsc -b`). Negative fixtures prove each `check` finding.
- `source check` passes on this repository.
- Served browser tests and native Obsidian are not rerun unless the plugin
  bundle differs; report them as not run otherwise.

## Out of scope

Runtime behavior changes of the plugin, CLI commands other than `source` and
the maker target option, dependency or lockfile changes, npm workspaces,
per-source-project dependencies, rewriting paths inside historical evidence
records and archived docs (they keep the paths they were recorded with), and
changes to `projects/*` beyond `projects:sync` output.
