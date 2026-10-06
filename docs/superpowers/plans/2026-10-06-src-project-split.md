# Self-contained source projects and repository layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the repository into self-contained TypeScript source projects under `src/` (`shared`, `tui`, `cli`, `companion`, `plugin`), move repository machinery to `tooling/`, and give the CLI a manifest-driven `source` command that manages source projects in any Workbench project.

**Architecture:** One mechanical move commit driven by a reviewed move map and an import codemod, then parallel repair tasks with disjoint file ownership, each restoring its own gates, then the new `source` command and named-source makers. TypeScript project references (`composite`, `emitDeclarationOnly`) enforce the dependency graph; root `package.json` `"imports"` (`#shared/*`, `#tui/*`) carry cross-project imports.

**Tech Stack:** Node 24 type stripping, TypeScript 6.0.3, vue-tsc 3.3.12 (`-b`), Vitest 5, Playwright 1.63, esbuild 0.28, Vite 8, ESLint 10/oxlint, fallow.

**Spec:** `docs/superpowers/specs/2026-10-06-src-project-split-design.md` (authoritative).

## Global Constraints

- Base branch: `pr/main-reconciliation/main-reconciliation-1` (PR #96, head `50760a72`); work branch `obsidian-monorepo-structure-f12612`.
- Dependency graph: `shared` → none; `tui` → shared; `cli` → shared, tui; `companion` → shared; `plugin` → shared.
- Source projects never import `tooling/` or root `tests/`; `tooling/` and root `tests/` may import source projects.
- Use `npm ci` (never `npm install`); no dependency or `package-lock.json` change.
- TypeScript 6.0.3 from `node_modules` only; never a global tsc.
- No threshold, guard, coverage floor, include scope or test removed or weakened. Per-suite test counts identical before/after.
- Line limits: handwritten runtime/CSS/scripts 400 code lines, tests/helpers 450, `src/plugin/main.ts` 100.
- Historical evidence records and archived docs keep their recorded paths.
- Generated-project template strings (makers, compiler emitters, `templates/`, `configs/starters/`) are changed only by Task 10.
- Report actual command output; never claim an unrun gate passed.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Ownership (parallel repair, Tasks 3–8)

Each repair task runs in its own git worktree branched from the move commit and edits only files it owns. A failure caused by a file owned by another task is reported in the task's final message, not edited.

| Task | Owns |
| --- | --- |
| 3 Types | `tsconfig.json`, `**/tsconfig*.json` (except `projects/`, `docs/concepts/*/`), `configs/types/**`, import specifiers in non-test `src/**` files that fail type checking |
| 4 Plugin-side tests | `src/{plugin,companion,tui,shared}/tests/**`, `configs/testing/{vitest*.mjs,playwright.config.ts}` |
| 5 CLI and tooling tests | `src/cli/tests/**`, `tooling/tests/**`, root `tests/**`, `tests/suites.json`, `tooling/testing/**` |
| 6 Build | `tooling/{bundling,styles,harness,dev,companion-tools,concepts}/**`, `configs/bundling/**`, `src/plugin/harness/**` configs, companion build inputs |
| 7 Quality | `configs/{lint,quality}/**`, `tooling/{quality,events,makers,security,maintenance}/**` |
| 8 Workflows and docs | `.github/**`, `package.json` `scripts`, `.claude/**`, `.agents/**`, `tooling/agent/**`, `AGENTS.md`, `README.md`, `DEVELOPER_GUIDE.md`, `*.md` at root, live `docs/development/**`, `docs/testing/**`, `src/*/**.md`, `CHANGELOG.md` |

Task 9 (source command) and Task 10 (makers) own the new and maker files they list.

---

### Task 1: Baseline

**Files:** create only under `reports/split/` (git-ignored).

- [ ] **Step 1: Record suites and counts**

```bash
node scripts/testing/suites.mjs --list > reports/split/suites-before.txt
npx vitest run --config configs/testing/vitest.config.mjs --reporter=json --outputFile=reports/split/vitest-before.json
node scripts/testing/suites.mjs cli --json > reports/split/cli-before.json 2>&1 || true
```

- [ ] **Step 2: Record build outputs**

```bash
npm run build && sha256sum main.js styles.css manifest.json > reports/split/plugin-before.sha
npm run build:cli && (cd bin && find . -type f | sort) > reports/split/bin-before.txt
```

- [ ] **Step 3: Record gate status**

```bash
node bin/app check --json > reports/split/check-before.json
```

Expected: check passes (it passed on this head: 2 passed, 4 skipped in fast mode). Record the full-mode result as-is; a pre-existing failure is noted, not fixed here.

### Task 2: Move map, mechanical move, codemod

**Files:** scratch scripts under the session scratchpad (`movemap.mjs`, `codemod.mjs`), not committed. Output: one commit.

**Produces:** `reports/split/move-map.json` — `{ "files": { "<old path>": "<new path>" }, "prefixes": [["<old prefix>", "<new prefix>"]] }`, consumed by every later task.

- [ ] **Step 1: Build the move map**

Rules, applied in order, over `git ls-files`:

1. `scripts/shared/**` → `src/shared/platform/**`; `scripts/contracts/**` → `src/shared/contracts/**`; `scripts/companion/**` → `src/shared/companion/**`; `templates/companion/runtime/contract.ts` → `src/shared/companion/runtime-contract.ts` (leave a one-line re-export at the old path).
2. `src/cli/presentation/tui/**` → `src/tui/engine/**`; `src/cli/presentation/prompts.ts`, `src/cli/presentation/terminal/{terminal-render,terminal-style}.ts` → `src/tui/`; if these import CLI-only modules other than `domain/errors.ts`, keep them in the CLI and record why.
3. `docs/concepts/companion/editor/**` → `src/companion/editor/**`; `docs/concepts/companion/src/**` → `src/companion/app/**`.
4. `src/{application,bootstrap,domain,features,infrastructure,presentation,styles,locales}/**`, `src/main.ts` → `src/plugin/**`; `harness/**` → `src/plugin/harness/**`; `plugins/**` → `src/cli/sdk/**`.
5. CLI-imported tooling modules (`scripts/release/{prepare,promotion-plan}.mjs`, `scripts/delivery/{acceptance-stubs,handoff,config,repository,run}.mjs`, `scripts/testing/{suite-manifest,browser-executable}.mjs`, `scripts/agent/mcp-config.mjs`, `scripts/ui/gallery-options.ts` and their transitive relative imports outside `scripts/{shared,contracts,companion}`) → `src/cli/tooling/<same subpath>`; a module also imported by plugin or companion code → `src/shared/platform/`.
6. `scripts/**` (rest) → `tooling/**`.
7. Tests, by import classification (resolve every relative specifier of each test file to its *old* target, classify target by rules 1–6): `tests/runtime/**` → `src/plugin/tests/unit/**`; `tests/{e2e,obsidian,harness-styles}/**` → `src/plugin/tests/<same>/**`; `tests/support/obsidian/**` → `src/plugin/tests/support/obsidian/**`; `tests/tooling/**` → `src/<project>/tests/**` when every non-shared target is one project (cli wins over shared/companion-contracts/tui), else `tooling/tests/**` when targets are only tooling, else unassigned; `tests/hindsight/**` → `tooling/tests/hindsight/**`; `tests/concepts/**` → `src/companion/tests/concepts/**`; `tests/{acceptance,verification,browser-specimen,browser-workflows}/**` stay; `tests/fixtures/**` and `tests/support/**` (rest) go to the single project whose tests use them, else stay.
8. Non-code files in a moved test directory follow their directory's code majority.

Print unassigned files; decide each by reading it and add an explicit override. Write `reports/split/move-map.json`.

- [ ] **Step 2: Review the map**

```bash
node movemap.mjs --summary
```

Expected: counts per destination; zero unassigned; no destination outside `src/`, `tooling/`, `tests/`.

- [ ] **Step 3: Move**

`git mv` every mapped file (create parent directories first). Then `git status --short | grep -v '^R' ` must show only the re-export stub as new.

- [ ] **Step 4: Codemod**

For every tracked text file not under `docs/_archive/**`, `docs/**/evidence/**`, `reports/**`, `projects/**`, `CHANGELOG.md` history sections:

1. Relative specifiers in `import`/`export from`/`import()`/`require()`/`new URL('...', import.meta.url)`: resolve against the file's *old* location to the old target; map both through the move map; rewrite to the new relative path. If source and target are in different source projects, write `#shared/<rest>` or `#tui/<rest>` instead. Keep the extension as written.
2. Repo-relative literals (`'scripts/…'`, `"tests/…"`, `src/features/…` in configs, `package.json`, workflows, `.mjs` tooling): replace exact moved file paths first, then directory prefixes from the map. Skip literals containing `${` and skip files under `src/cli/adapters/makers/**`, `src/cli/compiler/emitters/**`, `templates/**`, `configs/starters/**` (Task 10).
3. Add to root `package.json`: `"imports": { "#shared/*": "./src/shared/*", "#tui/*": "./src/tui/*" }`.

- [ ] **Step 5: Smoke**

```bash
node src/cli/app.ts --help
node src/cli/app.ts check --plan --base HEAD~1
```

Expected: help prints. Failures are listed for Tasks 3–8, not fixed here.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Move sources into self-contained src projects and scripts into tooling

Mechanical move and import rewrite only; follow-up commits restore gates.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Type projects (worktree `split-types`)

**Files:**
- Create: `src/{shared,tui,cli,companion,plugin}/tsconfig.json`, `src/*/tests/tsconfig.json`, `tooling/tsconfig.json`, `tests/tsconfig.json`, `configs/types/tsconfig.node.json`, `configs/types/tsconfig.browser.json`, `tests/fixtures/types/boundary-violation/` (negative fixture)
- Modify: `tsconfig.json`, `configs/types/*.json` (fold `framework`, `maker`, `compiler`, `generator`, `authoring` into the per-project configs; keep `hindsight`, `sitemap` if they target tooling), `package.json` `typecheck*` script bodies only

**Produces:** `npm run typecheck` = `node node_modules/vue-tsc/bin/vue-tsc.js -b` on the solution; project names `shared`, `tui`, `cli`, `companion`, `plugin`.

- [ ] **Step 1:** Write `configs/types/tsconfig.node.json` from today's `tsconfig.framework.json` options plus `composite: true`, `emitDeclarationOnly: true`, `declaration: true`, `noEmit: false`, `allowImportingTsExtensions: true`, `rewriteRelativeImportExtensions: false`, `erasableSyntaxOnly: true`, `verbatimModuleSyntax: true`, `resolveJsonModule: true`; and `tsconfig.browser.json` from today's `tsconfig.base.json` with the same emit options.
- [ ] **Step 2:** Per project, e.g. `src/tui/tsconfig.json`:

```json
{
  "extends": "../../configs/types/tsconfig.node.json",
  "compilerOptions": { "rootDir": ".", "declarationDir": "../../.cache/tsbuild/tui", "tsBuildInfoFile": "../../.cache/tsbuild/tui.tsbuildinfo" },
  "include": ["**/*.ts"],
  "exclude": ["tests/**"],
  "references": [{ "path": "../shared" }]
}
```

`plugin` extends the browser base, includes `**/*.vue`, keeps `paths` for `#build/*`; `companion` extends browser with `allowJs`; `shared` allows `.mjs` + `.d.mts`. Each `tests/tsconfig.json` references its project and includes `**/*`.
- [ ] **Step 3:** Root `tsconfig.json`: `{ "files": [], "references": [ shared, tui, cli, companion, plugin, each tests project, tooling, tests ] }`. Add `.cache/` to `.gitignore`.
- [ ] **Step 4:** Run `node node_modules/vue-tsc/bin/vue-tsc.js -b --verbose`; fix import specifiers in non-test `src/**` until clean. Expected: exit 0.
- [ ] **Step 5:** Negative fixture: `tests/fixtures/types/boundary-violation/{tsconfig.json,a.ts}` where a `plugin`-referencing project imports `src/cli/app.ts`; add a tooling test asserting `tsc -b` exits non-zero with `TS6307`. Run it; expected PASS (i.e. tsc fails as asserted).
- [ ] **Step 6:** Commit `Make each src project its own TypeScript project`.

### Task 4: Plugin-side tests and runners (worktree `split-plugin-tests`)

**Files:** `configs/testing/vitest.config.mjs`, `vitest.production.config.mjs`, `vitest.obsidian.config.mjs`, `vitest.maker.config.mjs`, `playwright.config.ts`, tests under `src/{plugin,companion,tui,shared}/tests/**`.

- [ ] **Step 1:** Update Vitest `include`/`coverage.include` to `src/plugin/**` and `src/plugin/tests/unit/**`; the 95%/90% floors apply to `src/plugin/{domain,application,features}/**`; production coverage covers every `src/plugin/**/*.{ts,vue}` input. `@test/obsidian` alias → `src/plugin/tests/support/obsidian/index.ts`.
- [ ] **Step 2:** Playwright `testDir` → `src/plugin/tests/e2e`; harness paths → `src/plugin/harness`.
- [ ] **Step 3:** Run `npm test`, `npm run test:coverage`, `npm run test:coverage:production`. Expected: same test count as `reports/split/vitest-before.json`, coverage gates pass unchanged.
- [ ] **Step 4:** Run tests in `src/{companion,tui,shared}/tests` via their suites (`node tooling/testing/suites.mjs companion`, etc., once Task 5 lands; until then run `node --test <files>` directly). Expected: pass.
- [ ] **Step 5:** Commit `Run plugin, companion, tui and shared tests from their projects`.

### Task 5: CLI, tooling and cross-project tests; suite manifest (worktree `split-cli-tests`)

**Files:** `tests/suites.json`, `tooling/testing/**`, `src/cli/tests/**`, `tooling/tests/**`, root `tests/**`.

- [ ] **Step 1:** `tests/suites.json`: `roots` → the new test roots (`src/*/tests`, `tooling/tests`, `tests/acceptance`, `tests/verification`, `tests/browser-*`); `helperRoots` → each project's `tests/support`, `tests/fixtures`; every suite `include`/`runner` path rewritten via the move map; e2e level `paths` updated. Keep names, levels, prerequisites, `verify` modes.
- [ ] **Step 2:** `node tooling/testing/suites.mjs --check`. Expected: every test file in exactly one suite or helper entry.
- [ ] **Step 3:** Run `node tooling/testing/suites.mjs cli`, `cli:journey`, `makers`, `quality`, `release`, `setup`, `companion`, `compiler`, `generator`, `memory`; fix test-file path literals. Maker suites may fail on generated-project paths: record them for Task 10.
- [ ] **Step 4:** Compare `--list` output and per-suite counts with `reports/split/suites-before.txt`. Expected: identical names and counts.
- [ ] **Step 5:** Commit `Run CLI and tooling tests from their projects`.

### Task 6: Build and bundling (worktree `split-build`)

- [ ] **Step 1:** Update entries in `tooling/bundling/build.mjs`, `build-cli.mjs`, `staged-build.mjs`, `configs/bundling/vite*.mjs` (plugin entry `src/plugin/main.ts`, styles `src/plugin/styles`, harness `src/plugin/harness/app/`, CLI `src/cli/app.ts` + `launcher.mjs`, sdk `src/cli/sdk`).
- [ ] **Step 2:** `npm run build && sha256sum main.js styles.css manifest.json`. Expected: identical to `reports/split/plugin-before.sha`; if only module-attribution comments differ, show the diff and justify.
- [ ] **Step 3:** `npm run build:cli`; copied-`bin` check (`node tooling/testing/suites.mjs` suite that runs it). Expected: pass; file listing differs only by moved paths.
- [ ] **Step 4:** `npm run harness:build`, `npm run companion:build`. Expected: `docs/concepts/companion/index.html` byte-identical.
- [ ] **Step 5:** Style hash guards (`npm run check:tokens`, `check:style-literals`, style module guards): re-record a path-keyed hash only when content bytes are identical; otherwise stop and report.
- [ ] **Step 6:** Commit `Build plugin, CLI, harness and companion from src projects`.

### Task 7: Quality gates (worktree `split-quality`)

- [ ] **Step 1:** ESLint/oxlint scopes (`configs/lint/**`, `tooling/quality/lint-source.mjs`) → `src/*`, `templates/companion/runtime`; fallow (`configs/quality/fallow.json`) entries/ignores; line-limit, presentation (`src/plugin/presentation/components`), source, boundary rules (add: no `src/*` → `tooling/`, `tests/`; plugin/companion/tui/shared never import cli), events, entities, docs-launchers, repository policy, self-review guard paths.
- [ ] **Step 2:** Run `npm run lint`, `npm run analyze`, `npm run check:presentation`, `check:source`, `check:analyzer`, `check:repository`, `events:check`, `entities:check`, `check:docs-launchers`. Expected: each passes; record output.
- [ ] **Step 3:** Prove the new boundary rule with a negative fixture (a `src/plugin` file importing `tooling/`) that the gate rejects.
- [ ] **Step 4:** Commit `Point quality gates at src projects and tooling`.

### Task 8: Workflows, scripts, hooks, docs (worktree `split-docs`)

- [ ] **Step 1:** `.github/workflows/**` and composite actions: path filters and commands via the move map. `npm run projects:sync` if it reads shell workflows.
- [ ] **Step 2:** `package.json` `scripts`: every `scripts/` → `tooling/`, `tests/` → new roots, `src/cli/app.ts` unchanged.
- [ ] **Step 3:** `.claude/settings*.json`, `tooling/agent/session-start.mjs`, `stop-check.mjs`, `.agents/**`, skills: paths.
- [ ] **Step 4:** `AGENTS.md` path table rewritten to the new layout (src projects, tooling, configs, templates, tests, projects, docs); README, DEVELOPER_GUIDE, live `docs/development/**`, `docs/testing/**`, `src/**/*.md`; leave historical evidence and `docs/_archive/**`.
- [ ] **Step 5:** `node bin/app ci --list`, `node tooling/quality/check-repository.mjs` (or `npm run check:repository`), markdown link check. Expected: pass.
- [ ] **Step 6:** Commit `Update workflows, hooks and documentation for the new layout`.

### Task 9: Source manifest and `node bin/app source` (worktree `split-source`, from the move commit)

**Files:**
- Create: `src/cli/domain/source-projects.ts` (pure: types, validation, graph, derived files), `src/cli/adapters/source-command.ts` (I/O, plans), `src/cli/presentation/terminal/source-view.ts`, `configs/schemas/source-projects.schema.json`, `src/shared/platform/source-manifest.mjs` (reader for JS configs), `templates/sources/{plugin,cli,companion,library}/**`, `workbench.sources.json`
- Modify: `src/cli/adapters/framework/catalog.ts` (command entries), router/help, `src/cli/tests/**` new tests

**Produces (exact names used by Task 10):**

```ts
export type SourceKind = 'plugin' | 'cli' | 'companion' | 'library';
export type SourcePlatform = 'node' | 'browser';
export interface SourceProject { name: string; kind: SourceKind; path: string; references: string[]; platform?: SourcePlatform }
export interface SourceManifest { schemaVersion: 1; projects: SourceProject[] }
export interface SourceFinding { code: SourceFindingCode; project?: string; message: string; fix?: 'check --fix' | 'source link' | 'manual' }
export type SourceFindingCode = 'SOURCE_MANIFEST_MISSING' | 'SOURCE_MANIFEST_INVALID' | 'SOURCE_CYCLE' | 'SOURCE_UNKNOWN_REFERENCE' | 'SOURCE_PATH_MISSING' | 'SOURCE_TSCONFIG_DRIFT' | 'SOURCE_IMPORTS_DRIFT' | 'SOURCE_UNREFERENCED_IMPORT' | 'SOURCE_GATE_UNCOVERED';
export function parseSourceManifest(value: unknown): SourceManifest;          // throws WorkbenchError('INVALID_DATA')
export function implicitSourceManifest(hasPluginDir: boolean, hasFlatMain: boolean): SourceManifest;
export function topologicalOrder(manifest: SourceManifest): string[];        // throws on cycle with the cycle path
export function findCycle(manifest: SourceManifest): string[] | null;
export function importAliases(manifest: SourceManifest): Record<string, string>; // library kinds only: '#name/*' -> './path/*'
export function projectTsconfig(project: SourceProject, manifest: SourceManifest): object;
export function solutionTsconfig(manifest: SourceManifest): object;
export function resolveSourceProject(manifest: SourceManifest, kind: SourceKind, name?: string): SourceProject; // throws SOURCE_AMBIGUOUS / SOURCE_NOT_FOUND listing candidates
```

- [ ] **Step 1: Failing domain tests** in `src/cli/tests/source-projects.test.mjs` (Node `node:test`, matching neighboring CLI tests):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSourceManifest, findCycle, topologicalOrder, importAliases, resolveSourceProject, implicitSourceManifest } from '../domain/source-projects.ts';

