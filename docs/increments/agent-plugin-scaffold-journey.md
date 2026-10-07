---
type: Increment
id: agent-plugin-scaffold-journey
title: "Agent Plugin Scaffold Journey"
owner: "Luis Mendez"
size: M
status: Done
e2e: optional
refs: []
pullRequests: []
---

# Agent Plugin Scaffold Journey

## Summary

An AI agent with a short plugin brief (a custom file extension with its own view and context-menu actions) must lay down a working skeleton from the CLI in one pass. This adds `make batch`, `make feature --bare`, `make file-extension --editor vue` and the `make file-editor` recipe on a host-independent file editor session, and removes friction found while walking the journey as an agent.

## Outcome

`node bin/app make batch --input skeleton.json` creates a feature, a custom file type with a generated Vue editor and a context-menu action as one reviewed plan; `new --extension <ext>` names the format consistently, a `new` preview prints the exact apply command, and `new --help` documents directory creation.

## Scope

### In scope

- `make batch`, `make feature --bare`, `make file-extension --editor vue` and the `file-editor` maker recipe.
- The runtime file editor session, its Vue mount and the generated-project emitter support for it.
- `new --help`, the `new` preview apply hint, `new --extension` renaming and `core.longpaths` in generated repositories.

### Out of scope

- A domain-specific visual editor beyond the generated title and raw-source editor.
- Native Obsidian qualification of the Vue editor in a real vault.

## Acceptance criteria

- [x] AC-1: `make batch` plans a bare feature, a custom file type with a Vue editor and a context-menu action as one reviewed plan; applying it writes every file once and a replay is unchanged. Evidence: `tests/acceptance/agent-plugin-scaffold-journey/ac-1.checks.mjs`
- [x] AC-2: A batch with an unknown field, an excluded recipe or a child step before its feature is refused before any write. Evidence: `tests/acceptance/agent-plugin-scaffold-journey/ac-2.checks.mjs`
- [x] AC-3: `new --extension kanban` on the `custom-file-view` starter renames the sample format (file type id and name, goals, acceptance, pages and notes) without touching other words. Evidence: `tests/acceptance/agent-plugin-scaffold-journey/ac-3.checks.mjs`
- [x] AC-4: An unapproved `new` preview writes nothing and names the exact `--apply <planHash>` rerun. Evidence: `tests/acceptance/agent-plugin-scaffold-journey/ac-4.checks.mjs`

## Affected areas

- `src/cli/**`: batch planning, the file-editor recipe, `--bare`, `--editor`, `new --help`, the apply hint, the `--extension` rename, `core.longpaths` and generated editor wiring.
- `src/application/native-file-editor.ts`: the host-independent editor session contract.
- `src/domain/native-integrations.ts`: editor registration contracts.
- `src/bootstrap/**`: the shared Vue surface and the file editor mount.
- `src/features/api.ts`: the feature-author editor API.
- `src/infrastructure/obsidian/**`: the custom file view and file operations.
- `src/presentation/components/NativeFileEditorHost.vue`: the editor host component.
- `src/presentation/context/native-file-context.ts`: the editor injection context.
- `scripts/examples/ownership.json`: the reviewed hash of the reshaped `mount-ui.ts`.
- `templates/examples/src__bootstrap__mount-ui.ts.txt`: the example-removal replacement keeps the shared Vue surface.
- `tests/runtime/**`: file editor and file operation runtime tests.
- `tests/tooling/**`: CLI and maker checks.
- `tests/fixtures/compiler/starter-golden.json`: reviewed generated-output baseline for the new emitter output.
- `tests/acceptance/agent-plugin-scaffold-journey/**`: acceptance checks of this increment.
- `tests/suites.json`: test levels for the new runtime tests.
- `docs/concepts/companion/index.html`: the rebuilt concept embeds the starter customization.
- `docs/user-manual/shell-cli/generated/**`: the regenerated command manual.
- `docs/development/native-file-integrations.md`: the agent scaffolding how-to.
- `docs/increments/agent-plugin-scaffold-journey.md`: this handoff.
- `CHANGELOG.md`: the Unreleased entry.

## Test plan

- Suite `acceptance`: the four acceptance checks run the real maker planner, starter customization and built CLI.
- Suite `runtime`: `tests/runtime/native-file-editor.test.ts` and `tests/runtime/native-file-operations.test.ts` prove the editor mount, save path and disposal.
- Suite `native`: `tests/tooling/native-integrations.checks.mjs` proves starter customization and native makers.
- Gate `npm run typecheck`: strict runtime and CLI checks pass.
- Gate `npm run app:dev -- check --plan --base origin/main`: diff-scoped verification scope.
- E2E: optional — the served shell UI does not change; generated editors are covered by runtime tests.

## Docs impact

- `docs/development/native-file-integrations.md` (how-to): the extension rename, `make feature --bare`, `--editor vue`, `make file-editor` and the `make batch` skeleton format.

## Changelog

- Added: Agent plugin scaffolding: `make batch --input <skeleton.json>` plans a whole skeleton (feature, file extension, editor, context menu) as one reviewed plan with one check run; `make feature --bare` creates only the feature folder; `make file-extension --editor vue` and the new `make file-editor` recipe give a custom file type a generated Vue editor that reads and saves through the native `TextFileView`. `new --help` shows the directory-creation options, a `new` preview prints the exact `--apply <planHash>` rerun, `new --extension <ext>` renames the starter's sample format throughout the project, and `new` enables `core.longpaths` in the new repository so deep generated paths commit on Windows.

## Risks and rollback

