---
type: Increment
id: agent-plugin-scaffold-journey
title: "Agent Plugin Scaffold Journey"
owner: "Luis Mendez"
size: M
status: Ready
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
