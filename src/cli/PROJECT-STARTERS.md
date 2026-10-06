# Project starters and target-aware prototype creation

Creating a project always runs a **project starter**: a JSON definition in
`configs/starters/<id>.json` whose `generator.kind` is `project`. The shell ZIP
contains no starters. Extract the separate `workbench-starters-<version>.zip` into the same package root
(or add your own definition) first; the maker reads project starters
from that folder, honoring its `configs/user-settings.json` `paths.startersFolder`.
An empty folder lists no starters, and creation fails closed rather than falling back.

## Start here

```sh
node bin/app new
# No saved project? `node bin/app` opens the same new-project guide.
node bin/app new --starter plugin-angular
node bin/app new starters --json
```

Creation proceeds through **starter → prototype interview → explicit design agreement → file-plan review → default-No apply**. Escape goes back; Ctrl+C cancels and restores the terminal. Plain and accessibility modes follow the same starters and interview. Choosing another starter invalidates agreement. A saved workspace retains its page editor, with an additional Create another project action.

| Starter | Project type | Frontend | Targets |
| --- | --- | --- | --- |
| `plugin-nuxtui` | Obsidian plugin | Vue 3 + Nuxt UI | plugin |
| `plugin-vanilla` | Obsidian plugin | No framework | plugin |
| `plugin-angular` | Obsidian plugin | Angular | plugin |
| `webapp-nuxtui` | Web application | Vue 3 + Nuxt UI | webapp |
| `webapp-vanilla` | Web application | No framework | webapp |
| `webapp-angular` | Web application (also used by `project-setup`) | Angular | webapp |
| `website` | Static-hostable client-rendered website | No framework | website |
| `cli` | Node.js CLI | No frontend | cli |
| `hybrid-nuxtui` | Hybrid | Vue 3 + Nuxt UI | plugin, webapp, website, cli |
| `hybrid-vanilla` | Hybrid | No framework | plugin, webapp, website, cli |
| `hybrid-angular` | Hybrid | Angular | plugin, webapp, website, cli |

### Primary use-case coverage

The stable IDs above map to the product-level starter families without renaming saved selections:

| Product use-case | Stable starter IDs | Variants |
| --- | --- | --- |
| Obsidian plugin | `plugin-nuxtui`, `plugin-vanilla`, `plugin-angular` | Vue 3 + Nuxt UI, vanilla TypeScript, Angular |
| Web application | `webapp-nuxtui`, `webapp-vanilla`, `webapp-angular` | Vue 3 + Nuxt UI, vanilla TypeScript, Angular |
| Terminal application | `cli` | Headless Node.js with human/JSON output |
| Website | `website` | Static-hostable vanilla TypeScript |

The internal target names `plugin` and `cli` remain compatibility contracts; product surfaces should describe them as **Obsidian plugin** and **Terminal application**.

Every project starter also emits the same typed local plugin system. Application extensions live under `plugins/<plugin-name>/`, own `src/`, `tests/`, `manifest.json` and `config.json`, and export a named `PluginObject`. See [generated project plugins](../../docs/development/GENERATED-PROJECT-PLUGINS.md). Workbench itself has a separate [plugin SDK](../../docs/development/WORKBENCH-PLUGINS.md) that can add framework adapters, project starters, events, CLI commands and Studio/TUI actions.

A starter fixes its project type, frontend and targets; there is no creation-time
override. To use another compatible combination, add a starter definition, for
example a copy of `hybrid-vanilla.json` under a new `id` and filename with
`"targets": ["plugin", "cli"]`, and
validate it with `node bin/app starters validate --json`. Nuxt UI means Vue/Vite
components, **not the Nuxt application framework**. A CLI-only starter uses
`framework: "none"` and never acquires frontend dependencies. Hybrid visual targets
share one frontend while CLI remains headless; it implies shared local code, not
cloud sync or a desktop wrapper.

## Starter definition

A project starter uses the common definition contract from
[JSON starters](../../docs/development/JSON-STARTERS.md) with a `project` generator:

```json
"generator": {
  "kind": "project",
  "projectType": "plugin",
  "framework": "angular",
  "targets": ["plugin"],
  "angularPins": {
    "@angular/core": "22.0.0", "@angular/common": "22.0.0", "@angular/compiler": "22.0.0",
    "@angular/platform-browser": "22.0.0", "@angular/compiler-cli": "22.0.0",
    "rxjs": "7.8.2", "tslib": "2.8.1"
  }
}
```