const repo = { schemaVersion: 1, projects: [
  { name: 'shared', kind: 'library', path: 'src/shared', references: [] },
  { name: 'tui', kind: 'library', path: 'src/tui', references: ['shared'] },
  { name: 'cli', kind: 'cli', path: 'src/cli', references: ['shared', 'tui'] },
  { name: 'plugin', kind: 'plugin', path: 'src/plugin', references: ['shared'] },
] };

test('valid manifest parses and orders dependencies first', () => {
  const m = parseSourceManifest(structuredClone(repo));
  assert.deepEqual(topologicalOrder(m), ['shared', 'tui', 'cli', 'plugin']);
});
test('unknown key, bad name, path outside src and unknown schema are rejected', () => {
  for (const bad of [{ ...repo, extra: 1 }, { ...repo, schemaVersion: 2 },
    { ...repo, projects: [{ ...repo.projects[0], name: 'Bad Name' }] },
    { ...repo, projects: [{ ...repo.projects[0], path: '../shared' }] }])
    assert.throws(() => parseSourceManifest(bad), /INVALID_DATA|Expected/);
});
test('cycle is reported with its path', () => {
  const m = structuredClone(repo); m.projects[0].references = ['cli'];
  assert.deepEqual(findCycle(m), ['shared', 'cli', 'shared']);
});
test('aliases exist for library kinds only', () => {
  assert.deepEqual(importAliases(parseSourceManifest(structuredClone(repo))), { '#shared/*': './src/shared/*', '#tui/*': './src/tui/*' });
});
test('maker target resolution: single plugin default, ambiguity lists candidates', () => {
  const m = parseSourceManifest(structuredClone(repo));
  assert.equal(resolveSourceProject(m, 'plugin').path, 'src/plugin');
  const two = structuredClone(repo); two.projects.push({ name: 'mobile', kind: 'plugin', path: 'src/mobile', references: [] });
  assert.throws(() => resolveSourceProject(parseSourceManifest(two), 'plugin'), /plugin, mobile|mobile, plugin/);
  assert.equal(resolveSourceProject(parseSourceManifest(two), 'plugin', 'mobile').path, 'src/mobile');
});
test('legacy flat src is one implicit plugin project', () => {
  assert.deepEqual(implicitSourceManifest(false, true).projects, [{ name: 'plugin', kind: 'plugin', path: 'src', references: [] }]);
});
```

Run `node --test src/cli/tests/source-projects.test.mjs`. Expected: FAIL (module missing).

- [ ] **Step 2: Implement** `src/cli/domain/source-projects.ts` (≤400 code lines; split `source-projects-derive.ts` for tsconfig derivation if needed). Validation uses the existing `object`/`exactKeys`/`requireThat` helpers pattern from `src/cli/adapters/framework/configuration.ts` (move the pure helpers to domain if they are adapter-only today). Names `^[a-z][a-z0-9-]*$`; paths `^src/[a-z][a-z0-9-]*$` or exactly `src` for implicit legacy. Run tests. Expected: PASS.

- [ ] **Step 3: Read commands** `source list|graph|check` in `src/cli/adapters/source-command.ts`, modeled on `hosting show` (`src/cli/adapters/framework/hosting-cli.ts`): `--json` envelope `{ protocolVersion: 1, command, status, data, diagnostics }`. `check` gathers findings: schema; cycles; per project path + tsconfig existence; tsconfig `references` vs manifest; root `package.json` `imports` vs `importAliases`; scan `*.ts|*.mts|*.mjs|*.vue` imports for `#<name>/` or relative paths into another project not in `references`; each project path present in ESLint scope, line-limit roots, coverage includes and fallow entries (read via `src/shared/platform/source-manifest.mjs` consumers). Exit 1 on findings. Integration tests (`src/cli/tests/source-command.test.mjs`) run `node src/cli/app.ts source …` against temp projects: clean repo-like fixture → `ok`; one negative fixture per finding code proving it fires.

