# Companion project JSON → shell

**Contract v1. Status: read-only handoff, not a boilerplate compiler.**

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
| `schemaVersion` | Exactly `1`; unsupported versions fail closed |
| `executable` | Exactly `false`; an export is data, never an execution approval |
| `project` | `id`, `name`, `author`, `version`, `description` |
| `settings` | `codebaseFolder` and `testsFolder`, both required in v1 exports |
| `design` | Schema-1 saved authoring definition: blueprint, goals, platform, screens, containment/navigation, components and their content/versions/variants, PRDs and requirement mappings, entities/relationships, source operations and shapes, test recipes, design system, and visual arrangement |
| `notes` | Saved project note strings |

The supplied [companion project](../concepts/companion/companion-project.json) is a complete example, not an abbreviated schema snippet. `scripts/companion/project-contract.mjs` is the shared executable envelope/path contract: imported directly by Node and embedded from those same source bytes into the offline HTML. Browser import additionally uses the existing detailed design validators; the read-only script is **not** evidence that an arbitrary nested design is ready for compilation.

UI folder settings default to `src` and `tests`. They are project-owned and exported with the definition; imported exports must declare both. Existing browser projects without the new settings continue to use those defaults without a storage-key/schema migration.

For `--target plugins/companion` and folders `app/src` / `app/tests`, future destinations are:

```text
<vault>/plugins/companion/app/src/
<vault>/plugins/companion/app/tests/
```

In v1, these are validated future paths, not created directories. Changing the companion settings does not move source files, change the current shell's build configuration, rename an existing test vault, or retrofit the legacy illustrative scaffold previews. Only a later reviewed compiler will consume these settings to write boilerplate.

## Validation and safety boundary

The input is limited to 4,000,000 UTF-8 bytes; invalid UTF-8/JSON, wrong-kind exports, future versions, duplicate primary collection IDs, unsupported envelope keys, excessive nesting/allocation and prototype-related object keys are rejected. The concept's stricter nested validators additionally reject malformed authoring models. Valid but incomplete designs remain drafts and can carry advisory or blocking review findings.

Portable target/folder paths reject absolute paths, parent/dot traversal, empty segments, backslashes, control characters, protected host/dependency directories, Windows reserved names and trailing dots/spaces. Codebase and tests must be separate, non-overlapping directories, including under case-insensitive comparison. The current v1 portable path alphabet is ASCII letters/digits, spaces, `_`, `-` and `.` within normal segments; Unicode project **content** is supported, but arbitrary Unicode folder names are not yet part of this contract.

Existing target ancestors and future source/test ancestors are inspected for links and non-directories. A nonexistent suffix is accepted but never created. The explicit vault root is resolved to its canonical directory. Input must be a regular file, not a final-component symlink; reads use a bounded buffer and verify the opened file identity. This is a read-only boundary, **not an atomic filesystem transaction or complete defense against all external concurrent changes**. A future writer must perform its own fresh containment, conflict, ownership, approval and rollback checks.

No code or URLs in the JSON are evaluated, imported as executable modules, fetched or launched. Nevertheless, authored descriptions, URLs, source declarations and notes can contain private information: an export is not automatically sanitized. Do not use the output as a trust grant or attach private exports to public issues without review.

## Browser round trip

Use **Load companion project**, or author another project, then **Export project JSON**. Import is available on the welcome screen, overview and in Preferences. Choose a file (recommended for large pretty-printed exports) or paste JSON, review its identity/counts/folders, and explicitly confirm replacement. Export the current project before replacing it when it needs to be kept.

One vault still owns one project. Import does not append a second project or merge identities. It resets execution trust, approvals, preparation, generated-file ownership, simulation sessions and quality/run receipts. Local host files remain unchanged; the simulated owned Project.md is replaced only while still unchanged and owned. Existing generated files are not deleted or assumed to belong to the imported project. Source preparation remains additive and must review any collisions.

Unsubmitted form drafts, browser theme/preferences, machine-specific root/test-vault paths, command history, generated source snapshots and execution receipts are deliberately **not portable authoring fields**. Raw recovery exports and older blueprint-only exports are different formats and are not accepted by this importer. Full-project JSON is not a raw backup of every transient browser state field.

Import and folder changes refuse observed stale storage, modified owned Project.md, or active operations. A failed save rolls back the in-memory replacement. These controls complement the existing recovery exports and do not claim atomic cross-window locking.

## Ownership and verification

- `scripts/companion/project-contract.mjs`: shared transport/path validation, no I/O.
- `scripts/companion/read-project.mjs`: bounded file read and contained target inspection; returns `{content, document, vault, target}` without writing.
- `scripts/companion/generate.mjs`: CLI arguments and stdout/stderr contract, **read-only v1**.
- `docs/concepts/companion/src/project-transfer.js`: reviewed import/export and folder settings.
- `docs/concepts/companion/src/companion-project.js`: declarative self-project seed, not an implemented native plugin.

```sh
node --test tests/tooling/companion-project.checks.mjs
python -B scripts/concepts/build-companion.py --check
python -B tests/concepts/companion-assembly.test.py
CHROMIUM_EXECUTABLE=/path/to/chromium python -B scripts/concepts/run-browser-checks.py --real-storage
```

The browser suite downloads an actual project export and passes those bytes to the real CLI in a temporary vault, verifies full semantic round trips, checks replacement failures and renders the seed's editors. The separate storage suite tests actual two-window storage and reload when loopback navigation is permitted. The golden JSON must match the executable seed's export. Exact-artifact results and environment limits belong in the current verification receipt rather than this contract.

## Next implementation boundary

The next writer increment must define a reviewed deterministic plan from this envelope, resolve target-relative codebase/tests paths, compile schema/domain/component contracts, preserve foreign and edited files, invalidate stale approvals and prove generated source through the shell's normal qualification. The complete native companion remains downstream of shell readiness. The current entrypoint must not be relabeled as full generation until those writes and their safety/evidence contracts actually exist.

## Planned framework-first successor — 2026-09-24

The [CLI/generator implementation plan](FRAMEWORK-CLI-GENERATOR-PLAN.md) introduces a separate project-root setup/import/compiler workflow from a downloaded framework archive. SH-015/SH-024 extract shared TypeScript semantic validation; SH-027 reconciles imported identity/folder settings; SH-028 generates through the same makers as the CLI; SH-033 proves the companion adapter contract.

This does **not** change v1 above: the existing script remains dependency-free, read-only and exact-byte on stdout, with the documented vault-relative target. A future full writer must not silently inherit execution approval or relabel these tests as generation evidence. Source/test paths remain portable design fields; the new development project root is selected locally, not imported as an absolute vault path.

## Implementation workspace generation

The v1 reader documented above remains unchanged. The shell now also provides `node shell.mjs generate` / `npm run companion:scaffold` for explicit plan-and-apply compilation. See [Companion generator](COMPANION-GENERATOR.md) for output, TDD, ownership and qualification boundaries.

The generator from PR #20 is the existing implementation baseline for [SH-035](../tasks/shell/SH-035.md) and SH-028, not a replacement for the read-only v1 handoff. Its current vault-relative, separate-target workflow and runtime TypeScript launch are documented in the generator guide. The broader extracted-project, bundled-CLI workflow above remains planned. Preserve and extend the current compiler rather than implement a competing one.
