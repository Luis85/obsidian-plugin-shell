# Obsidian test kit

`tests/support/obsidian/` is an in-memory double of the `obsidian` module for Vitest.
It gives plugin code a real-enough vault, metadata cache, workspace, plugin lifecycle,
settings DOM, notices, modals and menus, so tests exercise your actual commands and
adapters instead of hand-written mocks. It is test support only: it never enters the
plugin bundle, and it does not replace native Obsidian evidence.

## Opt in per test file

The Vitest config still resolves a bare `obsidian` import to a module that throws
`OBSIDIAN_BOUNDARY_REQUIRES_EXPLICIT_TEST_DOUBLE`. A test chooses the kit explicitly:

```ts
import { expect, it, vi } from 'vitest';
vi.mock('obsidian', () => import('@test/obsidian'));
import { App, TFile } from 'obsidian';          // runtime: kit classes; types: Obsidian's
import { createTestApp } from '@test/obsidian';  // kit helpers and kit-typed handles
```

`@test/obsidian` is an alias for `tests/support/obsidian/index.ts` in
`vitest.config.mjs` and `tsconfig.json` (`paths`). A relative import such as
`../support/obsidian` works the same way.

Two views of the same objects exist on purpose. Values you pass to production code
should be typed as Obsidian's (`new App()` from `'obsidian'`), while `kit.*` handles
add inspection helpers. Where a kit value must cross into a production API, narrow it
with a runtime check instead of a cast: `hostInstance(kit.file('a.md'), TFile)`.

## Create an app with notes

```ts
const app = new App();
const kit = createTestApp({
  app,
  files: { 'Inbox.md': '---\ntags: [inbox]\n---\n# Inbox\nSee [[Launch]].\n' },
  activeFile: 'Inbox.md',                         // fires file-open
  pluginData: { 'my-plugin': { greeting: 'hi' } }, // .obsidian/plugins/my-plugin/data.json
});
await expect(kit.vault.create('Missing/New.md', 'x')).rejects.toThrow(); // parents must exist
kit.read('Inbox.md');                               // exact bytes, also for hidden paths
kit.metadataCache.getFileCache(kit.file('Inbox.md'))?.links; // seeded files are parsed
```

Use `loadVaultFixtures(new URL('../fixtures/obsidian-vault', import.meta.url))` to load
a folder of Markdown files as `files`. `createTestVault(files)` gives a standalone
vault when nothing else is needed.

Vault writes emit `create`/`modify`/`delete`/`rename` synchronously. The metadata
cache updates a few microtasks later and then emits `changed` and `resolved`, so
code that reads the cache right after a write sees stale data, as it can in the host.
Call `await flushObsidian()` (or `await kit.flush()`) before asserting metadata.
It never advances timers; use `vi.advanceTimersByTime` for notices, debounces and
intervals.

## Test a command

```ts
class MyPlugin extends Plugin { /* onload registers commands, views, settings */ }
const plugin = new MyPlugin(app, manifest);
await kit.loadPlugin(plugin);           // awaits onload, then marks the layout ready
expect(await kit.runCommand('greet')).toBe(true);   // local or full id
expect(kit.notices.map(notice => notice.message)).toEqual(['hi']);
await kit.unloadPlugin(plugin);
expect(kit.commands()).toEqual([]);     // every registration is removed again
expect(kit.errors).toEqual([]);         // handler throws/rejections the host would only log
```

`runCommand` follows palette rules (`checkCallback(true)` gates the run) and awaits
a returned promise. Also available: `kit.ribbons()`, `kit.clickRibbon(title)`,
`kit.openFileMenu(file)` (fires `file-menu`, returns the menu; `menu.item(title).click()`),
`kit.modals`, `kit.menus` and `app.workspace.getLeavesOfType(type)`.

## Test a settings tab

```ts
// @vitest-environment happy-dom
const tab = kit.openSettings(plugin);  // appends to document.body and calls display()
const input = tab.containerEl.querySelector('input')!;
input.value = 'hey'; input.dispatchEvent(new Event('input'));
await kit.flush();
expect(JSON.parse(kit.read('.obsidian/plugins/my-plugin/data.json'))).toEqual({ greeting: 'hey' });
```

Classic tabs that build `Setting` rows in `display()` and Obsidian 1.13 declarative tabs
(`getSettingDefinitions`/`getControlValue`/`setControlValue`) both render real DOM.
Validation errors appear in `[role="alert"]` and skip `setControlValue`; `update()`
refreshes values in place. Like the host, a toggle's `setValue` calls `onChange` when
the value changes.

## Test a Vue view with happy-dom

Anything that builds DOM (views, settings, modals, ribbons) needs
`// @vitest-environment happy-dom`. `createTestApp` installs Obsidian's DOM helpers
(`createEl`, `createDiv`, `empty`, `addClass`, `setText`, `createFragment`, ...);
call `installObsidianDom()` yourself if you do not create an app.

```ts
await kit.runCommand('open-my-view');
const [leaf] = app.workspace.getLeavesOfType('my-view');
expect(leaf.view.containerEl.querySelector('[data-testid="my-panel"]')).not.toBeNull();
```

Leaves really construct registered views, run `onOpen`/`onClose`, and keep their leaf
(with a placeholder view) when the plugin unloads. The shell itself is proven against
the kit in `tests/runtime/obsidian-test-kit-shell.test.ts`: it loads `src/main.ts`,
opens the Vue showcase, toggles a native setting and writes, updates and trashes task
notes through `src/infrastructure/obsidian` with exact Markdown assertions.

## What the kit does not prove

- It is not Obsidian. Link resolution, tag rules, YAML formatting (`processFrontMatter`,
  `stringifyYaml` use the `yaml` package) and event ordering are simplified; assert
  parsed values rather than host-specific formatting.
- No editor (`Editor`, `editorCallback` commands never run), CodeMirror, Markdown
  rendering, hover/popout windows, mobile layout, icons, `requestUrl`, `moment` or
  real file-system/sync races. Unsupported members are simply absent, so calls fail loudly.
  Add one per test when needed:
  `vi.mock('obsidian', async () => ({ ...await import('@test/obsidian'), requestUrl: vi.fn() }))`.
- `vault.create` rejects missing parent folders; `createFolder` and adapter writes create
  parents. Adapter-level renames of visible paths surface as delete + create.
- Host styling, focus, real timing and cross-process behavior are out of scope.

Use the kit for fast feedback on plugin logic, lifecycle and adapter contracts. Use the
served browser tests (`npm run test:e2e`) for rendered UI and the explicitly
provisioned native smoke tests in an isolated scratch vault for host behavior before
claiming native qualification.