- [ ] **Step 4: Write commands** `check --fix`, `add`, `link`, `unlink`, `rename`, `remove`, all building a `FilePlan` via `createFilePlan` (`#shared/platform/file-plan.ts`) and applying only with `--apply <planHash>` or `--yes`, catalog `effect: 'plan'`. `add` renders `templates/sources/<kind>/` (code stub, `tests/` with one passing test, `tsconfig.json`, `tests/tsconfig.json`) and records template hashes in `.workbench/sources/<name>.json`; `remove` deletes only files whose hash still matches, retains and lists others; `rename` uses the same specifier rewrite as Task 2's codemod (reuse by moving its resolver into `src/cli/domain/source-imports.ts` with tests). Tests: preview writes nothing; stale hash fails with no writes; `link` refuses a cycle; `unlink` refuses while imports remain; `remove` refuses while referenced and retains an edited file; `rename` result passes `vue-tsc -b` in a temp project with real `node_modules` symlink.

- [ ] **Step 5:** Write `workbench.sources.json` for this repo (spec example) and make JS configs (ESLint, Vitest, bundling) read project paths through `src/shared/platform/source-manifest.mjs` where they enumerate `src` projects. `node bin/app source check`. Expected: `ok`, zero findings.
- [ ] **Step 6:** Help text and `src/cli/README.md` section; commit `Add source manifest and source project commands`.

