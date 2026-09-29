# Custom file extensions and file-menu actions

## Start a plugin

The ordinary Project Starters catalog includes two native integration starters.
They are data-only, hash-verified companion project JSON, not a second project format
and not executable templates downloaded from a marketplace.

| Starter | Native behavior | Remaining product work |
| --- | --- | --- |
| `custom-file-editor` | Own `.shellnote`; create a JSON document; open a dedicated `TextFileView` from the explorer or file menu; validate and explicitly save text. | Select your extension, implement domain validation/version migration and design a domain-specific editor. |
| `file-context-menu` | Filter `file-menu` to `.md`/`.txt`; expose the same action in the command palette; fresh-read and show line, Unicode code-point and UTF-8 byte counts in a modal. | Replace the read-only application handler with the required product behavior. |

```sh
node shell.mjs new --list
node shell.mjs new ../my-documents --starter custom-file-editor --id my-documents --name "My Documents" --yes
node shell.mjs new ../my-file-tools --starter file-context-menu --id my-file-tools --name "My File Tools" --yes
```

Without `--yes`, inspect the plan before applying it. Installation of npm dependencies,
installation into a vault, GitHub connection and publication remain separate explicit
operations. The shell's existing setup wizard and the companion starter gallery use
this same catalog. The companion preview explains the native workflow; it does not
pretend that a browser page has an Obsidian file explorer or vault write capability.

## Add an integration to an existing project

Use the normal maker command, including its JSON plan protocol, collision checks,
reviewed file planner, stale-input protection and idempotent replay:

```sh
# Inspect without writing.
node shell.mjs make file-type drawing --extension mydrawing --format json --title "Drawing" --json
node shell.mjs make context-menu inspect-drawing --extensions mydrawing --title "Inspect drawing" --json

# Apply the chosen recipe explicitly.
node shell.mjs make file-type drawing --extension mydrawing --format json --title "Drawing" --yes
node shell.mjs make context-menu inspect-drawing --extensions mydrawing --title "Inspect drawing" --yes
```

These makers do not require a `--feature`: they create host entry points, not note
repositories. `--format text` starts with empty plain text; `json` starts with a small
versioned JSON example. The suffix has no leading dot and is 1–24 lowercase ASCII
letters/digits, starting with a letter. Built-in suffixes such as `md`, `canvas`, `base`
and `pdf` cannot be claimed. Menu filters are explicit suffixes, not wildcards. The
runtime also matches uppercase filename suffixes. Filters do not grant an association
or change the operating system's default application.

| Maker output | Purpose |
| --- | --- |
| `src/domain/file-types/<id>.ts` | Typed, developer-owned file descriptor and optional pure validator. |
| `src/application/file-actions/<id>.ts` | Typed action delegating to a framework-free application use case. |
| `src/bootstrap/native-integrations.ts` | Explicit imports and composition arrays maintained through the existing AST-aware registry editor. |
| `tests/runtime/generated/native-<kind>-<id>.test.ts` | Contract/handler tests automatically included in the generated project's normal test configuration. |

Run `npm test`, `npm run typecheck:project` and `npm run build` in a generated project.
The maker also prints the existing framework verification commands. Never mark the
starter's four authored acceptance requirements complete just because scaffold tests
pass.

A repeated identical maker invocation is unchanged. An edited descriptor, unsupported
computed descriptor, duplicate ID/symbol, or duplicate association stops planning
instead of guessing or overwriting. Collision scans include the JSON-generated source
folder recorded in `design/project.json`, even when it is not `src/generated`. Scans
parse literal TypeScript declarations and never execute developer modules.

## Declare integrations in project JSON

The optional `design.nativeIntegrations` field extends the schema-v5 design. Existing
projects without it compile to empty native bindings. Import, validation, export,
blueprint transfer and undo snapshots preserve this field.

```json
{
  "fileTypes": [
    {
      "id": "drawing",
      "name": "Drawing",
      "extension": "mydrawing",
      "icon": "file-code",
      "format": "json",
      "defaultContent": "{\n  \"schemaVersion\": 1,\n  \"title\": \"Untitled\"\n}\n"
    }
  ],
  "contextMenus": [
    {
      "id": "inspect-drawing",
      "name": "Inspect drawing",
      "extensions": ["mydrawing"],
      "icon": "file-search"
    }
  ]
}
```

This is the value of `design.nativeIntegrations`, not a complete project document.
There are at most 16 file types and 16 menu actions. IDs are unique across both groups
and must produce distinct generated TypeScript symbols. Initial text is bounded to
64 KiB; invalid initial JSON, NUL, unknown properties and executable payload fields
are refused before generation. JSON format validation is syntax-only; a product must
supply its own schema, version compatibility and migration policy.

