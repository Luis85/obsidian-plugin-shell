# Guided setup and maker tooling

> **Contract:** PRD 0.4; required future behavior, not executable tooling in the current repository.  
> **Requirements:** TOOL-01–06, SETUP-01–12, MAKE-01–12, extended by DOC-19 for entities.  
> **Related:** [PRD](../product/PRD.md), [entity documents](ENTITY-DOCUMENTS.md), [DocumentCreationService](../architecture/DOCUMENT-CREATION.md), [events](../architecture/EVENT-BUS.md), [styles](../architecture/STYLES.md), [research](../research/2026-09-22-setup-makers-events-styles.md).

## 1. Fresh-checkout setup

After obtaining the template and opening its directory, the intended first command is:

```sh
npm run setup
```

Node/npm must already exist; an npm command cannot install its own required runtime first. A source download without .git can still use browser setup, while Git-dependent release operations report that prerequisite separately.

**SETUP-01:** Map setup to `node scripts/setup.mjs`. Its bootstrap imports only Node built-ins or checked-in dependency-free .mjs files until installation succeeds. No local TS runner, Vite, prompt package, or node_modules is needed to start/help/dry-run. Locked npm ci is an internal stage, not a hidden prerequisite.

**SETUP-02:** The wizard is explicitly invoked, never recursively launched by root preinstall/install/postinstall/prepare/presetup/postsetup. Dependency installation must not ask for identity, mutate a vault, launch watchers, or publish. Review the qualified dependency lifecycle-script policy; neither unexamined unrestricted hooks nor blanket disabling needed native hooks is a sound workaround. [S01–S03]

| Stage | Visible choices/result |
| --- | --- |
| Preflight | Node/npm, project/lockfile, permissions, existing identity/setup state. |
| Identity | ID/name/description/author/repository/version with validation and safe defaults. |
| Profile | Browser-first, test downloads, optional contained native vault/CLI; no implicit personal-vault choice. |
| Review | Exact file changes, install/download steps, checks, and explicit exclusions before confirmation. |
| Apply | Controlled identity/root lock metadata/namespaces/docs edits, no dependency re-resolution. |
| Install | Locked npm ci with progress, exit status, useful failure record. |
| Provision | Selected browser/native fixture prerequisites; no automatic system elevation. |
| Build/check | Real selected checks with separate skipped/native/mobile statuses. |
| Handoff | Paths/identity/readiness, completed/skipped/blocked stages, next make/dev command; process exits. |

**SETUP-03:** Validate IDs/names/reserved paths/Windows collisions. Preserve attribution and unrelated edits. Update package/lock root identity without changing resolved dependency versions. Renaming an installed plugin is a separate migration, not routine initialization.

**SETUP-04:** Default browser profile installs locked dependencies and runs declared provisioning/build/verification after plan consent. Native profile also prepares the approved test vault. Reduced/offline/custom selections disclose omitted checks. Selected required failures return nonzero; deliberately unselected options do not fabricate failure or full readiness.

**SETUP-05:** No Node/global package/PATH/shell profile edits, sudo, Obsidian installation, remote rewriting, sign-in, repository permission changes, or publication. Explain system prerequisites and installation/network hooks before execution. Never log registry tokens/credentials. Neither registration of Task nor make entity seeds user notes; only explicit runtime actions or selected isolated native fixtures create them.

**SETUP-06:** Repeated setup validates/resumes or explicitly changes configuration while preserving user work. A versioned local journal stores stage outcomes and input/lock/tool/platform fingerprints, not secrets. Revalidate on resume; a marker alone is insufficient. Missing/mismatched lockfile fails rather than silently running unpinned npm install. Explain that npm ci can replace node_modules before reinstalling.

**SETUP-07:** Share a safe-file-plan engine. Track completed/incomplete stages and restore only owned files whose preconditions still match. Do not describe multi-file edits, npm installs, or caches as a globally atomic transaction. Failed retries never delete unrelated user data to manufacture a clean environment.

**SETUP-08:** Validated flags/data-only answers support --no-interaction, --yes, --dry-run, and JSON. Yes confirms the specified plan, not new permissions/downloads. Missing required non-TTY answers and unknown flags/keys fail instead of hanging. No executable hooks/expressions/command strings in answer files.

**SETUP-09:** Dry run validates/displays without writes, downloads, network, browser launches, or report-file creation, and works without dependencies. Use stdout for the plan; file reports require actual selected execution.

