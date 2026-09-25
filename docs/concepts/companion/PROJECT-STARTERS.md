# Project Starters

Project Starters is an offline, curated way to create an **independent full companion project** from ordinary project JSON. It builds on the existing one-vault/one-project workflow. It is not a remote marketplace, plugin installer, alternate generator or finished collection of native plugins.

## Use

Open **Project Starters** in navigation or **Choose a starter** on the empty welcome page. Search by use case and optionally filter by category. Preview a starter to see its actual surfaces, included scope, remaining implementation and synthetic-data boundary. Configure identity and the generated source/test folders, then choose **Review project**. Nothing replaces the current project until the confirmation checkbox and final action are used.

Start Blank supplies only a minimal runnable workspace entry, settings surface and design tokens. It contains no example entity, source recipe, product requirement or detailed product composition. The generator requires a navigable surface; an entirely empty sitemap is therefore not advertised as a runnable plugin.

After confirmation, use the existing PRD, sitemap, Page, Component, entity, source, test-data and Design System editors. The JSON is an independent copy, not a live link to the catalog. The built-in project stays unchanged.

Use **Generate plugin shell** on the project overview to review the real compiler handoff. Export the project JSON, run the plan from the extracted shell framework, then apply only its returned hash:

```sh
npm run companion:scaffold -- --input "my-plugin.companion.json" --vault "/absolute/path/to/vault" --target "plugins/my-plugin"
npm run companion:scaffold -- --input "my-plugin.companion.json" --vault "/absolute/path/to/vault" --target "plugins/my-plugin" --apply "PASTE_REVIEWED_HASH"
```

The equivalent human/agent entry point is `node shell.mjs generate` with the same arguments. Install dependencies explicitly in the generated target using the repository's pinned Node/npm versions, then run `npm run verify:project`. Output is `dist/main.js`, `dist/styles.css` and `dist/manifest.json`. Dependency installation, build, isolated-vault installation, enabling and publishing are distinct steps. The old `companion:generate` command remains a read-only JSON inspector; it is not the compiler.

The custom folders configure **generated product code and tests**, such as `plugin/src/generated` and `plugin/tests/project`. They do not relocate the shell's internal foundation. No handoff command is executed in the browser.

## Catalog

| ID | Starter | Scope |
| --- | --- | --- |
| `blank` | Start Blank | Minimal host entry and settings; no example domain |
| `command-utility` | Command Utility | Text utility and preview with local input reset |
| `quick-capture` | Quick Capture | Inbox, capture modal, record details and source contract |
| `tasks-projects` | Tasks & Projects | Task/project relationship and list/detail workspace |
| `knowledge-collection` | Knowledge Collection | Collection, record details, capture and categories |
| `daily-journal` | Daily Journal | Today, history and dated entries |
| `vault-dashboard` | Vault Dashboard | Overview, result list and read-only contract |
| `note-inspector` | Note Inspector | Metadata inspection/review; native active-note binding remains |
| `import-integration` | Import & Integration | Fixture-first preview/mapping/result; no live API or credentials |

Focused starters provide original PRD acceptance TODOs and detailed compositions with synthetic default/narrow/empty/error scenarios. Local input reset and declared navigation compile to UI behavior. Buttons labeled as implementation hooks do not pretend that data was saved. Source ports generate application/services/Pinia/adapter scaffolding; adapters fail explicitly until implemented. The import starter uses `https://example.invalid` and manual reads. No OAuth, parser, recurrence engine, indexing engine or right-sidebar host placement is implied.

## Files and contracts

`starters/catalog.json` has catalog schema 1 and bounded metadata: stable ID, version, category, difficulty, description, outcome, includes, remaining implementation, tags, local filename and SHA-256. Each `<id>.companion.json` is a complete ordinary **project-v4** document. There is no starter-specific project schema or executable payload.

