# Companion project JSON → shell

**Transfer format v3, with v1/v2 import compatibility. `companion:generate` remains read-only; `companion:scaffold` is the separate workspace compiler.**

The companion exports a complete **saved authoring definition**. The shell accepts that definition and a target inside an explicitly chosen vault. The first script version validates the transfer envelope and paths, then returns the original JSON bytes. It does not generate, install, activate, run tests, acquire a template or create a target directory.

## Invocation

From a shell checkout:

```sh
npm run --silent companion:generate -- \
  --input "/path/to/plugin-companion.companion.json" \
  --vault "/path/to/my-vault" \
  --target "plugins/companion"
```

The equivalent direct invocation does not require dependency installation:

```sh
node scripts/companion/generate.mjs \
  --input docs/concepts/companion/companion-project.json \
  --vault "/path/to/my-vault" \
  --target "."
```

`--input` is a regular UTF-8 JSON file. A relative input resolves against the current working directory, not the script or vault directory. `--vault` selects an existing directory and defaults to the current working directory. `--target` is mandatory: use `.` for the vault root or a portable **vault-relative** path. Absolute target paths are rejected; express them as `--vault` plus `--target`. Spaces require normal shell quoting. This stage accepts a directory as a vault root without requiring native Obsidian configuration.

Success writes **only the original input bytes to stdout**, including their whitespace. The script does not rewrite the JSON, prefix it with a summary or print resolved machine paths. `--silent` suppresses npm's own script header. Errors produce a diagnostic on stderr and exit code 1, with no stdout. `--help` prints usage and exits 0.

Redirection is a shell operation, not a write by this script. Never redirect output onto the input file or an existing vault file: the shell can truncate it before the command starts.

## Versioned transfer envelope

| Field | Contract |
| --- | --- |
| `kind` | Exactly `obsidian-companion-project` |
| `schemaVersion` | Exports use `3`; reader also accepts legacy `1` without storymaps/details and `2` without details; unsupported versions fail closed |
| `executable` | Exactly `false`; an export is data, never an execution approval |
| `project` | `id`, `name`, `author`, `version`, `description` |
| `settings` | `codebaseFolder` and `testsFolder`, both required in supported exports |
| `design` | Schema-2 saved authoring definition (legacy schema 1 is accepted with transfer v1): blueprint, goals, platform, screens, containment/navigation, components and their content/versions/variants, PRDs and requirement mappings, entities/relationships, source operations and shapes, test recipes, design system, visual arrangement, and storymaps with release assignments and artifact links |
| `notes` | Saved project note strings |

The supplied [companion project](../concepts/companion/companion-project.json) is a complete example, not an abbreviated schema snippet. `scripts/companion/project-contract.mjs` is the shared executable envelope/path contract: imported directly by Node and embedded from those same source bytes into the offline HTML. Browser import additionally uses the existing detailed design validators; the read-only script is **not** evidence that an arbitrary nested design is ready for compilation.

### Storymaps compatibility

A v2 document requires `design.schema: 2`. A v1 document requires `design.schema: 1` and cannot contain a `storymaps` property. Existing projects without maps are treated as having an empty collection; browser export upgrades to v2. The exact shared Storymaps record validator is `scripts/companion/storymap-contract.mjs`, embedded in the concept and imported by the Node boundary. Invalid internal structure, duplicate IDs, unsupported fields and excessive collections fail before import. External PRD/sitemap/requirement references can be explicitly unresolved and are preserved with last-known labels.

Ordering and assignments are portable; transient Vue Flow state is not. The older blueprint/compiler preview excludes storymaps and remains a distinct format. The transfer version change does not authorize writes, produce boilerplate or move configured folders. See [Storymaps](../concepts/companion/STORYMAPS.md) for canonical fields and bounded limits.

UI folder settings default to `src` and `tests`. They are project-owned and exported with the definition; imported exports must declare both. Existing browser projects without the new settings continue to use those defaults without a storage-key/schema migration.

For `--target plugins/companion` and folders `app/src` / `app/tests`, future destinations are:

```text
<vault>/plugins/companion/app/src/
<vault>/plugins/companion/app/tests/
```

In this read-only stage, these are validated future paths, not created directories. Changing the companion settings does not move source files, change the current shell's build configuration, rename an existing test vault, or retrofit the legacy illustrative scaffold previews. Only a later reviewed compiler will consume these settings to write boilerplate.

## Validation and safety boundary

The input is limited to 4,000,000 UTF-8 bytes; invalid UTF-8/JSON, wrong-kind exports, future versions, duplicate primary collection IDs, unsupported envelope keys, excessive nesting/allocation and prototype-related object keys are rejected. The concept's stricter nested validators additionally reject malformed authoring models. Valid but incomplete designs remain drafts and can carry advisory or blocking review findings.

Portable target/folder paths reject absolute paths, parent/dot traversal, empty segments, backslashes, control characters, protected host/dependency directories, Windows reserved names and trailing dots/spaces. Codebase and tests must be separate, non-overlapping directories, including under case-insensitive comparison. The current portable path alphabet is ASCII letters/digits, spaces, `_`, `-` and `.` within normal segments; Unicode project **content** is supported, but arbitrary Unicode folder names are not yet part of this contract.