The compiler emits descriptors below `<codebaseFolder>/generated/domain/file-types/`,
actions below `<codebaseFolder>/generated/application/file-actions/`, and tests below
`<testsFolder>/project/native/`. Managed `bootstrap/native-bindings.ts` connects those
modules to the real plugin lifecycle. The maker-owned and JSON-generated registration
arrays are separate and are composed once at startup. No import is silently added to
an arbitrary plugin entry file: both the stock shell and generated project entry
already call the integration installer.

Descriptors, handlers and tests use the generator's existing extension-ownership
policy. An unedited descriptor may receive an authored JSON change; an edited one is
preserved when the generated template is unchanged, or reported as a conflict when
both changed. Managed bindings are never blindly overwritten over local edits.
Regeneration never deletes retired files. Follow the plan's `preserved` and `conflicts`
fields rather than assuming a JSON edit has replaced developer code.

## Runtime boundaries

`NativeFileType`, `NativeFileContext` and `NativeFileAction` are framework-free domain
contracts. `NativeFileDraft` and the example summary handler have no Obsidian imports.
The concrete `TextFileView`, vault calls, menus and notices live in
`src/infrastructure/obsidian/`. Bootstrap is the composition root. The native
infrastructure uses the public plugin registration APIs, not private view registries
or operating-system APIs.

The default editor gives each view its own text draft. Opening, parsing and rendering
never normalize or rewrite bytes. Save accepts valid text and delegates persistence
to the host's `TextFileView.save()`. Malformed JSON stays visible and copyable but
cannot replace the original. Incoming changes reported to `setViewData` while a draft
is dirty block saving until the user deliberately discards the draft and loads the
incoming version. An uncertain save is not automatically retried on close.

**Drafts are not autosaved or persisted separately. Closing discards unsaved edits.**
Save first or copy an invalid/conflicted draft. A failed write requires reopening and
verifying the file. This is a conservative starter, not a transactional editor or a
cross-process merge engine. A production editor should add reviewed draft recovery,
close confirmation and its domain-specific conflict-resolution experience. Edits made
by another process before the host reports them are not protected by a claimed
compare-and-swap protocol.

The default editor refuses to save text above 2,000,000 UTF-8 bytes. Native initial
loads still use the host's normal file loading; the starter does not claim a streaming
or bounded-memory binary viewer. Menu reads check file size before a fresh vault read
and verify decoded UTF-8 size afterward. The result handler receives only a bounded
read capability, filename and suffix—not a vault, host file object, path or implicit
write capability. Its counts use code points, not user-perceived grapheme clusters.

Create uses one vault `create` call, selects an unused name and never retries an
uncertain write. A successfully created file whose view cannot open gets a distinct
recovery notice. An already-started host write may finish after disable; late views,
modals and success messages are suppressed. Menu actions revalidate identity after
awaits; renamed/deleted/replaced files and unloaded scopes cannot show stale success.
Results are inserted as text, not HTML. Diagnostics contain fixed codes, never raw
exception messages, file contents or vault paths.

`registerView`, `registerExtensions`, commands and `registerEvent` are plugin-owned.
Scope disposal revokes callbacks and closes owned modals. It does not detach leaves.
Conflicting extension registration is reported, and that type gets no create command
or matching open-menu item. Other integrations can remain available.

## Verification and native acceptance

The focused suites cover portable contracts, maker safety, exact-byte drafts, save
failure/no-retry behavior, independent views, menu filtering, duplicate invocations,
rename/delete/unload during reads, conflict registration and cleanup. Independent
workspace tests generate both starters, exercise an additional maker, type-check,
execute the generated plugin entry against the explicit host double, build production
bundles and check regeneration preserves author edits. One fixture uses custom source
and test roots.

The shared test kit now provides a minimal `TextFileView` protocol and routes
`WorkspaceLeaf.openFile` through a registered suffix. This is not an implementation
of Obsidian's actual cross-window or filesystem synchronization. Before release, use
a disposable real vault to verify explorer double-click, create/palette/file-menu
entry, save/reopen, corrupt files, rename, external edits, two windows, disable/re-enable
and conflicting plugins. Binary files, mobile acceptance and OS associations are not
included. The generated manifest retains the shell's existing desktop-only setting.

API references: the project's pinned `obsidian` package declarations;
[official Obsidian API declarations](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts)
(`Plugin.registerView`, `Plugin.registerExtensions`, `Workspace.on('file-menu')`,
`TextFileView`); [Obsidian developer documentation](https://docs.obsidian.md/).
