# Guided setup and maker tooling

> **Contract:** PRD 0.3 extension. These are required implementation behaviors, not executable functionality in the current documentation-only repository.  
> **Requirements:** TOOL-01–06, SETUP-01–12, MAKE-01–12.  
> **Related:** [PRD](../product/PRD.md), [event bus](../architecture/EVENT-BUS.md), [styles](../architecture/STYLES.md), [research](../research/2026-09-22-setup-makers-events-styles.md).

## 1. A genuine fresh-checkout entrypoint

The intended first command, after obtaining the template and opening its directory, is:

```sh
npm run setup
```

Node and npm must already be installed: an npm command cannot install the runtime needed to execute itself. A Git checkout is recommended, but a downloaded source directory without `.git` must still support browser setup; report Git-dependent release operations separately.

**SETUP-01 — No dependency bootstrap loop.** `package.json` maps setup to `node scripts/setup.mjs`. Everything imported before dependency installation must use Node built-ins or checked-in, dependency-free `.mjs` modules. No TypeScript runner, Vite, prompt package, or locally installed executable is required to start the wizard. `npm ci` is an internal setup step, not an undocumented prerequisite. The bootstrap/help path must also work without `node_modules`.

**SETUP-02 — Explicit installation, not a lifecycle trap.** Setup is invoked deliberately. Root `preinstall`, `install`, `postinstall`, `prepare`, `presetup`, and `postsetup` must not launch the wizard or cause recursive installs. Installing dependencies must not prompt for plugin identity, change a vault, start a watcher, or publish. The reviewed npm lifecycle-script policy must allow needed dependencies to work; neither blanket dangerous allow-all nor silently disabling every required native installation hook is an acceptable workaround. [S01–S03]

### Guided sequence

| Stage | What the developer sees | Required result |
| --- | --- | --- |
| 1. Preflight | Detected Node/npm, repository path, lockfile, permissions, existing setup/data. | Unsupported prerequisites identified before changes. |
| 2. Identity | ID, display name, description, author, repository, initial version. | Validated choices; derived defaults never silently retain the upstream identity. |
| 3. Development profile | Browser-first default; optional repository-contained Obsidian vault and CLI; test-browser provisioning. | A visible list of selected capabilities and downloads. |
| 4. Review | File edits, directories, dependency install, optional downloads, checks, and actions that will NOT occur. | One clear confirmation before writes or network installation. |
| 5. Apply identity | Manifest/package/root lock metadata, owned namespaces, links, documentation. | Dependency resolutions unchanged; safe reviewable edits. |
| 6. Install | Locked `npm ci` with understandable progress and retained failure details. | Supported complete dev dependencies; no fallback to unpinned `npm install`. |
| 7. Provision | Selected browser binaries and optional fixture-vault artifacts. | Explicit status for every selected capability; no automatic system elevation. |
| 8. Build and verify | Actual build plus the checks selected for the profile. | Results say what ran; skipped native/mobile tests are not passes. |
| 9. Handoff | Identity, resolved paths, completed/skipped/blocked steps, first `make` example, next command. | Setup terminates; it does not strand an agent in a dev server. |

**SETUP-03 — Identity safety.** Validate names, IDs, reserved words, path segments, and Windows collisions. Distinguish repository name from distributable plugin ID. Preserve license attribution and unrelated edits. Update package and lockfile root identity consistently without changing resolved package versions. Changing an already installed ID requires an explicit migration path, not ordinary first-run initialization.

**SETUP-04 — Profiles, not hidden bypasses.** The default browser profile installs locked dependencies, offers the declared browser-test download as part of the reviewed plan, builds, and runs normal verification when prerequisites are available. An Obsidian profile additionally prepares/installs into the approved development vault. A reduced/offline/custom selection must report the omitted checks and cannot claim full readiness. A selected required operation that fails produces a nonzero exit; deliberately unselected optional features are not failures.

**SETUP-05 — Installation boundaries.** Do not install Node, globally install packages, change PATH, edit shell profiles, run sudo, install Obsidian, alter Git remotes, sign into services, enable repository permissions, or publish. Explain missing host/system dependencies. Network-capable installation and package lifecycle hooks are disclosed before execution; credentials and registry tokens are never included in logs or exported reports.

