# Developer workflow

> **Status:** Target experience for PRD 0.3. The repository currently contains specifications, not working npm commands or a plugin. The examples below define the implementation contract.

Use this as the short path through the [PRD](../product/PRD.md). Detailed contracts are in [setup/makers](SETUP-AND-MAKERS.md), [events](../architecture/EVENT-BUS.md), [styles](../architecture/STYLES.md), and [maintenance/release](MAINTENANCE-AND-RELEASE.md).

## 1. Get the template and run setup

Install the supported Node/npm prerequisites, obtain the template through GitHub, and open its directory. Git is useful for development/release, but a source download without .git must still support browser setup.

The first project command is:

```sh
npm run setup
```

No separate dependency installation comes first. The checked-in Node-only bootstrap reviews identity, development profile, downloads, and file changes before it runs the locked dependency install. It then provisions selected test tools/local-vault artifacts, builds, verifies the selected scope, and prints the next action. It exits rather than starting an indefinite watcher.

The wizard collects plugin ID/name/description/author/repository/version, validates them, and offers browser-first or optional native development setup. It never installs Node itself, globally changes your machine, silently disables Restricted Mode, or publishes a release.

The implemented compatibility record identifies exact supported tools and latest public Obsidian. Setup installs that qualified lockfile; it does not silently upgrade the stack during installation. CI and deliberate reinstalls can still use `npm ci` directly.

### Review, dry run, and agents

```sh
npm run setup -- --dry-run
npm run --silent setup -- --id field-notes --name "Field notes" --author "Your name" --repo your-account/field-notes --profile browser --no-interaction --yes --json
```

Dry run makes no filesystem/network changes and works before dependencies are installed. Noninteractive execution requires complete valid inputs; it does not wait for missing answers. A second run validates/resumes rather than overwriting an initialized project.

The repository name and distributable plugin ID differ. Do not keep the upstream identity or blindly use `obsidian-plugin-shell` as the plugin ID. The setup contract includes current submission constraints and preserves license attribution.

## 2. Generate and inspect the first feature

```sh
npm run make
npm run make -- --list
npm run make -- feature tasks
npm run dev:ui
```

`make` provides a chooser/help and command-specific options. A generated feature is ordinary source wired into the existing architecture, with a minimal real view/action, localization/style ownership, a harness fixture, and tests. It is not a new runtime framework and it does not invent the finished behavior of your product.

The generator previews its plan and refuses collisions. Existing files edited by the developer are not overwritten. A successful scaffold means the stated template behavior exists; it does not mean an unfinished business use case has been implemented.

More recipes are available, with names selected to avoid whatever the composite feature already created:

```sh
npm run make -- command open-tasks --feature tasks
npm run make -- modal edit-task --feature tasks
npm run make -- event tasks.item-archived --feature tasks
npm run make -- listener refresh-task-list --event tasks.item-archived
npm run make -- style item-card --feature tasks
```

Use per-maker `--help` for required existing owners/actions/payload details. These are illustrative recipes, not a promise that each should be run blindly after a composite maker. The full catalog also covers views, components, stores, use cases, settings, locales, and custom makers.

For machine-readable planning:

```sh
npm run --silent make -- feature tasks --dry-run --no-interaction --json
```

Scripts and generator templates live in `scripts/`, but generated plugin code lives under `src/` and tests under `tests/`. A global executable called make, GNU Make, PHP, and Symfony are not prerequisites.

## 3. Understand one change without learning all infrastructure

The retained manual recipe is to add an optional description to an example item. Empty text is allowed, oversized text produces a localized error, saved text survives reload, and it is displayed as text rather than HTML.

| Area | Change |
| --- | --- |
| Domain | Add the value/validation rule without framework imports. |
| Application | Extend the existing use-case input/output; reuse its repository and outcome policy. |
| Persistence | Decode old data safely and migrate/default the new field; do not create a second writer. |
| Vue/Pinia | Add a labeled field using the existing application interface. |
| Localization | Add matching keys/parameters, not scattered literals. |
| Styles | Edit the owned module/SFC and keep it within 400 lines. |
| Events | Publish the existing appropriate committed fact after a successful write; change its payload only deliberately. |
| Tests/harness | Validate input, old data, successful reload, failed writes, two-view refresh, and the actual field interaction. |

Most changes do not need to touch `main.ts`. New native registrations belong in small composition registries; pure functions do not need a new interface/bus/event solely to appear architectural.

## 4. Events in ordinary development

The plugin has one typed bus per runtime. Application services publish completed facts after successful writes. Views subscribe through narrow injected interfaces and query canonical state for their initial snapshot. Closing a view disposes its subscriptions, not the shared bus.

`make event` adds the contract/catalog/type tests; `make listener` adds a typed owned subscriber and its tests. A subscriber sees the correct payload type and must not import native `TFile`, `App`, or WorkspaceLeaf into application code.

Native file/workspace/metadata changes enter through the supported Obsidian bridge. Startup create replay is not treated as new user activity. A bus publication does not perform the corresponding vault action; requests requiring a result call a service directly.

