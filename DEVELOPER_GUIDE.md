# Developer guide

> Type: how-to · Part of the [docs index](docs/README.md)

Step-by-step instructions for setting up this framework checkout and for
improving or extending the plugin, the CLI and the generator. Each section is
short and links to the detailed guide for its topic. [AGENTS.md](AGENTS.md)
holds the binding rules. If this guide and AGENTS.md disagree, AGENTS.md wins.

This guide covers the **framework repository** itself. A project generated
with `node bin/app new` has its own README and AGENTS.md. For that daily loop,
use the [Shell CLI user manual](docs/user-manual/shell-cli/index.md).

## 1. Requirements

Set these up before you run anything else. "Required" means the default
workflow (`npm run setup`, `npm run verify`, `node bin/app check`) needs it.
"Optional" means only the commands listed in that row need it.

| Requirement | Exact version | Need | Needed by | How to satisfy and verify |
| --- | --- | --- | --- | --- |
| Node.js | **24.21.0** ([.nvmrc](.nvmrc)) | Required | Everything | nvm: `nvm install && nvm use` (reads `.nvmrc`). fnm: `fnm install && fnm use`. Volta: `volta install node@24.21.0`. Do not run `volta pin`, because it edits `package.json`. nvm-windows: `nvm install 24.21.0` and then `nvm use 24.21.0`. Check with `node --version`. Setup refuses Node below 22.13 (the `engines` floor), but 24.21.0 is the only qualified version. |
| npm | **11.19.1** (`packageManager` in [package.json](package.json)) | Required | Install, setup, all npm scripts | Check it separately from Node: `npm --version`. If it differs, select 11.19.1 without touching the global npm, the same way CI does. Run `npm install --prefix ~/.tools/npm-11.19.1 --ignore-scripts --no-fund --package-lock=false npm@11.19.1`, then use `node ~/.tools/npm-11.19.1/node_modules/npm/bin/npm-cli.js <args>` in place of `npm`. A one-off `npx --yes npm@11.19.1 <args>` also works. `npm install -g npm@11.19.1` changes your machine-wide npm; that is your decision, and the repository never does it. Corepack is not used or tested here. Setup accepts npm 11.19.1 or later and below 13 (npm 12 is a regression target). Setup's child processes use the npm that started it, so start setup with the npm you selected. |
| Git | any current 2.x | Required | Cloning, `check --fast`, `check --plan`, `check:self-review`, makers' hash checks | `git --version`. |
| Operating system | Linux, Windows, macOS | Required | — | CI runs the baseline and setup on Linux and Windows, and the framework CLI job also on macOS. The macOS install hook (`fsevents`) stays disabled, and no macOS-native qualification is claimed. Native Obsidian on Linux needs a display or `xvfb`, plus a short checkout path (`NATIVE_SOCKET_PATH_TOO_LONG`). Mobile is not qualified, and the plugin is desktop-only. |
| TypeScript | **6.0.3**, repository-local | Required (installed by the lockfile) | `npm run typecheck*`, build, makers | It comes from `package-lock.json`. Always use the npm `typecheck*` scripts, which call `node_modules/…`. Never use a global `tsc`, never link a TypeScript 5.x into `node_modules`, and never force TypeScript 7. If the locked tooling cannot be installed, report the type check as not run. |
| Disk and network | about 0.6 GB for `node_modules`, plus browser and host downloads | Required | `npm ci` | Install needs registry access through your normal npm configuration. A setup dry run needs no network and no dependencies. |
| Playwright Chromium | the revision pinned by `@playwright/test` 1.63.0 | Optional | `npm run test:e2e`, browser suites, `ui:gallery` | Run `npm run setup -- --provision-browser`, or after installing, `node node_modules/@playwright/test/cli.js install chromium`. A different installed Chromium is refused (`browser-revision-mismatch`) unless you opt in with `SHELL_CHROMIUM=<absolute path>`. Check with `node src/cli/tooling/testing/browser-executable.mjs`. |
| Python 3 | 3.11+ | Optional | `memory` suites, `maker:pty`, `companion:assembly` | `python3 --version`, or set `PYTHON` to another interpreter. |
| Python `jsonschema` | 4.26.0, in a venv | Optional | `companion:schema` suite only | `python3 -m venv ~/.venvs/workbench-schema && ~/.venvs/workbench-schema/bin/pip install jsonschema==4.26.0` (keep the venv outside the checkout), then `PYTHON=~/.venvs/workbench-schema/bin/python node tooling/testing/suites.mjs companion:schema`. This is test tooling, not a runtime dependency. |
| Python Playwright | 1.57.0, in a venv | Optional | `companion:browser`, `companion:mvp` | Follow the `python-playwright` hint printed by `node tooling/testing/suites.mjs --list --json`, and see [companion-concept-verification.yml](.github/workflows/companion-concept-verification.yml). |
| Obsidian desktop | host 1.13.7 (manifest `minAppVersion`) | Optional | `npm run dev:obsidian`, `test:obsidian`, `test:native` | You never install it by hand for tests. Pass `--allow-download` or set `OBSIDIAN_ALLOW_DOWNLOAD=1` once. That puts `obsidian-launcher@3.2.1` in `.native-runner/` and the host in `.native-cache/`. Only contained scratch vaults are used, never a personal vault. See [the Obsidian dev loop](docs/testing/OBSIDIAN-DEV-LOOP.md). |
| Obsidian CLI | 1.12.7+ | Optional | `node bin/app obsidian …` adapters | It comes with your Obsidian install. Check with `node bin/app obsidian status --obsidian-vault "<test vault>"`. Every call needs an explicitly named vault. |
| Qualified npm path | npm 11.19.1 `npm-cli.js` | Optional | `cli:journey` suite | `export QUALIFIED_NPM=<path to npm-cli.js>`. |

