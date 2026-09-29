# Project presets and target-aware prototype creation

## Start here

```sh
node shell.mjs new
# No saved project? `node shell.mjs` opens the same new-project guide.
node shell.mjs new presets --json
```

Creation proceeds through **preset → frontend framework → hybrid targets when applicable → prototype interview → explicit design agreement → file-plan review → default-No apply**. Escape goes back; Ctrl+C cancels and restores the terminal. Plain and accessibility modes follow the same catalog/interview. Selected hybrid targets survive a revisit; changing framework/preset invalidates agreement. A saved workspace retains its page editor, with an additional Create another project action.

| Preset | Project type | Suggested frontend |
| --- | --- | --- |
| `plugin-nuxtui` | Obsidian plugin | Vue 3 + Nuxt UI |
| `plugin-vanilla` | Obsidian plugin | No framework |
| `plugin-angular` | Obsidian plugin | Angular |
| `webapp-nuxtui` | Web application | Vue 3 + Nuxt UI |
| `webapp-vanilla` | Web application | No framework |
| `website` | Static-hostable client-rendered website | No framework |
| `cli` | Node.js CLI | No frontend |
| `hybrid` | At least two explicit targets | Vue 3 + Nuxt UI |

Named stacks are suggested defaults, not distinct project-type schemas. The second step can choose another compatible frontend. Nuxt UI means Vue/Vite components, **not the Nuxt application framework**. CLI alone is `none` and never acquires frontend dependencies. Hybrid can include plugin, webapp, website and CLI; visual targets share one selected frontend while CLI remains headless. It implies shared local code, not cloud sync or a desktop wrapper.

## Agent interface

```sh
node shell.mjs new guide --preset plugin-angular --framework angular --json
node shell.mjs new guide --preset hybrid --framework vanilla --targets plugin,webapp,cli --json
```

Use the response's `data.input` as the request; it is deliberately not approved. The nested field is `interview`, not the reserved JSON property `prototype`. Existing anti-prototype-pollution validation is unchanged.

```json
{
  "schemaVersion": 1,
  "catalogVersion": 1,
  "preset": "plugin-angular",
  "framework": "angular",
  "targets": ["plugin"],
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
node shell.mjs new validate --input request.json --json
node shell.mjs new --input request.json --out projects/issue-desk --json
node shell.mjs new --input request.json --out projects/issue-desk --apply <reviewed-planHash> --json
```

`--input -` reads bounded JSON from stdin. JSON, CI and noninteractive paths never take terminal ownership or prompt. Selection flags are for discovery and interactive creation, not silent overrides of a reviewed input file. Validation/discovery reject write flags. The plan hash covers the selected configuration, full model, source and documentation. No `--yes` bypass is added. Existing explicit legacy `new --starter`, `new --from`, `new --list` and `new <directory>` routes remain available.

## Prepared package and generation

The package contains `design-brief.md`, `execution-prompt.md`, `project.config.json`, replayable `project-request.json`, exact guide/answers, complete `companion.project.json`, preparation/integration/manifest metadata and `source/`. `source/project.config.json` mirrors the selection. Target metadata is **never inserted into the closed Companion v6 envelope**.

The same compiler parses, migrates, validates and resolves the model. Its `project` output adapter emits `src/core/project.ts`, `src/targets/<target>/main.ts`, the selected UI implementation, dependency manifests, typecheck/build scripts, starter tests, documentation and canonical Claude/Codex skill package. Native entrypoints own plugin/view lifecycle. Angular uses AOT, zoneless per-view applications with cleanup, rather than document-global bootstrap. Nuxt UI reuses the existing static vendor guards and owned CSS. Vanilla uses DOM APIs. CLI commands have structured output and nonzero failure exits.

This is an intentionally honest **starting scaffold**: a navigable page-list projection, target integration and prototype handoff. Component bodies, arbitrary visual trees and agreed business actions remain prototype implementation, not fabricated completed behavior. The entire authoring model is preserved. Source/test base folders currently must remain `src` / `tests`; custom folder adapters fail explicitly rather than silently misrouting files.

`sketch generate` detects a saved `project.config.json`; both machine and studio generation preserve its targets/framework. Explicit `--kind project` requires that sidecar. The safe file planner rejects edited/unowned files and stale approval hashes. Regenerate into another directory when preserving source-owned implementation.

## Build and readiness boundaries

Generated dependencies use exact direct pins. The new target lockfile initially contains only the root manifest and readiness is **resolution-required**, not locked. Review and explicitly `npm install`; retain the resolved lock and prove a clean `npm ci` before claiming reproducibility. Generation never installs or runs code.

Use Node 24.21.0 and npm 11.19.1. In `source/`, run typecheck, test and build. Visual targets provide `npm run build:prototype` for an offline `dist/prototype.html`; existing output requires explicit `-- --replace`. Plugin builds produce `dist/plugin/main.js`, `styles.css` and `manifest.json`, without touching a vault. CLI produces `dist/cli/targets/cli/main.js`; use `npm run start:cli -- pages --json`. CLI-only projects do not fabricate an HTML prototype.

`prototype.manifest.json` stays incomplete with a null artifact hash until real artifact measurements and acceptance. Bundling is not business or native acceptance. Website output is client-rendered static hosting, not server rendering or an SEO guarantee.

## Extension and qualification

`bin/guides/project-presets.json` is the versioned catalog; `project-prototype.json` is the data-driven interview and artifact template set. New presets composed from existing target/framework adapters need catalog data only. New runtimes require a real compiler adapter, compatibility rules and qualification—not an additional menu label.

Tests live in `interactive-maker-project-*.checks.mjs` and remain included in the existing maker suite/coverage. The compiler architecture traversal includes the new pure emitter. The added `project-preset-qualification.yml` uses the existing exact toolchain and qualifies eight presets plus all three hybrid framework variants with explicit dependency resolution, clean install, typecheck, tests, builds and exact-artifact browser/CLI smoke checks. It does not activate Obsidian. Run its disposable driver explicitly:

```sh
node scripts/compiler/qualify-presets.mjs --preset hybrid --framework angular
node scripts/compiler/qualify-presets.mjs --preset hybrid --framework angular --execute
```

The first command only describes the planned qualification. Execution requires the qualified toolchain and `QUALIFIED_NPM`. Reports separate source/build/browser success from native and business acceptance. Existing quality thresholds are unchanged.

## API references used for the Angular adapter

- Angular createApplication: https://angular.dev/api/platform-browser/createApplication
- Angular createComponent: https://angular.dev/api/core/createComponent
- Angular ApplicationRef teardown: https://angular.dev/api/core/ApplicationRef
- Angular version compatibility: https://angular.dev/reference/versions
- Angular zoneless applications: https://angular.dev/guide/zoneless

Angular 22 direct pins are a selected baseline, not a claim that they are the newest release. They still require dependency/build/native qualification. The Vue/Nuxt UI adapter keeps the repository's qualified dependency pins and module-hash guards rather than silently upgrading them.