`projectType` is `plugin`, `webapp`, `website`, `cli` or `hybrid`; `framework` is a registered adapter ID. Built-ins are
`nuxtui`, `vanilla`, `angular` and `none`, while Workbench plugins may add IDs such as `react`. Targets are listed once in plugin, webapp,
website, cli order: exactly the project type's own target, or two or more for hybrid.
CLI-only requires `none`; visual targets require a frontend. `angularPins` is
required for Angular (exact versions, one `@angular` version) and forbidden otherwise.
A project starter declares empty `inputs`, `files`, `processes` and `firstRun`: its
identity and design come from the interview, and the project compiler owns every
emitted file. Unknown fields fail validation. `node bin/app new <dir> --starter
<project-starter>` refuses with `STARTER_KIND`; directory creation serves file and
Companion starters.

## Agent interface

```sh
node bin/app new starters --json
node bin/app new guide --starter plugin-angular --json
```

Use the response's `data.input` as the request; it is deliberately not approved. The nested field is `interview`, not the reserved JSON property `prototype`. Existing anti-prototype-pollution validation is unchanged.

```json
{
  "schemaVersion": 2,
  "starter": "plugin-angular",
  "interview": {
    "schemaVersion": 1,
    "guideId": "project-prototype",
    "guideVersion": 1,
    "answers": {
      "title": "Issue Desk",
      "pages": ["Overview", "Issues"],
      "components": ["Issue summary"],
      "problem": "Keep local issues visible while working in the vault.",
      "approved": false
    }
  }
}
```

Review the complete defaults and answers with `new validate`; set `approved: true` only after explicit design agreement. Resolve open questions and requested concept-board exploration first. Image generation is not performed by the CLI.

```sh
node bin/app new validate --input request.json --json
node bin/app new --input request.json --out projects/issue-desk --json
node bin/app new --input request.json --out projects/issue-desk --apply <reviewed-planHash> --json
```

`--input -` reads bounded JSON from stdin. JSON, CI and noninteractive paths never take terminal ownership or prompt. `--starter` is for discovery and interactive creation, never a silent override of a reviewed input file. Validation/discovery reject write flags. The plan hash covers the selected starter (including its content hash), full model, source and documentation. No `--yes` bypass is added. Requests and sidecars from the retired preset catalog (`schemaVersion: 1`) are rejected, not migrated.

## Prepared package and generation

The package contains `design-brief.md`, `execution-prompt.md`, `configs/<project-id>-config.json`, replayable `project-request.json`, exact guide/answers, complete `companion.project.json`, preparation/integration/manifest metadata and `source/`. The project configuration (`schemaVersion: 2`) records the chosen starter's ID, version and SHA-256 together with its complete selection, so regeneration never needs the starter file again. `source/configs/<project-id>-config.json` mirrors it. Target metadata is **never inserted into the closed Companion v6 envelope**.

The same compiler parses, migrates, validates and resolves the model. Its `project` output adapter emits `src/core/project.ts`, `src/targets/<target>/main.ts`, the selected UI implementation, dependency manifests, typecheck/build scripts, starter tests, documentation and canonical Claude/Codex skill package. Native entrypoints own plugin/view lifecycle. Angular uses AOT, zoneless per-view applications with cleanup, rather than document-global bootstrap. Nuxt UI reuses the existing static vendor guards and owned CSS. Vanilla uses DOM APIs. CLI commands have structured output and nonzero failure exits.

This is an intentionally honest **starting scaffold**: a navigable page-list projection, target integration and prototype handoff. Component bodies, arbitrary visual trees and agreed business actions remain prototype implementation, not fabricated completed behavior. The entire authoring model is preserved. Source/test base folders currently must remain `src` / `tests`; custom folder adapters fail explicitly rather than silently misrouting files.

`sketch generate` detects a saved project configuration (below); both machine and studio generation preserve its starter, targets and framework. Explicit `--kind project` requires that configuration. The safe file planner rejects edited/unowned files and stale approval hashes. Regenerate into another directory when preserving source-owned implementation.

## Project configuration

A project's saved starter selection lives at `configs/<project-id>-config.json`, where
`<project-id>` is the project's Companion ID (`project.id` in `design/project.json`:
lowercase letters and digits joined by single hyphens, at most 60 characters). One domain
rule (`src/cli/compiler/domain/project-config.ts`) names the file for every writer and reader:
`project-setup`, `new` packages (`configs/` and `source/configs/`), compiler-generated
sources and their `scripts/build.mjs`/`scripts/serve.mjs`, `sketch generate`, `prototype`,
`brainstorm`, `design` and `first-run`.