Cloud and agent sessions provision the qualified Node automatically. See
[cloud and local sessions](docs/development/CLOUD-AND-LOCAL-SESSIONS.md).

## 2. Quick start

1. **Clone the repository and open it in a terminal.** Keep the checkout
   outside any Obsidian vault and use a short path.
2. **Check your toolchain.** Run `node --version`, which should print
   `v24.21.0`, and `npm --version`, which should print `11.19.1`. The
   standalone CLI is generated; a fresh source checkout must install dependencies
   and build it before running `node bin/app` commands.
3. **Review the setup plan.** Run `npm run setup -- --dry-run`. The dry run
   uses no dependencies and makes no writes, network calls or child processes.
   It prints the identity, the file changes with their hashes, and the stages
   it would run: install, optional browser download, verify and optional
   native install. Show every flag with `npm run setup -- --help`.
4. **Run setup.** Run `npm run setup`. It is interactive in a terminal. For
   automation, use `npm run setup -- --yes --no-interaction`. Setup reviews
   identity, runs `npm ci` on the exact lockfile, then builds, type-checks and
   tests. Useful flags:
   - `--id`, `--name`, `--author`, `--repo`, `--version` rename the plugin.
     See [setup and identity](docs/development/SETUP-IDENTITY.md).
   - `--profile native` also copies `main.js`, `manifest.json` and `styles.css`
     into `.dev-vault/.obsidian/plugins/<id>/`.
   - `--provision-browser` downloads the pinned Chromium.
   - `--skip-install`, `--defer-verify` and `--resume` handle partial reruns.
   - `--mcp` / `--no-mcp` opt in to or out of the project-local agent MCP.
5. **Build and test.** Run `npm run build:cli` for the standalone CLI, then
   `node bin/app doctor` to inspect the environment. Run `npm run build`, which writes `dist/`, then `npm test`
   (the runtime Vitest suite) and `node bin/app check`.
6. **Develop.** Use one of these:
   - `npm run dev:ui` opens a browser harness with the real components and
     synthetic storage. It never touches a vault.
   - `npm run dev` runs staged rebuilds without installing anything.
   - `npm run dev:local` installs each successful build into `.dev-vault`.
   - `npm run dev:obsidian` runs a real-Obsidian sandbox with hot reload.
7. **Try the plugin in Obsidian.** Open `.dev-vault` in desktop Obsidian and
   enable the plugin yourself. Setup never changes Restricted Mode. Then run
   **Open capability showcase**.