A batch could plan steps that conflict; every step runs through the same planner and conflict checks as single makers, and nothing is written before review. The extension rename only rewrites `.<old>` and the capitalized format word on word boundaries. Roll back by reverting this pull request.

## Dependencies

Luis85/obsidian-plugin-shell#96 (merged into `main`).

## Open questions

None

## Completion record

<!-- Generated by `npm run dod -- --write`; regenerate it instead of editing. -->

- Base: `origin/main` (merge base `50760a72e31f`)
- Changed files: 51 (14 added, 37 modified, 0 renamed, 0 deleted)
- E2E decision: optional; `e2e` label not verifiable locally

### Changed files by area

| Area | Changed files |
| --- | ---: |
| `src/cli/**` | 17 |
| `src/application/native-file-editor.ts` | 1 |
| `src/domain/native-integrations.ts` | 1 |
| `src/bootstrap/**` | 4 |
| `src/features/api.ts` | 1 |
| `src/infrastructure/obsidian/**` | 3 |
| `src/presentation/components/NativeFileEditorHost.vue` | 1 |
| `src/presentation/context/native-file-context.ts` | 1 |
| `scripts/examples/ownership.json` | 1 |
| `templates/examples/src__bootstrap__mount-ui.ts.txt` | 1 |
| `tests/runtime/**` | 3 |
| `tests/tooling/**` | 4 |
| `tests/fixtures/compiler/starter-golden.json` | 1 |
| `tests/acceptance/agent-plugin-scaffold-journey/**` | 4 |
| `tests/suites.json` | 1 |
| `docs/concepts/companion/index.html` | 1 |
| `docs/user-manual/shell-cli/generated/**` | 3 |
| `docs/development/native-file-integrations.md` | 1 |
| `docs/increments/agent-plugin-scaffold-journey.md` | 1 |
| `CHANGELOG.md` | 1 |
| Outside the affected areas | 0 |

### Acceptance criteria evidence

| Criterion | Done | Evidence |
| --- | --- | --- |
| AC-1 | yes | `tests/acceptance/agent-plugin-scaffold-journey/ac-1.checks.mjs` |
| AC-2 | yes | `tests/acceptance/agent-plugin-scaffold-journey/ac-2.checks.mjs` |
| AC-3 | yes | `tests/acceptance/agent-plugin-scaffold-journey/ac-3.checks.mjs` |
| AC-4 | yes | `tests/acceptance/agent-plugin-scaffold-journey/ac-4.checks.mjs` |

### Gates

From `node bin/app check --plan`:

| Gate | Command | Required |
| --- | --- | --- |
| check | `node bin/app check --fast --base origin/main` | yes |
| coverage-production | `npm run test:coverage:production` | yes |
| check-presentation | `npm run check:presentation` | yes |
| suite:maker:pty | `node scripts/testing/suites.mjs maker:pty` | no |
| suite:maker | `node scripts/testing/suites.mjs maker` | yes |
| suite:workbench-plugins | `node scripts/testing/suites.mjs workbench-plugins` | no |
| suite:airship | `node scripts/testing/suites.mjs airship` | no |
| suite:compiler | `node scripts/testing/suites.mjs compiler` | yes |
| suite:compiler:properties | `node scripts/testing/suites.mjs compiler:properties` | no |
| suite:prototypes | `node scripts/testing/suites.mjs prototypes` | no |
| suite:prototypes:python | `node scripts/testing/suites.mjs prototypes:python` | no |
| suite:companion:mvp | `node scripts/testing/suites.mjs companion:mvp` | no |
| suite:runtime | `node scripts/testing/suites.mjs runtime` | yes |
| suite:cli | `node scripts/testing/suites.mjs cli` | yes |
| suite:cli:journey | `node scripts/testing/suites.mjs cli:journey` | no |
| suite:generator | `node scripts/testing/suites.mjs generator` | yes |
| suite:visual | `node scripts/testing/suites.mjs visual` | no |
| suite:companion | `node scripts/testing/suites.mjs companion` | yes |
| suite:companion:schema | `node scripts/testing/suites.mjs companion:schema` | no |
| suite:companion:assembly | `node scripts/testing/suites.mjs companion:assembly` | no |
| suite:companion:browser | `node scripts/testing/suites.mjs companion:browser` | no |
| suite:companion:visual-browser | `node scripts/testing/suites.mjs companion:visual-browser` | no |
| suite:companion:starter-browser | `node scripts/testing/suites.mjs companion:starter-browser` | no |
| suite:test-data | `node scripts/testing/suites.mjs test-data` | no |
| suite:makers | `node scripts/testing/suites.mjs makers` | yes |
| suite:memory | `node scripts/testing/suites.mjs memory` | no |
| suite:memory:python | `node scripts/testing/suites.mjs memory:python` | no |
| suite:native | `node scripts/testing/suites.mjs native` | yes |
| suite:setup | `node scripts/testing/suites.mjs setup` | no |
| suite:acceptance | `node scripts/testing/suites.mjs acceptance` | yes |
| suite:quality | `node scripts/testing/suites.mjs quality` | no |
| suite:baseline | `node scripts/testing/suites.mjs baseline` | no |
| suite:e2e | `node scripts/testing/suites.mjs e2e` | no |
| suite:project | `node scripts/testing/suites.mjs project` | no |
| suite:project:ui-effects | `node scripts/testing/suites.mjs project:ui-effects` | no |
| suite:obsidian | `node scripts/testing/suites.mjs obsidian` | no |
| verify | `npm run verify` | yes |
