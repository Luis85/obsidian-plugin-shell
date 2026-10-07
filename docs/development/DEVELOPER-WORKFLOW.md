# Developer workflow

> Type: how-to · Part of the [docs index](../README.md)

**Current applicability:** Read the [capability matrix](../product/PRD.md#current-capabilities)
and [iteration 03 plan](../_archive/development/ITERATION-THREE-PLAN.md). The repository now has a real
Vue/Obsidian plugin, application services and pinned toolchain. Reviewed setup,
identity/resume, contained settings migration and note-feature/entity makers are
implemented. Broader maker recipes remain planned. Pull requests, CI tiers and
releases follow [Deliver a change](DELIVER-A-CHANGE.md) and
[Cut and publish a release](CUT-AND-PUBLISH-A-RELEASE.md).

## 1. What you can run now

Use the qualified Node 24.21.0/npm 11.19.1 and `npm run setup` to review identity and
the browser-first profile, `npm run dev:ui` for its real-component harness, and `npm run verify`
for the implemented gates. See [README](../../README.md) for current commands.
The separate historical style specimen is still available:

```sh
node tooling/harness/serve-style-fixture.mjs --port 4174
node --test tooling/tests/harness-styles/server.test.mjs
```

Inspect light/dark controls, settings, notices and a modal in the printed loopback URL. These are isolated appearance/interaction specimens; they create no notes and do not run Vue or native Obsidian. See [host-style documentation](../testing/HARNESS-STYLES.md) and the [review evidence](../_archive/reviews/2026-09-22-product-review.md).

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

Run targeted checks during changes and the full required checks before handoff:
`node bin/app check --fast` while iterating, then `node bin/app check`,
`npm run verify` and, for UI changes, `npm run test:e2e`; native smoke only when
explicitly provisioned. Which gates run in which pull-request state is described in
[Deliver a change](DELIVER-A-CHANGE.md); [Quality assurance](QUALITY-ASSURANCE.md)
documents `verify` and the self-review guard. Source/CSS/tooling ≤400 code lines,
tests/helpers ≤450, composition-only main.ts ≤100. Count code across complete SFCs;
exclude comments and blank lines. Name executable files for their behavior or
responsibility, such as `layout-and-header.spec.ts`.

Browser checks must observe caught Vue/application errors in addition to console/pageerror. Negative scenarios assert exact expected codes/counts and no extras. A rendered fallback is not enough to pass. Screenshots and static Markdown specimens do not prove persistence or native APIs.

Use the declared scenario/theme/locale/seed and owned readiness signals. Record source/build/style identity, actual commands, and missing environments. Never accept baselines or suppress errors just to complete a task.

To reproduce a failing CI job, `node bin/app ci --list` lists the workflows and
`node bin/app ci --job <workflow>/<job>` prints the job's exact commands (dry run);
dry runs, matrix selection, `--execute` and its refusals are documented in
[GitHub Actions workflows](WORKFLOWS.md#reproduce-a-job-locally).

## 7. Native work and release

The implemented `dev:local` path uses `.dev-vault` and staged matching JS/CSS/manifest
assets. Preserve `data.json`, notes, other plugins and security settings. Restricted
Mode is a deliberate human decision; setup never disables it. Native smoke requires
separate explicit provisioning and uses its isolated fixture, not a personal vault.

Real host/device checks remain separate from specimen and real-component harness evidence. Confirm native Notice/Modal behavior, pop-outs, created Task frontmatter, no-overwrite writes, and claimed mobile functionality using the exact candidate.

Releases are cut from `main` and published by owner-dispatched workflows; see
[Cut and publish a release](CUT-AND-PUBLISH-A-RELEASE.md). The
[maintenance/release guide](MAINTENANCE-AND-RELEASE.md) retains reviewed dependency
updates and the release contract. No dependency update auto-publishes; no native
acceptance based solely on fixture tests. First directory submission is separate.

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
`tooling/agent/session-start.mjs` (the same file serves generated projects), and the existing `Stop` hook
(`tooling/agent/stop-check.mjs`, which runs the fast check, `node bin/app check --fast`).

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
- **Browser:** reported through the single resolver, `src/cli/tooling/testing/browser-executable.mjs`. It never downloads a
  browser. In a cloud session an installed Chromium of another revision is exported as `SHELL_CHROMIUM` and
  labelled non-pinned; locally only the hint is printed.

Browser executable selection has one canonical override, `SHELL_CHROMIUM` (an absolute path to a Chromium
executable; Playwright config, browser scripts, the evidence browser producer and the Python concept checks all
read it). Without it the Chromium revision pinned by the installed Playwright
(`node_modules/playwright-core/browsers.json`) must exist in the Playwright cache (`PLAYWRIGHT_BROWSERS_PATH`).
An installed but different revision, such as the cloud image's `/opt/pw-browsers/chromium-1194`, is a
`revision-mismatch`: browser suites are reported `not-run` with the reason `browser-revision-mismatch` and the exact
opt-in, for example `SHELL_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. A mismatched Chromium is
never used silently and never reported as a pass. `node src/cli/tooling/testing/browser-executable.mjs [--json]` prints the
resolution (exit 0 only when a browser is usable). The earlier names `CHROMIUM_EXECUTABLE`, `CHROMIUM_PATH`,
`PLAYWRIGHT_EXECUTABLE_PATH` and the `--browser` option of the browser specimen check are removed.
