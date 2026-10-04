> **Framework reference — not this project's backlog or instructions; follow ./AGENTS.md**

# Developer workflow

**Current applicability:** Read the capability matrix (maintainer-only asset, not included)
and iteration 03 plan (maintainer-only asset, not included). The repository now has a real
Vue/Obsidian plugin, application services and pinned toolchain. Reviewed setup,
identity/resume, contained settings migration and note-feature/entity makers are
implemented. Broader maker recipes and release automation remain planned.

## 1. What you can run now

Use the qualified Node 24.21.0/npm 11.19.1 and `npm run setup` to review identity and
the browser-first profile, `npm run dev:ui` for its real-component harness, and `npm run verify`
for the implemented gates. See [README](../README.md) for current commands.
The separate historical style specimen is still available:

```sh
node scripts/harness/serve-style-fixture.mjs --port 4174
node --test tests/harness-styles/server.test.mjs
```

Inspect light/dark controls, settings, notices and a modal in the printed loopback URL. These are isolated appearance/interaction specimens; they create no notes and do not run Vue or native Obsidian. See [host-style documentation](../testing/HARNESS-STYLES.md) and the review evidence (maintainer-only asset, not included).

## 2. First setup and generated note feature

After obtaining the template and installing the documented Node/npm prerequisites:

```sh
npm run setup
npm run make -- feature bookmarks --entity bookmark --dry-run
npm run make -- feature bookmarks --entity bookmark --yes --no-interaction
npm run dev:ui
```

Setup starts with checked-in Node-only code before node_modules exists, reviews identity/profile/downloads, installs the qualified lockfile, builds/checks the selected scope, and exits with next steps. No prerequisite npm ci, lifecycle-recursion trap, global install or silent machine configuration. CI/reinstall can explicitly use npm ci.

Review the dry-run plan before applying it. The feature recipe requires its entity
name; `entity --document` can then add another entity to that existing group.
Makers provide help, dry runs, integrated source/tests and noninteractive JSON.
They do not implement a complete business app, overwrite edited scaffolds, or
write user notes. [Authoring tools](AUTHORING-TOOLS.md) documents the executable
subset; the [setup/maker contract](SETUP-AND-MAKERS.md) retains the broader target.

## 3. Make a small real feature change

The first-change example remains an optional Task/item description. Add domain validation, extend the existing use-case input/output, update persistence decoding/migration deliberately, expose a labeled Vue field, add locale keys, edit owned CSS, and cover success/failure/reload in real tests. Most feature changes do not need main.ts changes or new infrastructure.

For note-backed entities, define fields/defaults/validation separately from document
destination/frontmatter/body. Use the registered repository and preview/commit
workflow rather than assembling YAML in a button callback.
[Executable feature recipe](BUILD-A-FEATURE.md)

```ts
// For an already-confirmed action; interactive forms normally prepare/commit.
const result = await services.repositories.task.create(
  { title: 'Prepare release checklist', due: '2026-09-30' },
  submissionId,
);
```

The caller then uses the shared feedback policy. It must not infer from a caught exception that nothing was written, or notify success independently from multiple event subscribers.

## 4. Show correct feedback

Use field-associated errors for validation and retain drafts. Use one updating progress state for an operation. Put essential write/recovery information in the owning view; optional notices are a secondary convenience, not the only place to recover.

A confirmed creation followed by failed opening is still created. Retry opening from the receipt. An uncertain create result requires reconciliation, not another ID/filename. Cancelling before a write is normal; closing a modal during a write does not necessarily cancel the host operation.

Use the composed [modal/notice services](MODALS-AND-NOTICES.md) and
[runtime feedback policy](RUNTIME-SERVICES.md). The retained
[error/notification contract](../architecture/ERRORS-AND-NOTIFICATIONS.md) describes
the full target. Do not duplicate native construction/catch patterns or serialize
raw exceptions into user text. [Logging/debugging](LOGGING-AND-DEBUGGING.md) supplies
bounded safe records independently of notification visibility.

## 5. Events and styles

Use the runtime-scoped typed bus for facts and owned subscribers. Late views load
current state; closing one view does not dispose the shared bus. Add explicit typed
contracts/subscriptions and publish committed facts only after persistence. Event
and listener makers remain part of the broader future catalog. User actions use
the [command/ribbon registry](COMMANDS-AND-RIBBON.md), not event-bus requests.
[Event semantics](../architecture/EVENT-BUS.md)

Author small ordered CSS modules and compiled Vue styles. The plugin outputs one
`dist/styles.css`; do not edit it. The integrated harness loads the verified
extracted host fixture before actual plugin CSS; that host stylesheet is never
installed with the plugin. The separate simulated stylesheet remains explicitly
labeled. [Style contract](../architecture/STYLES.md)

Native modal/settings roots need their own owned namespace/tokens. CSS does not implement focus trapping, notifications, or native actions.