### Task 10: Makers target named source projects (after Task 9 domain)

**Files:** `src/cli/adapters/makers/**`, `src/cli/compiler/emitters/**` (only plugin-path strings), `templates/**`, `configs/starters/**`, `src/cli/adapters/framework/{starter-project,setup-source,adopt-*}.ts`, tests in `src/cli/tests/**`.

**Consumes:** `resolveSourceProject`, `implicitSourceManifest`, `parseSourceManifest` from Task 9.

- [ ] **Step 1:** Failing integration tests `src/cli/tests/maker-source-target.test.mjs`: generate a feature with `make feature` into (a) legacy flat-`src` fixture without manifest, (b) `src/plugin` fixture with manifest, (c) two-plugin fixture with and without `--source`; assert file locations, import depths, and that (c) without `--source` exits 1 naming both candidates; type-check (a) and (b).
- [ ] **Step 2:** Add `--source <name>` to maker catalog options; one adapter `makerTarget(root, kind, name?)` reading the manifest (or implicit) and returning `{ path, depthToRoot }`; replace every hard-coded `src/features|application|presentation|domain|infrastructure` and `../../../src/` in maker template strings with values derived from it.
- [ ] **Step 3:** Starters, `new`, `setup`, adopt plans emit `workbench.sources.json` and `src/plugin`; the generated `AGENTS.md` template names the layout.
- [ ] **Step 4:** Run maker suites (`makers`, `maker`, `cli:journey`, `generator`, `companion:assembly`). Expected: pass with Task 1 counts plus the new tests.
- [ ] **Step 5:** Commit `Target makers at named source projects`.

### Task 11: Integration, verification, pull request

- [ ] **Step 1:** Merge task branches 3–8 into the work branch (merge commits), resolve conflicts by ownership table; then 9, 10.
- [ ] **Step 2:** `node bin/app source check`; `npm run typecheck`; `node bin/app check`. Expected: pass.
- [ ] **Step 3:** `CHANGELOG.md` `## [Unreleased]` entry (layout, `source` command, `--source` maker option).
- [ ] **Step 4:** `npm run verify -- --json --keep-going > reports/split/verify.json`. Expected: all stages pass except pre-existing, documented failures from Task 1; compare suite counts with Task 1.
- [ ] **Step 5:** `npm run check:self-review`; `.claude/skills/self-review`; `node scripts/delivery/done.mjs` (now `tooling/delivery/done.mjs`) `--base origin/pr/main-reconciliation/main-reconciliation-1`.
- [ ] **Step 6:** Plan the PR document via `node bin/app pr` (preview, then `--apply <planHash>`) as change PR `main-reconciliation-2`; push the branch; open a draft PR with base `pr/main-reconciliation/main-reconciliation-1`, body per `.github/pull_request_template.md` with actual gate output and untested scope (native Obsidian, macOS, served browser if the bundle is byte-identical and not rerun).