**SETUP-10:** Argument arrays, not concatenated shell expressions. Use a validated current-Node/active-npm launcher and test Windows cmd behavior. Observe exits/errors/cancellation, terminate owned children, and handle spaces/Unicode/quotes/metacharacters as data. [S02, S04]

**SETUP-11:** Test Windows/Linux, non-ASCII paths, missing Git/network/browser system libraries, malformed metadata, permissions, non-TTY, cancellation/concurrency, and rerun after edits. Never modify personal-vault security or automatically disable Restricted Mode.

**SETUP-12:** Per-capability configured/verified/skipped/blocked/failed, actual commands/exit/tool/lock fingerprints and sanitized reports. Freshness may report newer dependencies, but setup installs the qualified lockfile; upgrading is separate.

The intended unattended shape is:

```sh
npm run --silent setup -- --id field-notes --name "Field notes" --author "Your name" --repo your-account/field-notes --profile browser --no-interaction --yes --json
```

npm's silent mode avoids script banners in JSON stdout. Human progress uses stderr; machine success is a structured result with actual statuses, not a string saying done.

## 2. Dedicated scripts directory

**TOOL-01:** Entrypoints, orchestration, helpers, maker code/templates live in scripts. Short package commands and Actions call the same implementation instead of embedding duplicated shell programs.

**TOOL-02:** Conventional root Vite/Vitest/Playwright/ESLint/TS/package/manifest configs may remain declarative or thin adapters. Runtime code and entity definitions are not moved into tooling merely to satisfy folder conventions.

```text
scripts/
  setup.mjs
  make.mjs
  help.mjs
  setup/
    bootstrap/                 # Node built-ins/checked-in helpers only
    steps/
  make/
    registry.mjs
    makers/                    # includes entity.mjs
    templates/                 # local versioned source templates
    custom/
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
  quality/                     # includes entity/catalog checks
  release/
  maintenance/
tests/tooling/
```

Create exercised files, not empty decoration. Runtime event/document contracts and CSS source remain in src.

**TOOL-03:** Bootstrap .mjs uses JSDoc/checkJs and no compilation prerequisite. Post-install tools use the already qualified toolchain, not a second compiler for wrappers.

**TOOL-04:** Handwritten tooling ≤400 physical lines, tooling tests/helpers ≤450. Generated plugin/entity code becomes ordinary maintained source, not an exemption. Template assets are bounded/reviewed; composed stylesheet output has its separately documented artifact policy.

**TOOL-05:** Model genuine process entries and known template/fixture consumers in fallow. Template text files are not necessarily import entrypoints. No entire scripts exemption or all-source dynamic entry declaration.

**TOOL-06:** A small shared plan engine owns path validation, original hashes, review, staging/writes/cleanup/retry. No general workflow platform or new runtime dependency. Concurrent setup/makers cannot race through shared identity/registry files unnoticed.

## 3. Symfony-inspired make

Adopt MakerBundle's discoverable commands, specific help, and custom recipes, not PHP dependencies. [S05]

```sh
npm run make
npm run make -- --list
npm run make -- feature tasks
npm run make -- entity task --feature tasks --document
npm run make -- command open-tasks --feature tasks
npm run make -- event tasks.item-created --feature tasks
npm run make -- listener refresh-tasks --event tasks.item-created
npm run make -- style item-card --feature tasks
```

Examples illustrate recipes; do not blindly recreate a name already generated by a composite maker. Empty interactive invocation opens a chooser; non-TTY prints help/list rather than hanging. Per-maker --help explains required existing owners/options. No global GNU Make, PHP, or shell aliases. Optional make: aliases delegate to the same runner.

**MAKE-01 — Catalog.** Deliver these recipes through one composable engine:

| Maker | Required output/integration |
| --- | --- |
| feature | Minimal real slice, explicit composition, view/action, locales/styles/fixture/tests; no invented finished business product. |
| view | Vue root/native factory/registration, owned state/disposal, styles/scenario/lifecycle test. |
| component | Typed SFC, actual owner/import, accessible markup/style ownership/component test. |
| store | Per-view Pinia plus isolation/action tests, no automatic persistence. |
| usecase | Feature-owned contract/function/test tied to an existing selected action/capability; honest unfinished behavior. |
| entity | Definition/validation/types and registry. With --document, document projection/template, creation integration, renderer/service/type tests and Markdown fixture; Task preset. No actual user-note write. |
| command | Localized stable native descriptor, correct callback/error/availability behavior and registration/test. |
| modal | Typed native form/cancel/focus/disposal contract, owned styles and tests. |
| setting | Declarative definition, allowlisted preference/default/validation/locales/stored-data handling/tests. |
| event | Literal payload/descriptor/needed validation, catalog and positive/negative type tests. |
| listener | Subscriber to existing typed event, injected dependency, explicit lifetime and error/unsubscribe tests. |
| style | Namespaced module and ordered feature/native import or SFC owner, build/watch evidence. |
| locale | Complete checked skeleton, pending translation metadata, not falsely reviewed selectable language. |
| maker | Local custom recipe/template/registry/plan-safety tests. |