**SETUP-06 — Repeat and resume.** Re-running setup detects existing identity and configuration, preserves user work, and offers validation, resume, or explicitly requested changes. A versioned local journal stores stage outcomes and input/lock/tool/platform fingerprints, not secrets. Resume revalidates those inputs; existence of an old marker alone is not proof that a stage remains valid. A missing/mismatched lockfile is an actionable failure, never permission to resolve a new graph silently. Reinstalling with `npm ci` may replace `node_modules`; show that fact before proceeding.

**SETUP-07 — Failure boundaries.** Use the shared safe-file plan engine for identity/config edits. On interruption or failure, report completed and incomplete stages. Files owned by the plan can be restored only if they have not since changed. Do not claim a multi-file filesystem transaction or an npm/network operation is globally atomic. Download caches and external side effects cannot necessarily be rolled back. A retry must never delete user data in an attempt to recreate a clean machine.

**SETUP-08 — Noninteractive mode.** Support validated flags or a data-only answer file, `--no-interaction`, `--yes`, `--dry-run`, and machine-readable output. `--yes` confirms a fully specified plan; it does not enable unrequested downloads, privilege changes, or publication. In a non-TTY session, missing required answers fail with a list rather than hanging for input. Unknown flags/answer keys fail. No executable hooks, template evaluation, or arbitrary command strings in answer files.

**SETUP-09 — Dry run.** Validate and display the plan with no file writes, dependency installation, network calls, browser launches, or report-file creation. This path works without dependencies. Reports go to stdout unless a real execution explicitly selected a report destination.

**SETUP-10 — Child processes.** Use arguments rather than concatenated shell strings. Prefer invoking the active npm CLI with the current Node executable using a validated launcher path; handle Windows `.cmd` behavior explicitly and test it. Preserve useful exit codes, observe errors, and terminate owned children on cancellation. Names containing spaces, Unicode, quotes, or shell metacharacters must not become code. [S02, S04]

**SETUP-11 — Environment checks.** Test Windows and Linux, paths with spaces/non-ASCII, no Git metadata, no network, missing browser system libraries, malformed package metadata, insufficient permissions, noninteractive input, cancellation, concurrent setup, and a second run after user edits. Never change personal-vault security preferences or disable Restricted Mode. Native host enabling remains a deliberate human step.

**SETUP-12 — Recorded readiness.** Distinguish configured, verified, skipped, blocked, and failed per capability. Record exact executed commands, exit codes, lock/tool fingerprints, and safe report paths. Freshness discovery may report newer versions but setup installs the template's qualified lockfile; upgrading the stack is a separate reviewed workflow.

### Intended unattended use

```sh
npm run --silent setup -- --id field-notes --name "Field notes" --author "Your name" --repo your-account/field-notes --profile browser --no-interaction --yes --json
```

`npm run --silent` keeps npm's script banner out of machine-readable stdout. The script uses stderr for human progress and stdout for the declared JSON result. It must not parse truth from a last line saying "done". No executable CLI is claimed by this example yet.

## 2. All executable tooling belongs in scripts/

**TOOL-01:** Keep script entrypoints, orchestration, reusable helpers, maker implementations, and boilerplate assets in `scripts/`. `package.json` contains short entry commands, not embedded programs. GitHub workflows invoke the same scripts instead of duplicating deployment/release logic in inline shell.

**TOOL-02:** Tool-discovered configuration may remain in conventional root files: Vite/Vitest/Playwright/ESLint configs, manifests, package files, and tsconfigs. Those files are declarative or thin adapters to `scripts/`; this requirement does not move plugin runtime code into tooling or fight a tool's supported config discovery.

```text
scripts/
  setup.mjs                    # thin dependency-free entrypoint
  make.mjs                     # thin maker entrypoint
  help.mjs
  setup/
    bootstrap/                 # built-ins only until npm ci finishes
    steps/
  make/
    registry.mjs
    makers/
    templates/                 # local versioned source templates
    custom/                    # explicitly registered developer makers
  shared/
    file-plan.mjs
    process-runner.mjs
    cli-output.mjs
  build/
    plugin.mjs
    styles.mjs
    vite-shared.mjs
  dev/
    install-local.mjs
  quality/
  release/
  maintenance/
tests/tooling/
```

