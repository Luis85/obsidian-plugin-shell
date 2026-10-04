# Agent instructions: Workbench Companion

Obsidian plugin (`workbench-companion`) built on the Plugin Shell: TypeScript, Vue 3, Pinia,
Nuxt UI, Vite, Vitest. Node and npm versions are pinned in `.nvmrc` and
`package.json`. The one install command is `npm ci` (exact lockfile; never
`npm install` unless `design/compiler-readiness.json` says dependencies are
`resolution-required` and the user agreed).

## Start with BRIEF.md

Read [BRIEF.md](BRIEF.md) first: product goal, users, must-have journeys, out of
scope, open questions. Anything marked `TODO(owner)` is a gap in what the owner has
decided. Ask the user to fill the gaps that block your task, write the answers into
`BRIEF.md`, and do not invent product behaviour. Then read the requirement you work
on in `design/traceability.json`. Claude Code prints the project state at session
start; elsewhere run `node bin/app status`.

## Definition of done

Run these before you claim a change works, and show the output:

1. `npm run check` passes (typecheck, ESLint with zero warnings, product tests).
   During iteration use `npm run check:fast` (typecheck + tests related to files
   changed since the last commit). `node bin/app check --plan` shows which gates a
   diff needs.
2. UI changes: `npm run test:ui-quality` passes and `npm run ui:gallery` is reviewed.
3. For behaviour that touches the host (commands, views, settings, vault writes), when
   Obsidian is already provisioned: `npm run -s dev:obsidian -- --json` reports
   `"status": "passed"` and no `errors`; lifecycle or host-API changes also need
   `npm run test:obsidian`.
4. `npm run verify:project` (what CI runs).
5. Self-review with the `self-review` skill, then fill `.github/pull_request_template.md`:
   requirement/`vi-*` IDs, commands with real output, UI evidence, Obsidian evidence or
   "not run", untested scope.

Report the commands you ran and their real results. Never report success from
reading code alone, and a TODO test is never passing acceptance. If a check cannot run here (for
example no display or no downloaded Obsidian), say so explicitly. Larger changes start
from `docs/project-tasks/TEMPLATE.md`.

## Project map

- `src/generated/`: generated product code (domain, application use cases,
  sources, Pinia stores, Vue screens). Edit freely; regeneration keeps edits and
  reports conflicts instead of overwriting.
- `src/features/<name>/`: hand-written features using only `src/features/api.ts`.
- `src/main.ts`: lifecycle composition only (at most 100 code lines).
- `tests/project/`: product tests; `acceptance/` has one TODO test per requirement
  (`req-*.test.ts`) and per unimplemented interaction (`vi-*.test.ts`).
- `tests/obsidian/`: real-Obsidian specs and the fixture vault they copy.
- `design/traceability.json`: requirements with acceptance text, implementation
  path, test path and `verification` status. `design/project.json` is the design.
- `design/visual-traceability.json`: every UI interaction (`vi-*`) with its
  `verification` kind, hook (`implementation`) and test.
- `BRIEF.md`: owner-written product brief. `docs/project-tasks/`: task template.
- The rest of `src/`, `scripts/` and `tests/` is the shell framework. Change it only
  when a product need cannot be met through its APIs.

## Architecture rules

- Domain and application code are framework-free: no imports from `obsidian`, Vue,
  Pinia, browser or Node APIs, or concrete adapters.
- Features depend only on feature/application/domain contracts via
  `src/features/api.ts`; host UI goes through `services.modals` and
  `services.notices`, never `new Notice()`/`new Modal()` in feature code.
- Every `.vue` file lives under `src/presentation/components` or the generated
  `presentation/components`; keep SFC scripts to imports, props and composable
  bindings. Behaviour goes in TypeScript composables, per-view state in stores.
- Application services own canonical data; Markdown notes stay canonical for
  note-backed entities. Preserve note IDs, unrelated frontmatter and body bytes.
- Publish events only after a successful write. No global singletons.
- File size: at most 400 code lines per runtime/script/CSS file and 450 per test
  file. Split files by responsibility instead of compressing code.
- Do not weaken lint rules, thresholds or tests, and do not use unsafe casts.

## Test-driven loop

Requirements (`design/traceability.json`, `verification: "todo"`):

1. Pick one. Replace the `it.todo` in its `test` file (`tests/project/acceptance/req-*.test.ts`)
   with a failing behavioural assertion (`npm run test:tdd` watches the acceptance folder).