The bus begins delivery synchronously but does not await async listeners. Exceptions/rejections are captured without rolling back a committed save. Owners must guard/cancel in-flight work when their view closes. See the [full semantics](../architecture/EVENT-BUS.md) before relying on ordering or lifecycle behavior.

## 5. Styles in ordinary development

Author CSS in small modules under `src/styles/`, with explicit ordered entries, or as component-owned scoped styles. Do not edit the generated stylesheet.

```text
ordered CSS imports + compiled styles from imported Vue components
                              ↓
                        dist/styles.css
```

`make style` connects its file to the selected owner/import graph. `make feature`, `make view`, and `make modal` reuse the same style recipe. The native build and harness share the processing rules; artifact-fidelity tests load the exact candidate CSS with matching component identifiers.

```sh
npm run styles:build
npm run styles:check
```

These commands use the shared pipeline and include SFC CSS; they are not a separate raw concatenator. Keep all handwritten CSS files and full SFCs within 400 physical lines. Generated composed output can be longer but retains its bundle-size and artifact checks.

Use plugin-scoped classes and Obsidian variables. Native modal/settings roots need their own namespace/tokens; a selector scoped only below a view will not automatically reach a modal elsewhere. Avoid global resets and duplicate harness-only plugin styles.

## 6. Main workflows

| Command | Purpose |
| --- | --- |
| `setup` | Guided fresh install/configuration/verification and safe resume. |
| `make -- <kind>` | Integrated boilerplate with an explicit reviewable plan. |
| `dev:ui` | Real-component browser HMR without Obsidian. |
| `dev:local` | Successful matching JS/CSS/manifest builds installed into the approved development vault. |
| `verify` | Complete ordinary checks after explicit provisioning. |
| `release:prepare -- --version X.Y.Z` | Metadata/changelog preparation, not publication. |
| `help` / `doctor` | Discover commands and diagnose prerequisites safely. |

Use targeted tests and `verify:fast` during a change, then `verify` before handoff. It must not download tools silently or become a watcher. `test:setup` is the focused provisioning operation reused by setup.

Native-sensitive changes additionally need `test:obsidian` or the documented manual procedure. Browser, fake-host, native, and device evidence remain separate.

## 7. Native development

The default location is `.dev-vault/.obsidian/plugins/<plugin-id>/` inside the repository. Open `.dev-vault` in Obsidian. Enable Community plugins deliberately when required; the script does not disable Restricted Mode for you.

`dev:local` preserves data.json, unrelated plugins, notes, and configuration. A failed JS or CSS build leaves the last good matching asset set intact. An explicit repository-root-vault mode is available through validated configuration, never inferred silently from an existing .obsidian directory.

Optional official CLI reload/screenshots must validate the exact fixture vault and capabilities. Missing CLI falls back to manual steps; it is not required for browser work and must not target an arbitrary personal vault. [Baseline research R08](../research/2026-09-22-template-research.md)

## 8. Harness and troubleshooting

A reproducible scenario can be selected with a documented URL such as:

```text
/?scenario=storage-failure&locale=de&theme=dark&seed=42
```

Cover normal and failure paths, two views, event disposal, and composed styles—not only one successful screenshot. The runner owns its server, validates readiness, and records current source/asset hashes. Golden baseline changes require review.

| Problem | Safe diagnostic/recovery |
| --- | --- |
| Setup fails before install | Check Node/npm, checked-in bootstrap, lockfile, identity plan, permissions; no unpinned install fallback. |
| Install/download interrupted | Resume only valid recorded stages, preserve files, explain unmet prerequisites. |
| Missing answers in an agent session | Fail with missing keys; do not hang for input. |
| Generator collision | Show affected file/registration; no blanket force overwrite. |
| Generated file is unused | Repair its real registration, not a broad fallow suppression. |
| Events appear duplicated | Inspect runtime/bridge/view ownership and startup registration; no global emitter workaround. |
| Event listener rejects | Inspect bounded safe diagnostics and cancellation; do not mark a committed save failed. |
| CSS missing in native view/modal | Check source ownership, compiled scope/class mapping, native root namespace, and installed CSS hash. |
| Style change not visible | Check graph/watch ownership and last-good build status; do not add a second runtime stylesheet. |
| Browser/host missing | Explain test:setup/native prerequisites and report not run, not pass. |
| Port occupied | Reject unrelated process or use explicit alternate port. |
| Release permissions absent | Explain least required permission, not an unrestricted personal token. |

## 9. Removing the example and releasing

Use the tested removal recipe for example code, registrations, events/descriptors, style imports, tests/fixtures, and locales. Keep reusable host/bus/persistence/localization/error/testing infrastructure. Verify the resulting graph and generate the first real product slice with make.

Handoffs name actual behavior, exact commands/results, current artifacts, migration/compatibility impact, and untested scope. Generated code volume is not acceptance evidence.

The [maintenance/release guide](MAINTENANCE-AND-RELEASE.md) covers reviewed dependency updates, fixed-commit candidates, native acceptance, and explicit publication of the same JS/CSS/manifest. First directory approval is separate from GitHub release creation.