## 6. Verification and evidence

Use the implemented `dev:ui`, `verify`, `test:e2e` and optional explicitly provisioned
`test:native` commands; broader maker/release workflows remain pending. Run targeted
checks during changes and full required checks before handoff. Source/CSS/tooling
≤400 code lines, tests/helpers ≤450, composition-only main.ts ≤100. Count code
across complete SFCs; exclude comments and blank lines. Name executable files for
their behavior or responsibility, such as `layout-and-header.spec.ts`.

Browser checks must observe caught Vue/application errors in addition to console/pageerror. Negative scenarios assert exact expected codes/counts and no extras. A rendered fallback is not enough to pass. Screenshots and static Markdown specimens do not prove persistence or native APIs.

Use the declared scenario/theme/locale/seed and owned readiness signals. Record source/build/style identity, actual commands, and missing environments. Never accept baselines or suppress errors just to complete a task.

### Reproduce a CI job locally

The workflows keep their explicit commands; `node bin/app ci` reads them so a failing job can be reproduced
without copying commands by hand. It parses `.github/workflows/*.yml` with the pinned `yaml` library (strict
YAML 1.2, no new dependency) and never contacts GitHub.

```text
node bin/app ci --list [--json]                       # workflows -> jobs: triggers, path filters, runner/matrix, reproducible?
node bin/app ci --job ci/baseline --matrix os=ubuntu-24.04        # dry run: the exact ordered shell commands
node bin/app ci --job ci/baseline --matrix os=ubuntu-24.04 --execute --json   # run the run: steps, stop at the first failure
```

- **Reference** a job as `<workflow-file-stem>/<job-id>` (`ci/baseline` is job `baseline` in `ci.yml`).
- **Dry run** (default) prints each step in order with its shell, `working-directory`, the job/workflow/step `env`
  and the `run:` text. `${{ matrix.* }}` and `${{ runner.os }}` are resolved (the runner is this machine); any other
  `${{ }}` expression stays verbatim and is flagged as unresolved. `if:` conditions are settled three-valued:
  a condition that is false here (`runner.os == 'Windows'` on Linux) is skipped, one that cannot be decided locally
  (`github.event_name`, `inputs.*`, `steps.*` outputs in a condition) is shown as unknown and not run.
- **Matrix:** without `--matrix` the first combination that targets this machine is used and the note says how many
  exist. `--matrix key=value,...` selects one combination by exact values (`group=1`); no match or more than one
  match is an error that lists the available combinations. A matrix computed by an expression (`fromJSON(...)`)
  needs the values from `--matrix`.
- **Reproducible** means every step is a `run:` step or a known setup action (`actions/checkout`,
  `actions/setup-node`, `actions/cache`, `actions/upload-artifact`: nothing to run locally). Any other `uses:` step is
  marked `external`, skipped and noted, and the job is listed as not reproducible.
- **`--execute`** runs the `run:` steps sequentially through bash (default `bash -e`, explicit `shell: bash` adds
  `pipefail`; `pwsh` only when installed), in the project root with the job's literal env, `CI=true`, a scratch
  `RUNNER_TEMP` and emulated `GITHUB_ENV`, `GITHUB_OUTPUT`, `GITHUB_PATH` and `GITHUB_STEP_SUMMARY` files, so
  later steps see exported variables and step outputs. It stops at the first failure and reports every step in the
  same versioned result shape as `check --json`: `status`, `durationMs`, `exitCode`, `code` and an `outputTail`
  of failing output; steps after a failure are `not-run`. `--timeout` applies per step (default 600000 ms).
- **Refused, with the reason printed** (`status: blocked`, `CI_EXECUTE_REFUSED`; nothing runs): `secrets.` or
  `github.token` references, publication or tagging commands (`npm publish`, `git push`, `git tag <name>`,
  `gh release|api`, `docker push`, guarded `release operate`/`--authorize`), jobs named release/publish/deploy or
  using an `environment`, container or service jobs, a runner OS other than this machine, unresolved expressions
  other than step outputs and `runner.temp`, and a missing shell. The dry run is always available and reports
  `executable` and `blockers`.

A dry run also notes steps that run `npm ci` or `npm install` in the project folder, because `--execute` would
replace this checkout's `node_modules`; the many jobs that start with such a step are best reproduced in a scratch
copy. A local run is a reproduction aid, not proof of CI: hosted-runner images, the `needs:` job results, uploaded
artifacts, `github.*` event data, caches and external actions are not reproduced, and many jobs install, download or
write under `reports/`. Jobs that need a Windows or macOS runner can only be inspected here.

## 7. Native work and release

The implemented `dev:local` path uses `.dev-vault` and staged matching JS/CSS/manifest
assets. Preserve `data.json`, notes, other plugins and security settings. Restricted
Mode is a deliberate human decision; setup never disables it. Native smoke requires
separate explicit provisioning and uses its isolated fixture, not a personal vault.