2. Implement the use case at its `implementation` path
   (`src/generated/application/use-cases/req-*.ts`) until the test passes.
3. `npm run check`, then verify in real Obsidian when the host is involved.
4. Set `verification` to `"implemented"` only after the test really passes.

Interaction obligations (`design/visual-traceability.json` `interactions[]`): entries with
`verification: "business-todo"` have a hook at `src/generated/application/interactions/vi-*.ts`
whose `execute` throws `NotImplementedError`, and an `it.todo` at
`tests/project/acceptance/vi-*.test.ts`. Write the failing assertion first, then replace the
throw with the real behaviour. It is done when the test passes and the hook no longer
throws; `design/visual-traceability.json` is generated, so do not hand-edit it.
`navigation` and `executable-ui-effect` entries already have tests and need no business
code. Each unimplemented `vi-*` is an open acceptance obligation, like a `todo` requirement.

Unit tests that need Obsidian use the in-memory kit:
`vi.mock('obsidian', () => import('@test/obsidian'))` plus `createTestApp()`.
A bare `obsidian` import in tests throws on purpose. DOM tests need
`// @vitest-environment happy-dom`. Example: `tests/project/plugin-host.test.ts`.
Guide: `docs/framework/testing/OBSIDIAN-TEST-KIT.md`.

## See the UI

- `npm run dev:ui`: browser harness for the Vue UI without Obsidian.
  `npm run dev:preview`: generated source-backed preview.
  `npm run build:clickdummy`: offline `clickdummy.html` with synthetic data.
  These are long-running servers or builds for the user to look at: start them only
  when asked, and stop what you started.
- Headless, for agents: `npm run test:ui-quality` checks the rendered UI for layout and
  quality regressions; `npm run ui:gallery` writes screenshots and `index.json` to
  `reports/ui-gallery/`. Review them as evidence. They are not baselines: never
  accept, commit or update screenshots to make a check pass.
- `npm run dev:obsidian` shows the real host and only runs where Obsidian is provisioned.

## Verify in real Obsidian

`npm run -s dev:obsidian -- --json` builds with inline source maps, launches the
contained sandbox vault, reloads the plugin once and prints one JSON summary:
`status`, `errors` (deduplicated, with `src/...` frames), `pluginConsole`,
`commands`, and paths to `last-run.png` (screenshot), `dev.log` and
`debug-report.json` under `.obsidian-sandbox/logs/`. Read those files for detail.
Exit code 2 means Obsidian is not provisioned: ask the user to run it once
with `--allow-download` (agents never download it themselves). Specs: `tests/obsidian/*.obsidian.ts`, run with
`npm run test:obsidian -- <filter>`; evidence lands in `reports/obsidian/`.
Guide: `docs/framework/testing/OBSIDIAN-DEV-LOOP.md`.

## Logging and debugging

Use the structured logger with declared catalogs and safe metadata
(`docs/framework/development/LOGGING-AND-DEBUGGING.md`). Never log note content, file paths
or raw error causes. The `debug-toggle` and `debug-report` commands expose debug
records; the dev loop enables them automatically.

## Safety

- Only open contained vaults inside this folder (`.obsidian-sandbox/`, `.nq/`,
  `tests/obsidian/vault`). Never point any tool at a personal vault.
- Do not commit `.obsidian-sandbox/`, `.native-cache/`, `.native-runner/`,
  `reports/` or `dist/`.
- Do not publish, tag, push with force, run `release:operate` or install global
  packages unless the user explicitly asks.
- Code generators preview first: run `npm run make -- <maker> <name> --dry-run`,
  review, then apply with `--yes`.

## Working in a cloud session

In Claude Code on the web, `scripts/agent/session-start.mjs` provisions the exact `.nvmrc` Node
(checksum-verified, cached under `~/.cache/workbench`) and restores `node_modules` with `npm ci --ignore-scripts`;
read its status first. An older Chromium is adopted as a non-pinned `SHELL_CHROMIUM`: say so when you report
browser evidence. Opt out with `SHELL_SESSION_START_NODE=0`. Setup script and troubleshooting:
`docs/framework/development/CLOUD-AND-LOCAL-SESSIONS.md`.

## When stuck

- `npm run doctor` for toolchain problems; `node bin/app help` for commands.
- `README.md` for the command overview; `docs/framework/development/BUILD-A-FEATURE.md`
  for feature structure; `.claude/skills/` (mirrored for Codex in `.agents/skills/`)
  for step-by-step workflows; `docs/framework/AGENTS.md` for the framework's full
  maintainer policy (reference only).