The builder embeds these exact JSON files into the self-contained HTML, escaping `<` before insertion into a data-only script block. `scripts/companion/starter-contract.mjs` validates the same embedded catalog and customizes a deep copy. `starter-files.mjs` validates local file identity, integrity, regular-file status and inventory for tooling. The generator consumes the normal exported project document, not catalog metadata.

A provenance note records starter ID/version/source hash. It is informational Markdown and grants no execution authority. The source hash identifies the built-in template bytes, not the later customized project. Renaming plugin identity does not rewrite domain labels, entity slugs, internal IDs or design tokens.

Existing settings and all valid design content travel through normal JSON export/import. Runtime approvals, machine paths, generated-source receipts, preview session state and unsubmitted drafts do not.

## Replacement safety

Configuration is a private draft and carries a current-project/file snapshot. Submission validates the new project and rejects a changed current snapshot. The existing reviewed-import transaction rechecks identity, source bytes, browser storage, active operations and Project.md ownership before the confirmed replacement. It clears simulated runtime trust/results and retains unrelated host files. Failed durable persistence restores the old in-memory project.

An existing project is never merged with a starter implicitly. Export the current project before replacement. A download action is available, but the prototype cannot prove a backup was retained by the user. Editing the import textarea or choosing a different file invalidates the reviewed candidate and removes built-in provenance branding. The project notes still describe their literal authored content; branding is not a signature over arbitrary edited JSON.

These are browser safeguards. Native Markdown transactions and real multi-window/vault adapters remain part of companion conversion, not newly completed host functionality.

## Adding or updating a built-in

Create the full definition through the existing companion authoring model and export it. Keep the project small, original, bounded, offline and meaningful. Describe one differentiating use case; avoid multiplying label-only clones. Include realistic remaining work and designed acceptance rather than assertions of implementation.

Place the file under `starters/`, update its exact SHA-256 in `catalog.json`, and maintain a unique portable ID. Bump the starter's version when changing its template contract. Preserve meaningful internal references; never silently migrate an already created project.

The folder has an exact inventory. Unlisted files, missing files, duplicate sources, traversal and symlinks are rejected. No remote URLs can stand in for a source filename. Adding a runtime source or style also requires the existing exact assembly/analyzer entry. Do not exempt a new source from maintainability gates.

Run:

```sh
python3 scripts/concepts/build-companion.py
python3 scripts/concepts/export-companion-project.py
python3 -B tests/concepts/companion-assembly.test.py
node --test tests/tooling/project-starters.checks.mjs
python3 tests/concepts/companion-project-starters.browser.py
python3 scripts/concepts/run-browser-checks.py --real-storage
```

Use Node 24.21.0 and npm 11.19.1 for qualification. Local Node22 strip-types checks are supplementary, not substitutes for pinned-toolchain evidence.

The generator workflow has a per-starter matrix. `scripts/companion/qualify-starter.mjs <id>` creates a real independent generated target, installs locked dependencies with the explicitly selected npm, runs `verify:project`, records output hashes and removes its temporary workspace. `QUALIFIED_NPM` must name the qualified npm CLI. Per-starter `summary.json` and logs are retained as workflow artifacts. They qualify scaffolding only, not native business acceptance.

## Companion self-project

The companion describes its own catalog screen, navigation, creation/review intent and acceptance requirement through the same model. The current self-project adds Project Starters as a surface and Page design while preserving all existing Storymap, Page/Component and scoped Design System contracts. Load **Companion project → review → confirm** to replace an older saved self-project; saved projects are not auto-upgraded.

## Research and boundaries

See [PROJECT-STARTERS-RESEARCH.md](PROJECT-STARTERS-RESEARCH.md) for primary sources, selection rationale, deferred Bases/editor/AI/sync candidates and evidence limitations. See [the portable project contract](../../development/COMPANION-PROJECT-JSON.md) and [the generator contract](../../development/COMPANION-GENERATOR.md) for unchanged handoff safety.

Native conversion remains after shell qualification, and publication remains last. No starter selection installs a plugin, changes host settings, authorizes remote access, merges a PR or publishes a release.