If something fails, see [section 8](#8-troubleshooting-and-known-exceptions).

## 3. Project layout

| Path | What lives there |
| --- | --- |
| `src/<project>/` | Source projects, each self-contained (code, its own `tests/` with fixtures and support, `tsconfig.json`) and declared in `workbench.sources.json`: `shared` (library), `tui` (library, depends on `shared`), `cli` (depends on `shared`, `tui`), `companion` and `plugin` (each depends on `shared`). Cross-project imports use `#shared/*` and `#tui/*`. Manage them with `node bin/app source list`, `graph`, `check`, `add`, `link`, `unlink`, `rename` and `remove`. |
| `src/plugin/domain`, `src/plugin/application` | Framework-free contracts and services: entities, outcomes, repositories, the event bus, preferences and the plugin-data store. They import no Obsidian, Vue, Pinia, browser or Node code. |
| `src/plugin/features/<name>` | Feature-owned business code: entities, document recipes and actions. Features import only from [`src/plugin/features/api.ts`](src/plugin/features/api.ts) and other feature, application or domain contracts. Task, Project and Items are examples. |
| `src/plugin/bootstrap` | The only place that constructs and wires things: feature registry (`features.ts`), commands, event catalogs, authoring registries and the UI mount. |
| `src/plugin/infrastructure` | Concrete Obsidian, event and UI adapters. |
| `src/plugin/presentation` | `components/` (every `.vue` file, kept thin), `composables/` (behavior), `stores/` (per-view Pinia state) and `context/` (injection and types). |
| `src/plugin/styles`, `src/plugin/locales` | Scoped plugin CSS modules, and the `en`/`de` message catalogs. |
| `src/plugin/main.ts` | Lifecycle composition only, at most 100 code lines. |
| `bin/` | Generated standalone CLI artifact (`npm run build:cli`), including its authoring tools, templates and licenses. Copy the whole folder and run `node bin/app …`; compatible Node.js is required. |
| `src/cli/` | All CLI development source: compiler, domain, application, adapters and terminal presentation (the reusable terminal UI engine is `src/tui`, shared contracts and the companion schema are `src/shared`). `npm run app:dev -- <command>` runs source; rebuild `bin` to test the product. |
| `templates/` | Generator inputs (companion devkit and runtime, adoption, design folder, examples). |
| `configs/<concern>/` | `bundling`, `lint`, `quality` (thresholds, analyzer), `starters` (schema-6 JSON starters), `templates`, `testing`, `types`. |
| `tooling/` | Node tooling by concern: setup, bundling, quality, testing, makers, events, release and more. See [tooling/README.md](tooling/README.md). |
| `tests/` | Cross-project suites only (acceptance, journeys, verification, browser specimens). Each source project keeps its tests in `src/<project>/tests/` and tooling tests live in `tooling/tests/`. [`tests/suites.json`](tests/suites.json) assigns every test file to exactly one suite. |
| `src/plugin/harness/` | Browser harness and host-style fixtures. These never ship in the plugin. |
| `src/cli/sdk/` | Workbench plugin SDK and example extension (inside the `cli` project). |
| `src/companion/` | The browser companion application (`editor/`, `app/`). `npm run companion:build` writes `docs/concepts/companion/index.html`. |
| `docs/` | A design working directory. Repository link checks do not walk it. |

Architecture rules from [AGENTS.md](AGENTS.md):

- Domain and application code never depend on frameworks or concrete adapters.
- Bootstrap constructs. `main.ts` composes. Never detach leaves manually on unload.
- Application services own canonical data. Markdown is canonical for
  note-backed entities. Each view owns its drafts and subscriptions.
- The typed event bus is scoped to one runtime, with no global singleton.
  Publish a fact only after it has been persisted. Use direct calls for
  requests and results.
- Features never construct host UI classes. Use `services.modals` and
  `services.notices` instead.
- One `PluginDataStore` owns all plugin data. Never add a second `saveData` path.

## 4. Everyday workflows

### Run the CLI

- `node bin/app help` shows the golden path.
- `node bin/app help --all` lists every command.
- `node bin/app help <command>` (for example `help make` or `help framework pack`)
  explains one command.
- Add `--json` for one machine-readable result. Commands that change things
  preview first and apply only with `--yes` or `--apply <planHash>`.
- `npm run help` lists the npm scripts.

### Add a feature by hand

1. Create `src/plugin/features/<name>/` with `entity.ts` (fields and validation) and,
   if the feature is note-backed, `definition.ts` (its Markdown recipe).
2. Import helpers only from `src/plugin/features/api.ts`. For plugin-data entities,
   use `definePluginDataFeature`.
3. Add one registration entry in `src/plugin/bootstrap/features.ts`. Commands go in
   `src/plugin/bootstrap/commands.ts`. Do not edit `main.ts` or the generic services.
4. Put UI in `src/plugin/presentation/components`, and its behavior in a composable
   and a store.
5. Write tests that run the real services and assert exact Markdown and write
   counts.

Full recipe: [Build a feature](docs/development/BUILD-A-FEATURE.md). See also
[plugin-data entities](docs/development/PLUGIN-DATA-ENTITIES.md) and
[commands and ribbon](docs/development/COMMANDS-AND-RIBBON.md).

### Use makers

1. Discover the recipes with `node bin/app make list` and
   `node bin/app make describe <recipe>`. They include `feature`, `entity`,
   `view`, `component`, `store`, `usecase`, `command`, `modal`, `setting`,
   `event`, `listener`, `style`, `locale`, `maker`, `plugin`, `file-extension`
   and `context-menu`.
2. Preview a change, for example
   `npm run make -- feature bookmarks --entity bookmark --dry-run`.
3. Apply the same request with `--yes` (add `--no-interaction` in scripts). The
   maker writes the reviewed plan and runs its planned checks. Read the reported
   results; `npm run verify` is still a separate step.
4. Makers never overwrite edited files, and they have no force switch. An
   unknown recipe or option fails with an error code instead of guessing.
5. Custom recipes: `make maker <name>` creates a trusted local recipe in
   `tooling/makers/custom`. Running it requires `--trust-custom`, and only after
   you have reviewed its code.

Plugin recipes select the only plugin project automatically. If the manifest
contains several, add `--source <project-name>`; use `node bin/app source list`
to find its name. For example, `npm run make -- feature bookmarks --entity bookmark --source plugin --dry-run`
previews files in this checkout's `src/plugin/` project.

Details: [Authoring tools](docs/development/AUTHORING-TOOLS.md).

### Catalogs, presentation, styles and locales

| Topic | Commands and rules | Guide |
| --- | --- | --- |
| Events | `npm run events:catalog` and `npm run events:check` (duplicates, references, drift). | [Event bus](docs/architecture/EVENT-BUS.md) |
| Entities | `npm run entities:catalog` and `npm run entities:check`. | [Plugin-data entities](docs/development/PLUGIN-DATA-ENTITIES.md) |
| Vue | Component scripts contain only imports, props and bindings. Presentation TypeScript never imports `.vue` files. Enforced by `npm run check:presentation`. | [Presentation structure](docs/development/PRESENTATION-STRUCTURE.md) |
| Styles | Scoped selectors and Obsidian tokens. No Tailwind Preflight and no global reset. Never edit `dist/styles.css`. Checked by `npm run check:tokens` and `check:style-literals`. | [Styles](docs/architecture/STYLES.md) |
| Locales | Keys live in `src/plugin/locales/en.json` and `de.json`. `make locale <name>` creates a pending, non-selectable draft; check it with `make locale <name> --check`. | [Authoring tools](docs/development/AUTHORING-TOOLS.md) |

## 5. Testing and quality gates

| Command | Purpose | Needs |
| --- | --- | --- |
| `node bin/app check` | Daily gate: types, lint and tests. | Dependencies |
| `node bin/app check --fast` / `--plan` | Only the files you changed, or the list of gates the diff needs (runs nothing). | Git |
| `npm run verify` | Full static, service, coverage, artifact, baseline and harness checks. `-- --list` shows the steps. The report goes to `reports/verify/`. | Dependencies |
| `node tooling/testing/suites.mjs --list` | Every suite with its runner and prerequisites. Run one with `node tooling/testing/suites.mjs <suite>`. | Per suite |
| `npm run test:coverage` / `test:coverage:production` | Selected-core and whole-production coverage gates. Thresholds live in [configs/quality/thresholds.json](configs/quality/thresholds.json). | Dependencies |
| `npm run lint` | oxlint and ESLint. | Dependencies |
| `npm run check:analyzer` | The full fallow analyzer report. It must have zero findings. | `npm run build` first |
| `npm run check:maintainability` | Code-line limits: 400 for runtime, CSS and scripts; 450 for tests and helpers; 100 for `main.ts`. Comments and blank lines do not count. | Dependencies |
| `npm run harness:build && npm run test:e2e` | Served browser UI tests. | Chromium |
| `npm run test:obsidian` / `test:native` | Real Obsidian in a scratch vault. | Explicit download opt-in |
| `npm run check:docs-launchers` | Rejects references to retired CLI launchers in docs, skills, templates and source. | None |
| `npm run check:security` | Live audit of every dependency category. It fails honestly on registry errors. | Network |

A check that could not run is reported as "not run", never as passed. See
[test suites](docs/testing/TEST-SUITES.md),
[quality assurance](docs/development/QUALITY-ASSURANCE.md) and
[maintainability](docs/development/MAINTAINABILITY.md). Every new test file
must be listed in `tests/suites.json`.

## 6. Companion, generator, starters and the framework kit

- **Starters**: `node bin/app new --list` lists them. They live in
  `configs/starters/*.json` and support **Companion project schema 6 only**;
  older formats are rejected, not migrated. To create a project outside this
  checkout, run `node bin/app new ../my-project --starter blank --dry-run`, then
  repeat with `--yes`. See [Framework CLI](docs/development/FRAMEWORK-CLI.md)
  and [Companion starters](docs/development/COMPANION-STARTERS.md).
- **Generator**: `node bin/app generate …` turns project JSON into a project.
  Inspect the plan, then apply it with `--apply <planHash>`. See the
  [generator guide](docs/development/COMPANION-GENERATOR.md) and the
  [project schema](docs/development/COMPANION-PROJECT-SCHEMA.md).
- **Project configuration**: a project made from a project starter (`new --input`,
  `project-setup`) records its starter selection at `configs/<project-id>-config.json`.
  Commands read the single such file directly in `configs/`, or the one named by
  `--config`; the retired root `project.config.json` is never read. See
  [project configuration](src/cli/PROJECT-STARTERS.md#project-configuration).
- **Companion build**: `npm run companion:build`, then
  `npm run test:companion`.
- **Framework kit**: `node bin/app framework pack --out <zip> --yes` builds the
  developer-kit ZIP. Inside an extracted kit, `framework status` verifies its
  integrity and `framework upgrade --from <kit> --dry-run` plans a replacement.
  None of these publishes anything.

## 7. Contributing

1. Branch from `main`. Do not commit directly to `main`.
2. Keep each change focused. Preserve unrelated work, and name new tests and
   scripts by what they do, not by iteration.
3. Run `node bin/app check --plan --base origin/main`, the gates it lists,
   `npm run verify -- --json --keep-going` and `npm run check:self-review`.
4. Fill in the [pull request template](.github/pull_request_template.md) with
   real output. A gate you skipped is "not run" with a reason. AI agents use
   the [self-review skill](.claude/skills/self-review/SKILL.md).
5. CI ([ci.yml](.github/workflows/ci.yml)) runs the baseline, showcase,
   template journeys, framework CLI, real-Obsidian and starter jobs. The single
   required **CI result** job aggregates them. The security audit job is
   informational on pull requests. Reproduce a job locally with
   `node bin/app ci --list` and `node bin/app ci --job <workflow>/<job>`.

Never do any of the following:

- Loosen thresholds, analyzer ignore lists or lint rules.
- Add suppressions, unsafe casts, focused or skipped tests, or screenshot baselines.
- Install global packages from scripts.
- Use a personal vault for testing.
- Publish, tag or submit listings without explicit owner authorization.
- Hand-edit generated output.

## 8. Troubleshooting and known exceptions

- Setup and install problems: [setup troubleshooting](docs/development/SETUP-TROUBLESHOOTING.md)
  and the [CLI troubleshooting manual](docs/user-manual/shell-cli/troubleshooting.md).
  Never fix an install with `npm install`, `--force` or by deleting the lockfile.
- **Nested ESLint 9.39.5.** The official `eslint-plugin-obsidianmd` still pulls
  it in through its peers, while the root uses ESLint 10. This is an unresolved
  support exception. Read
  [the dependency exception](docs/development/ITERATION-TWO-DEPENDENCY-EXCEPTION.md)
  before proposing dependency updates.
- **Audit advisories.** `npm ci` may report moderate advisories that come
  through the locked `obsidian` API package (for example `moment`). Do not run
  `npm audit fix --force`; it would downgrade `obsidian`. The open `moment`
  advisory is recorded in
  [the moment advisory exception](docs/development/MOMENT-ADVISORY-EXCEPTION.md).
  Use `npm run check:security` for the current result.