This is the target layout, not a demand to create empty files. Runtime event contracts and CSS source modules stay under `src/`.

**TOOL-03:** Bootstrap helpers use `.mjs` plus JSDoc/checkJs under the tooling type-check project. No build step is required to run setup. Post-install tools may use the already qualified project tools, but must not introduce a second compiler merely for wrappers.

**TOOL-04:** Handwritten tooling code obeys the 400-line limit; tooling tests/helpers obey 450. Generated application code is developer-owned source and must obey the ordinary source limits; a generated header is not an exemption. Template input assets are also reviewed and bounded. A composed generated stylesheet has the specific output exemption in the style contract.

**TOOL-05:** Maintain real process-entry and fixture/template data accounting for fallow. Files opened as template text are not necessarily import-graph entrypoints. Record their known consumers; do not suppress the whole scripts tree or mark all source as dynamically loaded.

**TOOL-06:** A shared plan engine handles path validation, precondition hashes, review output, staged writes, cleanup, and safe retry for setup/makers. Keep it small: no general workflow platform or new plugin runtime dependency. Parallel invocations cannot race over the same identity or registration files.

## 3. Symfony-inspired make tooling

Symfony MakerBundle provides discoverable generators, command-specific help, and custom makers. This shell adopts that developer experience, not PHP classes or a runtime dependency on Symfony. [S05]

The canonical interface is:

```sh
npm run make
npm run make -- --list
npm run make -- feature tasks
npm run make -- command open-tasks --feature tasks
npm run make -- event tasks.item-created --feature tasks
npm run make -- listener refresh-tasks --event tasks.item-created
npm run make -- style item-card --feature tasks
```

An empty interactive invocation opens a chooser. Without a TTY it prints help/listing and exits rather than waiting. `npm run make -- feature --help` explains that maker's specific arguments. A literal global executable named `make`, a system Makefile, and shell aliases are not required. Optional `make:...` aliases must delegate to the same implementation.

**MAKE-01 — Built-in recipes.** The full v1 catalog covers the following; implement in useful slices, not as thirteen independent generator engines.

| Maker | Output and integration |
| --- | --- |
| `feature` | A minimal working feature slice, explicit composition registration, example view/action, locale keys, composed styles, fixture, and relevant tests. No hidden data model or invented business process. |
| `view` | Vue root plus native view factory and registration, view-owned state/disposal, style module, harness scenario, lifecycle test. |
| `component` | Typed Vue SFC, explicit owner/import, accessible initial markup, style ownership, component test. |
| `store` | View-scoped Pinia store and isolation/action tests; no automatic persistence plugin. |
| `usecase` | Feature-owned application contract/function and test, wired to a selected existing action or capability. Unimplemented behavior is explicit, not false success. |
| `command` | Native command descriptor, localized name, appropriate callback wrapper, explicit registration, availability/error test. |
| `modal` | Native modal adapter and typed form contract, labels/cancel/disposal behavior, owned styles, tests. |
| `setting` | Declarative native definition, allowlisted typed preference, defaults/validation, locale entries, compatible stored-data handling, tests. |
| `event` | Literal payload contract, runtime descriptor/validator where required, catalog entry, explicit event registration, positive/negative type tests. |
| `listener` | Typed subscriber for an existing event, injected application dependency, owner/disposal registration, behavior/error/unsubscribe tests. |
| `style` | A namespaced CSS source module attached to its selected component or ordered feature/native stylesheet entry; build/watch fixture. |
| `locale` | Complete catalog skeleton and validation; untranslated content marked pending and not advertised as a reviewed locale. |
| `maker` | A local custom-maker recipe, template fixture, explicit registry entry, plan/safety tests. |

Selecting an event/use case/owner that does not exist fails with a suggested prior command. Composite makers reuse the primitive recipes rather than duplicate their templates.

**MAKE-02 — Predictable generation.** Generate ordinary readable source, not a runtime interpreted feature schema. Outputs follow the same architecture, lint, LoC, localization, error, event, and CSS rules as handwritten code. Include the integration point and tests; do not stop at an unreferenced file that fallow immediately flags.

