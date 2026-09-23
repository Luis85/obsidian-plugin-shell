# Add commands and ribbon icons

Feature authors declare commands in a dedicated file and add one factory to the
explicit registry in `src/bootstrap/commands.ts`. `main.ts`, native registration
and generic dispatch do not change for each new feature.

```ts
// src/features/bookmarks/commands.ts
import { defineCommand, defineRibbon } from '../api';
import type { Result } from '../../domain/outcome';

interface BookmarkActions {
  available(): boolean;
  openBookmarks(): Promise<Result<unknown>>;
}

export function createBookmarkCommands(actions: BookmarkActions) {
  const open = defineCommand({
    id: 'open-bookmarks',
    titleKey: 'bookmarks.open',
    available: () => actions.available(),
    execute: () => actions.openBookmarks(),
  });
  return {
    commands: [open],
    ribbons: [defineRibbon(open, { id: 'bookmarks', icon: 'bookmark' })],
  };
}
```

Define the label in both locale files. Import the factory in the bootstrap registry
and pass the narrow capabilities it needs in one entry, alongside the showcase
and debugging examples. The feature has no Obsidian import and receives no global
plugin singleton. The ribbon references the actual command descriptor, so it uses
the same callback, availability check and in-flight operation as the palette.

IDs are stable lowercase hyphenated names of at most 64 characters. Do not add the
plugin ID or name yourself; Obsidian supplies that prefix. Native icon names are
explicit local host icon identifiers. Registration rejects duplicate commands,
duplicate ribbons, unknown localization keys and ribbons whose referenced command
is missing. This bounded catalog allows 100 commands and 100 ribbons per runtime.
Validation completes before native command/ribbon registration starts.

## Checks and outcomes

`available` is a pure synchronous query. Native `checkCallback(true)` only checks
availability; it never runs the action. Execution checks again against current
state. Promise-returning or throwing predicates are unavailable and observed.
Ribbons remain ordinary native controls; clicking an unavailable command has no
action effect. There is no background polling or generated UI state store.

Handlers can return `void` or an explicit application `Result`, synchronously or
asynchronously. A typed failure keeps its `none`, `committed` or `uncertain` effect.
Only documented failure fields are forwarded; raw causes, private payloads and
unregistered text are excluded. An exception has an uncertain effect because the
dispatcher cannot know whether the handler already persisted something. It is
observed and shown through the existing notice policy without automatic retry.

A completed `void` callback means its handler finished; it is not evidence that a
business mutation succeeded. Command logs describe dispatch lifecycle. Use typed
application results when callers need a failure propagated, and canonical service
facts for persisted changes. The default command logging catalog contains only
declared IDs and codes, with opaque correlations rather than note content.

Repeated palette/ribbon activation while a command runs shares one promise. A
deliberate activation after completion is a new execution. Disposal makes retained
callbacks inert and prevents queued work from starting. A started host operation
cannot be retroactively cancelled; its actual result still settles, while disposed
presentation callbacks and late feedback remain inactive.

## Native ownership

`src/infrastructure/obsidian/commands.ts` owns host registration, public removal
and ribbon elements. Native registration failure cleans up the handles already
acquired. Cleanup failures are independently recorded, and callbacks are disabled
before cleanup so a retained host handle cannot revive the runtime.

The adapter passes the original local ID to public `Plugin.removeCommand`, since
that method adds the plugin prefix. `addCommand` returns an already-prefixed ID;
passing it back would prefix it twice. This behavior was inspected in the installed
Obsidian 1.13.7 application code and is also exercised by the isolated native
qualification probe before plugin unload. The [verification record](../testing/ITERATION-THREE.md)
records its successful execution in three fresh native runs. Synthetic tests deliberately model the
prefixed return value instead of hiding this distinction.

The built-in factories retain opening the showcase and toggling its native header.
Debugging adds explicit toggle/report commands using the dedicated modal service.
Editor-specific callbacks, default hotkey policy, dynamic command discovery and a
command maker are outside this slice; the current explicit entry point works
without them.