Commands that need the current project use `--config configs/<project-id>-config.json`
when given; otherwise they read the single `*-config.json` file directly inside `configs/`
of the folder they run in (`--root`, by default the current directory).
Subfolders such as `configs/starters`, `configs/types` and `configs/quality` are never
searched, and neither is `projects/`: a standalone project in `projects/<name>` keeps any
configuration of its own in `projects/<name>/configs/`, which only commands run inside
that folder read. No match means no saved project. Several matches fail with
`PROJECT_CONFIG_AMBIGUOUS`, which lists the candidates and the `--config` option; a
`*-config.json` name that is not a portable project ID fails with `PROJECT_CONFIG_INVALID`,
and a `--config` path that does not exist fails with `PROJECT_CONFIG_MISSING`. A linked
`configs/` folder or configuration file is refused. `project-setup` refuses to add a
second configuration beside another project's (`PROJECT_CONFIG_CONFLICT`).
`--config` is a maker option of the commands that read the saved project: `sketch`,
`prototype`, `studio`, `brainstorm` and `design`. Maker commands that never read it refuse
it with their own option code: `new` (`PROJECT_OPTION`), `project-setup` and `settings`
(`SETUP_OPTION`) and `first-run` (`FIRST_RUN_OPTION`). Framework commands such as `setup`,
`check`, `base` or `site` reject it as an unknown option (`INVALID_OPTION`).

The retired root `project.config.json` is never read. When it exists and `configs/` holds
no project configuration, commands fail with `PROJECT_CONFIG_RELOCATED`. A project made by
`project-setup` moves it with the reviewed migration, which moves the bytes unchanged to
`configs/<project-id>-config.json` and removes the root file in one hash-guarded plan:

```sh
echo '{"schemaVersion":1}' | node bin/app settings migrate --input - --json
# Review the two changes, then repeat with --apply <planHash>.
```

The migration refuses when `configs/` already holds a project configuration
(`MIGRATION_CONFLICT`) and runs before any path migration (`MIGRATION_ORDER`). Elsewhere,
move the file by hand to the name the project ID gives, or regenerate prepared packages and
generated sources, which write the new location.

Hosting: the project-starter interview does not ask for a hosting platform. The directory form `node bin/app new <dir> --starter <id>` (Companion and `--from` starters) takes `--hosting github|azure-devops|none` with the `--azure-*` details and asks interactively; `companion.project.json` can carry `tooling.hosting` for a later `new <dir> --from`. See [hosting platforms](../../docs/development/HOSTING-PLATFORMS.md).

## Build and readiness boundaries

Generated dependencies use exact direct pins. The new target lockfile initially contains only the root manifest and readiness is **resolution-required**, not locked. Review and explicitly `npm install`; retain the resolved lock and prove a clean `npm ci` before claiming reproducibility. Generation never installs or runs code.

Use Node 24.21.0 and npm 11.19.1. In `source/`, run typecheck, test and build. Visual targets provide `npm run build:prototype` for an offline `dist/prototype.html`; existing output requires explicit `-- --replace`. Plugin builds produce `dist/plugin/main.js`, `styles.css` and `manifest.json`, without touching a vault. CLI produces `dist/cli/src/targets/cli/main.js`; use `npm run start:cli -- pages --json`. CLI-only projects do not fabricate an HTML prototype.

`prototype.manifest.json` stays incomplete with a null artifact hash until real artifact measurements and acceptance. Bundling is not business or native acceptance. Website output is client-rendered static hosting, not server rendering or an SEO guarantee.

## Extension and qualification

Project starters are data: a new combination of existing target/framework adapters needs only a new definition. Generated project plugins are a separate application extension seam: adding a plugin changes the generated project's explicit `plugins/registry.ts`, not the Workbench starter catalog. `project-prototype.json` is the data-driven interview and artifact template set. New runtimes require a real compiler adapter, compatibility rules and qualification—not an additional menu label.

Tests live in `interactive-maker-project-*.checks.mjs` and `interactive-maker-starters-ui.checks.mjs` and remain included in the existing maker suite/coverage; `starter-definitions.checks.mjs` covers the `project` generator contract. The compiler architecture traversal includes the pure emitter. `project-starter-qualification.yml` uses the existing exact toolchain and qualifies every shipped project starter (the eight former presets, the two additional hybrid frameworks and `webapp-angular`) with explicit dependency resolution, clean install, typecheck, tests, builds and exact-artifact browser/CLI smoke checks. It does not activate Obsidian. Run its disposable driver explicitly:

```sh
node scripts/compiler/qualify-project-starters.mjs --starter hybrid-angular
node scripts/compiler/qualify-project-starters.mjs --starter hybrid-angular --execute
```

The first command only describes the planned qualification. Execution requires the qualified toolchain and `QUALIFIED_NPM`. Reports separate source/build/browser success from native and business acceptance. Existing quality thresholds are unchanged.

## API references used for the Angular adapter

- Angular createApplication: https://angular.dev/api/platform-browser/createApplication
- Angular createComponent: https://angular.dev/api/core/createComponent
- Angular ApplicationRef teardown: https://angular.dev/api/core/ApplicationRef
- Angular version compatibility: https://angular.dev/reference/versions
- Angular zoneless applications: https://angular.dev/guide/zoneless

Angular 22 direct pins are a selected baseline, not a claim that they are the newest release. They still require dependency/build/native qualification. The Vue/Nuxt UI adapter keeps the repository's qualified dependency pins and module-hash guards rather than silently upgrading them.