**MAKE-03 — Explicit wiring.** Use statically imported feature/command/view/subscriber descriptors in small composition registries. Register lifecycle ownership visibly. No source-folder scan at runtime, reflection container, prototype patch, or catch-all dynamic importer to make generated code appear reachable. A generator never inserts business logic into `main.ts`.

**MAKE-04 — Honest skeletons.** A scaffold can provide a working minimal reference behavior or a clearly unavailable/not-implemented action. It must never report success for functionality not implemented. Tests verify the scaffold's actual contract and identify feature acceptance work still required. Generated mocks or skipped tests do not count as completed business behavior.

**MAKE-05 — Plan before writing.** `--dry-run` shows files, registration edits, locale/style changes, collisions, and next checks. Validate names/paths and symbols before making changes. Detect case-insensitive collisions and Windows reserved file names. Reject traversal, absolute escape paths, unsafe symlinks, and unknown template/maker IDs.

**MAKE-06 — Preserve work.** Existing different content is a conflict, not permission to overwrite. Re-running an identical registered scaffold is a no-op; re-running after a developer modifies it reports the conflict. No blanket `--force` in v1. Registry edits use a structured parser or clearly bounded owned insertion points with precondition checks; missing/changed anchors fail safely instead of applying broad regex replacement.

**MAKE-07 — Recovery and concurrency.** Stage a complete file plan, check original hashes immediately before application, and roll back only owned unchanged writes on failure. Preserve user changes even if rollback cannot complete. Report any remaining staged/backup paths. Multi-file edits are not described as a filesystem-wide atomic transaction. Lock shared registry writes and detect concurrent makers.

**MAKE-08 — Extensibility.** Define a small typed/JSDoc maker contract: metadata and validated options, read-only context, and a function returning a declarative file/edit plan. Custom implementations/templates live in `scripts/make/custom/` and are explicitly registered. The runner owns prompts, I/O, formatting, application, reports, and checks. No remote template fetch, arbitrary hooks in JSON, or dependency installation during a normal maker run. Local maker code is trusted repository code, not a security sandbox.

**MAKE-09 — Agent mode.** Support `--no-interaction`, `--yes`, `--dry-run`, `--json`, and command-specific help. Output records maker/template version, affected paths, preconditions, written/skipped/conflicting files, and checks actually executed. Missing input fails predictably. `npm run --silent make -- ... --json` is the documented machine interface.

**MAKE-10 — Formatting and verification.** Use the repository formatter on generated/staged files only, then run appropriate targeted checks. A subsequent failed verification does not silently delete a developer's work; report the scaffold and failure. The isolated generator qualification suite must produce a clean complete `verify` result from supported starting states. No automatic snapshot acceptance or analyzer-suppression injection.

**MAKE-11 — Growth and removal.** Split large registries by feature before source limits are exceeded. Event catalog and style module registrations have explicit ownership and removal instructions. Generated source is owned by the developer after creation; templates/upgrades do not silently regenerate it over edits.

**MAKE-12 — Qualification.** Test every maker alone in its supported prerequisites, compatible composed sequences, different plugin IDs, custom makers, dry runs, reruns, malformed input, partial failure, and dirty worktrees. Build and browser-test a generated feature; prove that its command, event listener, and styles actually execute. Validate both Windows and Linux paths and installation-free help behavior.

## 4. Connection to events and styles

A generated `tasks.item-created` event is a typed fact published after a successful operation, not a command pretending that something happened. Its generated listener observes a narrow event surface and has a disposal owner. See [event bus semantics](../architecture/EVENT-BUS.md).

A generated CSS file must be included in the shared style graph immediately. For component-local SFC styles, integration follows the component import. For ordinary feature/native CSS, update the ordered CSS entry once. Never edit `dist/styles.css`; never create a second harness-only copy. See [style composition](../architecture/STYLES.md).

## 5. Implementation evidence

Setup qualification begins from a real copied/generated repository with no `node_modules`, not from the maintainer's already prepared workspace. Maker qualification uses that initialized repository. Tests also run with installation unavailable and with deliberately failing child tools so neither setup nor generation can fabricate success.

The complete delivery requires scripts and tests implementing this contract. This document alone does not provide those executable capabilities.
