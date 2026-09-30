# Native file extensions and file context menus

## Choose a starter

`custom-file-view` creates a plugin for a dedicated text/JSON file format. Its default is `.folio`. The generated plugin registers a `TextFileView`, a **Create Folio document** command, folder **Create** actions, and matching-file **Open** actions. Files open through the normal Obsidian file explorer. The starter editor is a raw-text baseline with validation, not a finished domain-specific visual editor.

`context-menu` adds **Inspect file details** to matching files. Its default filter is `.md`. The generated handler receives an immutable-shaped plain file snapshot and returns a title/message. The host adapter renders that result as literal text in a native dialog; it does not modify the file or replace Markdown's view.

```sh
node bin/app new --list
node bin/app new ../folio-tools --starter custom-file-view --extension folio --yes
node bin/app new ../file-tools --starter context-menu --extensions md,txt --yes
```

Without `--yes`, inspect the dry-run/review first. Interactive `new` asks for the native suffix or filters when omitted. The companion starter dialog offers the same choices. The full project JSON retains declarations through export/import, blueprint transfer, replacement, undo and redo. Its browser preview does not claim to register an Obsidian file type.

## Add capabilities to an existing plugin

Create a feature owner once, then add one or both recipes:

```sh
node bin/app make feature documents --yes
node bin/app make file-extension board --feature documents --extension board --format json --dry-run
node bin/app make file-extension board --feature documents --extension board --format json --yes
node bin/app make context-menu inspect --feature documents --extensions md,board --yes
```

Use `--format text` for plain text with an empty initial file. JSON starts with a valid versioned object. Edit `src/features/documents/board.file-extension.ts` or `inspect.context-menu.ts` to define your format, domain validation, and behavior. Matching generated unit tests live in `tests/runtime/generated`. Makers update the explicit arrays in `src/bootstrap/native-integrations.ts`; they do not patch `main.ts` or register arbitrary strings as executable code.

Makers reuse the existing file planner and AST-aware registration editor. Duplicate IDs/extensions fail before writes. Source declarations read during planning are pinned to the reviewed file hashes; a concurrent edit invalidates apply. Replaying an identical recipe is a no-op. Edited source is not overwritten. Dynamic registry expressions require manual review rather than executing project code during planning. A generated project also checks its project-native registry for conflicts with new maker declarations.

## Portable JSON contract

The optional `design.nativeIntegrations` namespace is additive to companion project schema v5; it has its own `schemaVersion: 1`:

```json
{
  "schemaVersion": 1,
  "fileTypes": [
    {
      "id": "board-document",
      "name": "Board document",
      "extension": "board",
      "format": "json",
      "initialContent": "{\"schemaVersion\":1,\"title\":\"Untitled\",\"cards\":[]}\n"
    }
  ],
  "contextMenus": [
    { "id": "inspect-board", "name": "Inspect board", "extensions": ["board"] }
  ]
}
```

Declarations contain data, never handler source or installation scripts. File suffixes are lowercase/dotless, start with a letter and contain at most 16 letters/digits. Core Obsidian formats cannot be registered. Menu filters may include existing formats such as `md`. IDs are unique across both arrays. The contract limits one project to 12 file types and 24 menu actions, with 16 filters per action and 65,536 characters of initial content. JSON defaults must parse successfully. Unknown fields and namespace versions fail closed.

Project compilation uses the same declaration templates as makers. The managed registry is `<codebaseFolder>/generated/bootstrap/native-integrations.ts`. Editable pure definitions/handlers are under `<codebaseFolder>/generated/domain/native`; generated tests use `<testsFolder>/project/native`. `NATIVE-INTEGRATIONS.md` is generated with the actual suffixes, filters and customization locations. Regeneration preserves developer edits when generated intent is unchanged; conflicting JSON and code changes require review, not silent replacement.

## Architecture and lifecycle

`src/domain/native-integrations.ts` defines host-independent file/menu contracts and validation. Domain callbacks receive `{path, name, extension}`, never `App`, `Vault`, `TFile`, or a DOM element. For business writes, introduce application ports and explicit confirmation rather than adding Obsidian IO to the domain handler.

`src/infrastructure/obsidian/native-integrations.ts` binds plugin-owned views, commands and `file-menu` events. `custom-file-view.ts` uses public `TextFileView` methods: `getViewData`, `setViewData`, `clear`, `requestSave` and `save`. View identity is captured outside subclass fields because the host can call virtual methods in the base constructor. The adapter preserves exact text, whitespace and malformed JSON rather than parsing and reserializing the user's buffer. Validation is advisory; invalid JSON can be saved as text for recovery.

`create-custom-file.ts` asks for a single basename, rejects traversal/hidden/reserved filenames, and calls `vault.create` only after confirmation. It never calls `modify` to create a file. Duplicate creation leaves the existing file untouched. A successful write followed by an open failure is reported as **created**, with no automatic second write. Closing a pending dialog or unloading the integration suppresses a late view opening, but cannot cancel a create already committed by the host.

Disposal removes owned event callbacks and commands, closes owned dialogs, disables the editor and suppresses late async results. It does not detach workspace leaves. The buffer remains available for the host's final save. Host cleanup owns extension/view registration removal. Another plugin's associations are never unregistered to resolve a conflict. Save errors remain rejected and visible so callers do not mistake failure for success; copy the recoverable buffer before closing a failing view.

## Verification and limits

```sh
node node_modules/vitest/vitest.mjs run tests/runtime/native-file-domain.test.ts tests/runtime/native-file-integration.test.ts
node --test tests/tooling/native-integrations.checks.mjs
python3 tests/concepts/companion-project-starters.browser.py
```

Use the repository's qualified Node/npm versions. The browser test requires Python Playwright and Chromium. The host test kit provides deterministic in-memory file/menu lifecycle tests; it is not proof of native Obsidian disk synchronization, external-edit conflict behavior, mobile behavior or host debounce timing. Each starter also participates in plan/apply/replay tests and isolated generated-project build/typecheck/test qualification in CI.

Before release, install into a **disposable vault** and verify create/open/edit, malformed input, save failure recovery, switching files, rename, duplicate names, restart/restore, unload/reload, external modification, and extension conflicts with another plugin. Confirm menu filtering on files and folders. Do not alter a user's personal vault or Restricted Mode as part of generation.

This increment is for text/JSON formats and the file context menu. It does not register an active-editor selection menu, binary codec, Markdown syntax mode, OS-level file association, arbitrary commands from JSON, or a domain-specific visual editor. Those need deliberate adapters and acceptance tests.

## Public API references

- Obsidian public type definitions: https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts
- Plugin API: https://docs.obsidian.md/Reference/TypeScript+API/Plugin
- TextFileView API: https://docs.obsidian.md/Reference/TypeScript+API/TextFileView
- Workspace API: https://docs.obsidian.md/Reference/TypeScript+API/Workspace