Existing target ancestors and future source/test ancestors are inspected for links and non-directories. A nonexistent suffix is accepted but never created. The explicit vault root is resolved to its canonical directory. Input must be a regular file, not a final-component symlink; reads use a bounded buffer and verify the opened file identity. This is a read-only boundary, **not an atomic filesystem transaction or complete defense against all external concurrent changes**. A future writer must perform its own fresh containment, conflict, ownership, approval and rollback checks.

No code or URLs in the JSON are evaluated, imported as executable modules, fetched or launched. Nevertheless, authored descriptions, URLs, source declarations and notes can contain private information: an export is not automatically sanitized. Do not use the output as a trust grant or attach private exports to public issues without review.

## Browser round trip

Use **Load companion project**, or author another project, then **Export project JSON**. Import is available on the welcome screen, overview and in Preferences. Choose a file (recommended for large pretty-printed exports) or paste JSON, review its identity/counts/folders, and explicitly confirm replacement. Export the current project before replacing it when it needs to be kept.

One vault still owns one project. Import does not append a second project or merge identities. It resets execution trust, approvals, preparation, generated-file ownership, simulation sessions and quality/run receipts. Local host files remain unchanged; the simulated owned Project.md is replaced only while still unchanged and owned. Existing generated files are not deleted or assumed to belong to the imported project. Source preparation remains additive and must review any collisions.

Unsubmitted form drafts, browser theme/preferences, machine-specific root/test-vault paths, command history, generated source snapshots and execution receipts are deliberately **not portable authoring fields**. Raw recovery exports and older blueprint-only exports are different formats and are not accepted by this importer. Full-project JSON is not a raw backup of every transient browser state field.

Import and folder changes refuse observed stale storage, modified owned Project.md, or active operations. A failed save rolls back the in-memory replacement. These controls complement the existing recovery exports and do not claim atomic cross-window locking.

## Ownership and verification

- `scripts/companion/storymap-contract.mjs`: shared bounded Storymaps records and reference validation, no I/O.
- `scripts/companion/project-contract.mjs`: shared transport/path validation, no I/O.
- `scripts/companion/read-project.mjs`: bounded file read and contained target inspection; returns `{content, document, vault, target}` without writing.
- `scripts/companion/generate.mjs`: CLI arguments and stdout/stderr contract, **read-only v1**.
- `docs/concepts/companion/src/project-transfer.js`: reviewed import/export and folder settings.
- `docs/concepts/companion/src/companion-project.js`: declarative self-project seed, not an implemented native plugin.

```sh
node --test tests/tooling/companion-project.checks.mjs tests/tooling/companion-storymaps.checks.mjs
python -B scripts/concepts/build-companion.py --check
python -B tests/concepts/companion-assembly.test.py
CHROMIUM_EXECUTABLE=/path/to/chromium python -B scripts/concepts/run-browser-checks.py --real-storage
```

The browser suite downloads an actual project export and passes those bytes to the real CLI in a temporary vault, verifies full semantic round trips, checks replacement failures and renders the seed's editors. The separate storage suite tests actual two-window storage and reload when loopback navigation is permitted. The golden JSON must match the executable seed's export. Exact-artifact results and environment limits belong in the current verification receipt rather than this contract.

## Next implementation boundary

The next writer increment must define a reviewed deterministic plan from this envelope, resolve target-relative codebase/tests paths, compile schema/domain/component contracts, preserve foreign and edited files, invalidate stale approvals and prove generated source through the shell's normal qualification. The complete native companion remains downstream of shell readiness. The current entrypoint must not be relabeled as full generation until those writes and their safety/evidence contracts actually exist.

## Implementation workspace generation

The read-only handoff command above remains separate from workspace generation. The shell now also provides `node shell.mjs generate` / `npm run companion:scaffold` for explicit plan-and-apply compilation. See [Companion generator](COMPANION-GENERATOR.md) for output, TDD, ownership and qualification boundaries.

## Page and component detail designs (v3)

`design.detailDesigns` is validated by the shared `detail-contract.mjs` before browser import or CLI handoff. Stable owner references connect page documents to sitemap surfaces and component documents to library definitions. Ordered nodes retain containment, content, local instance props, bindings, visible states and canvas geometry; edges retain interaction and acceptance declarations. The model never evaluates those declarations. V1/v2 envelopes containing this subsystem fail before mutation. See [Detail editors](../concepts/companion/DETAIL-EDITORS.md) for the exact limits and native conversion boundary. The separate compiler preserves details in project and traceability JSON and emits an explicit unimplemented-runtime warning.

## Design-system frontend extension

Optional `design.designSystem.frontend` schema 1 declares `target: "nuxt-ui"`, `colorPolicy: "host" | "declared"` and finite role-to-token `bindings`. Both import paths validate the complete typed design system. The reviewed scaffold compiler lowers it into styles; the read-only handoff still returns the original bytes. See [the complete contract](DESIGN-SYSTEM-STYLES.md).