Missing owners/events/entities fail with an actionable prerequisite. Composite makers reuse primitive recipes. The documents.created event is a shared service fact; an entity maker does not automatically create a duplicate Task-specific publication pipeline. See DOC-19.

**MAKE-02:** Readable ordinary source follows architecture/LoC/lint/localization/errors/events/styles/entity contracts. Include integration and relevant tests, not just an orphan export that fallow reports dead.

**MAKE-03:** Statically imported descriptors in small registries, explicit lifetimes. No runtime source scans/reflection/prototype patch/catch-all importer; no business logic in main.ts.

**MAKE-04:** Supply real minimal behavior or an explicit unavailable/not-implemented outcome, never false success. Tests prove that stated scaffold behavior and identify remaining feature acceptance. Generated schema plus mock write is not a proven DocumentCreationService.

**MAKE-05:** Dry run shows files/registration/locales/styles/entity changes/conflicts/next checks. Validate symbols/names/paths, Windows reserved names, case collisions, traversal/absolute escapes/symlinks/unknown IDs before writes.

**MAKE-06:** Existing different content conflicts. Identical registered rerun is a no-op; edited scaffolds are preserved with a useful conflict. No blanket force. Registry edits use structured parsing or narrowly owned verified insertion points, not broad regex replacements or silent unknown-anchor fallback.

**MAKE-07:** Stage complete plans, recheck hashes, restore only owned unchanged writes. Preserve concurrent edits, report incomplete rollback/staged files, lock shared registrations. Multi-file operations are not filesystem-wide atomic transactions.

**MAKE-08:** Small typed/JSDoc custom-maker contract: metadata/options, read-only context, declarative file/edit plan. Explicit local custom registry; runner owns prompts/I/O/format/report/checks. No remote templates, arbitrary JSON hooks, or dependency installation during a maker run. Trusted local maker code is not sandboxed.

**MAKE-09:** --no-interaction/--yes/--dry-run/--json and specific help. Report maker/template version, paths/preconditions/written/skipped/conflicts and checks actually run. Missing input fails; npm run --silent keeps machine output clean.

**MAKE-10:** Format only staged/generated files using the existing formatter, then targeted checks. Failed verification does not silently delete the developer's work. Isolated supported-start generator tests must pass complete verification. Never inject broad suppressions or accept snapshots automatically.

**MAKE-11:** Split growing registries coherently before size limits. Catalog/style/entity ownership and removal are explicit. Generated source belongs to the developer; template upgrades do not overwrite it.

**MAKE-12:** Test each recipe/prerequisite and compatible sequence, different identities, custom makers, dry-run/rerun/input/failure/dirty-tree/cross-platform behavior. Build/browser-test a generated slice, its command/event/styles, and a generated entity through real validation/serialization into the fake writer. Native write claims require separate host evidence.

## 4. Connecting the generated parts

A fact such as tasks.item-created is published after its actual successful operation. Listeners are narrow and owned. Do not make an application request by pretending a host event occurred. [Event contract](../architecture/EVENT-BUS.md)

A style file must join the real CSS/SFC graph. Update ordered imports once, never dist/styles.css or a second harness copy. [Style contract](../architecture/STYLES.md)

An entity definition validates values; its separate document definition maps allowed frontmatter/body/destination. The shared DocumentCreationService handles preparation/create/results. The generated Task recipe does not build YAML by hand, overwrite existing notes, create notes at startup, or duplicate its canonical data in data.json. [Document contract](../architecture/DOCUMENT-CREATION.md)

`entities:check` validates registered schemas/defaults/projections/property-name type consistency; `entities:catalog` derives documentation. Implement both under scripts/quality and compose them into normal verification. Domain entities without document mappings remain allowed.

## 5. Qualification boundary

Setup tests begin from copied/generated repositories without node_modules. Maker tests run in those initialized repositories and also exercise missing-install/failing-tool cases. Template qualification checks actual generated code and Markdown, not pre-existing maintained demo files alone.

This document specifies required future capabilities. Executable scripts, definitions, native adapters, and passing tests must be delivered before setup/makers are advertised as working.