Real host/device checks remain separate from specimen and real-component harness evidence. Confirm native Notice/Modal behavior, pop-outs, created Task frontmatter, no-overwrite writes, and claimed mobile functionality using the exact candidate.

The maintenance/release guide (maintainer-only asset, not included) retains reviewed dependency updates and fixed-commit draft/promotion. No dependency update auto-publishes; no native acceptance based solely on fixture tests. First directory submission is separate.

## 8. Troubleshooting principles

| Symptom | Correct investigation |
| --- | --- |
| A command from a retained contract is missing | Check `npm run help` and the current authoring guides; broader future recipes are not executable aliases. |
| Setup later needs a missing package to start | Repair dependency-free bootstrap; do not add an undocumented preinstall requirement. |
| A service failed but no pageerror appeared | Inspect the independent captured-defect ledger. |
| Two notices appeared for one create | Fix operation/owner reporting, not broad notification suppression. |
| Note exists but UI reports failed create | Separate commit outcome from opening/listener/sink failure. |
| Missing native styling | Check real plugin CSS, host-root namespace, scope identifiers and installed hashes; do not hide it in the shim. |
| Generator conflicts or reports unused output | Preserve existing work and repair real registration; no blanket force/fallow ignore. |
| Host unavailable | Report not run; fixture screenshots cannot substitute. |

A handoff describes actual behavior, exact checks and limitations. Extensive generated code or a polished specimen is not a completed template.

## Cloud and agent sessions

Cloud containers (Claude Code on the web) usually ship a different Node/npm than the qualified
toolchain (`.nvmrc`, `package.json` engines and `packageManager`: Node 24.21.0, npm 11.19.1) and may start
without `node_modules`. The repository's `.claude/settings.json` therefore registers a `SessionStart` hook,
`scripts/agent/session-start.mjs` (the same file serves generated projects), and the existing `Stop` hook
(`scripts/agent/stop-check.mjs`, which runs the fast check, `node bin/app check --fast`).

The SessionStart hook prints at most ten lines of context and never fails the session (it always exits 0 and
reports problems as text). It is read-only and fast when everything is fine:

- **Toolchain report:** actual Node/npm versus the qualified ones, distinguishing "qualified", "satisfies engines
  but is not the qualified version" and "outside engines". If another qualified Node exists in a well-known place
  (`/opt/node<major>/bin`, nvm, n, Volta, `SHELL_NODE_BIN` or the Workbench cache), it is put first on `PATH` for the
  session through `CLAUDE_ENV_FILE`. In a cloud session without one, the exact `.nvmrc` Node is downloaded from
  nodejs.org, checked against the official SHA-256, cached under `${XDG_CACHE_HOME:-~/.cache}/workbench` with its
  pinned npm and used (`SHELL_SESSION_START_NODE=0` disables it); otherwise the report names the install command.
  Version drift is reported, never hidden. Details, switches and troubleshooting: [CLOUD-AND-LOCAL-SESSIONS.md](CLOUD-AND-LOCAL-SESSIONS.md).
- **Dependencies:** a missing `node_modules` is restored with `npm ci --ignore-scripts`, using the qualified Node
  when one was found. This only happens in cloud sessions (`CLAUDE_CODE_REMOTE=true`) or when
  `SHELL_SESSION_START_INSTALL=1`; `SHELL_SESSION_START_INSTALL=0` disables it everywhere. Local sessions are never
  changed unasked. Lifecycle scripts stay off and nothing is downloaded beyond the locked packages (and, in cloud
  sessions, the qualified Node itself).
- **Browser:** reported through the single resolver, `scripts/testing/browser-executable.mjs`. It never downloads a
  browser. In a cloud session an installed Chromium of another revision is exported as `SHELL_CHROMIUM` and
  labelled non-pinned; locally only the hint is printed.

Browser executable selection has one canonical override, `SHELL_CHROMIUM` (an absolute path to a Chromium
executable; Playwright config, browser scripts, the evidence browser producer and the Python concept checks all
read it). Without it the Chromium revision pinned by the installed Playwright
(`node_modules/playwright-core/browsers.json`) must exist in the Playwright cache (`PLAYWRIGHT_BROWSERS_PATH`).
An installed but different revision, such as the cloud image's `/opt/pw-browsers/chromium-1194`, is a
`revision-mismatch`: browser suites are reported `not-run` with the reason `browser-revision-mismatch` and the exact
opt-in, for example `SHELL_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. A mismatched Chromium is
never used silently and never reported as a pass. `node scripts/testing/browser-executable.mjs [--json]` prints the
resolution (exit 0 only when a browser is usable). The earlier names `CHROMIUM_EXECUTABLE`, `CHROMIUM_PATH`,
`PLAYWRIGHT_EXECUTABLE_PATH` and the `--browser` option of the browser specimen check are removed.
