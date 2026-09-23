# Developer workflow

**Current applicability:** Read the [capability matrix](../product/PRD.md#current-capabilities)
and [iteration 03 plan](ITERATION-THREE-PLAN.md). The repository now has a real
Vue/Obsidian plugin, application services and pinned toolchain. Reviewed setup,
identity/resume, contained settings migration and note-feature/entity makers are
implemented. Broader maker recipes and release automation remain planned.

## 1. What you can run now

Use the qualified Node 24.21.0/npm 11.19.1 and `npm run setup` to review identity and
the browser-first profile, `npm run dev:ui` for its real-component harness, and `npm run verify`
for the implemented gates. See [README](../../README.md) for current commands.
The separate historical style specimen is still available:

```sh
node scripts/harness/serve-style-fixture.mjs --port 4174
node --test tests/harness-styles/server.test.mjs
```

Inspect light/dark controls, settings, notices and a modal in the printed loopback URL. These are isolated appearance/interaction specimens; they create no notes and do not run Vue or native Obsidian. See [host-style documentation](../testing/HARNESS-STYLES.md) and the [review evidence](../reviews/2026-09-22-product-review.md).

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

## 7. Native work and release

The implemented `dev:local` path uses `.dev-vault` and staged matching JS/CSS/manifest
assets. Preserve `data.json`, notes, other plugins and security settings. Restricted
Mode is a deliberate human decision; setup never disables it. Native smoke requires
separate explicit provisioning and uses its isolated fixture, not a personal vault.

Real host/device checks remain separate from specimen and real-component harness evidence. Confirm native Notice/Modal behavior, pop-outs, created Task frontmatter, no-overwrite writes, and claimed mobile functionality using the exact candidate.

The [maintenance/release guide](MAINTENANCE-AND-RELEASE.md) retains reviewed dependency updates and fixed-commit draft/promotion. No dependency update auto-publishes; no native acceptance based solely on fixture tests. First directory submission is separate.

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
