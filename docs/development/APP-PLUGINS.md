# App plugins (`bin/plugins`)

You can extend `bin/app` with your own plugins, including a compiled framework kit where the CLI is the single
`bin/app.js` bundle. The model follows Obsidian community plugins: drop a plugin folder in, review it, enable it,
and the app loads it on start.

This is a third extension surface, separate from both:

- [Workbench plugins](WORKBENCH-PLUGINS.md) (`plugins/<id>/src/index.ts`), which are TypeScript compiled into the
  bundle. They are Obsidian's *core* plugins in this picture, switched by their `config.json`.
- [generated-project plugins](GENERATED-PROJECT-PLUGINS.md), which extend the application a project generates.

## Folder layout

```text
bin/
  app                        # launcher
  app.js                     # compiled bundle (kit only)
  plugins/
    community-plugins.json   # enabled plugin IDs, in load order: ["hello-world"]
    hello-world/
      manifest.json          # identity and minimum app version
      main.js                # CommonJS module exporting a Plugin subclass
      settings.json          # the plugin's settings (Obsidian's data.json)
      ...                    # any other files the plugin reads itself
```

Each plugin has its own folder, and every folder must bring all three files. A folder named after a bundled Workbench
plugin (such as `example-extension/config.json` in a kit) is that plugin's config, not an app plugin.

`bin/plugins` belongs to the user. `framework status` does not fingerprint it, `framework upgrade` never touches it,
`framework pack` never ships it, and generated projects never copy it. In a source checkout, `/bin/plugins/` is in
`.gitignore`.

### manifest.json

```json
{
  "id": "hello-world",
  "name": "Hello World",
  "version": "1.0.0",
  "minAppVersion": "0.4.0",
  "description": "Greets from the command line.",
  "author": "Your Name",
  "authorUrl": "https://example.com"
}
```

| Field | Rule |
| --- | --- |
| `id` | Lowercase kebab-case, at most 64 characters. It must equal the folder name and must not be a built-in command root (`plugins`, `make`, `sketch`, ...) or a bundled plugin ID. |
| `name`, `description`, `author` | Non-empty strings. |
| `version`, `minAppVersion` | `x.y.z`. If `minAppVersion` is newer than the app (`node bin/app version`), the plugin does not load. |
| `authorUrl` | Optional `https://` URL. |

Other Obsidian fields, such as `fundingUrl` and `isDesktopOnly`, are accepted and ignored.

### settings.json

`settings.json` is a JSON object owned by the plugin. Ship its defaults with the plugin. The plugin reads it with
`loadData()` and replaces it with `saveData()`. Disabling a plugin keeps its settings.

### main.js

`main.js` is a CommonJS module, like an Obsidian plugin bundle. `require('workbench')` returns the plugin API, and
any other `require` resolves relative to the plugin folder, including `node:` built-ins.

```js
const { Plugin } = require('workbench');

module.exports = class HelloWorld extends Plugin {
  async onload() {
    this.settings = await this.loadData();

    this.addCommand({
      id: 'greet',
      name: 'Greet someone',
      options: { values: ['who'], booleans: ['loud'] },
      execute: async (request, context) => {
        this.settings.count = (this.settings.count ?? 0) + 1;
        await this.saveData(this.settings);
        const text = `${this.settings.greeting}, ${request.flags.who ?? 'world'}!`;
        return { message: request.flags.loud ? text.toUpperCase() : text, root: context.root };
      },
    });

    this.addStudioAction({
      id: 'wave',
      label: 'Wave',
      run: ({ ui }) => ui.write('👋\n'),
    });

    this.register(() => { /* release anything acquired in onload */ });
  }

  onunload() {}
};
```

Use a bundler such as esbuild (`--format=cjs --platform=node --external:workbench`) when the plugin has
dependencies, as Obsidian plugins do.

## Plugin API

| Member | Purpose |
| --- | --- |
| `this.app` | `{ version, frameworkRoot }` of the running app. |
| `this.manifest` | The validated manifest. |
| `onload()` | Called when the app loads the plugin. Register everything here. |
| `onunload()` | Called when the invocation ends, after the plugin's registered cleanups, in reverse load order. |
| `loadData()` | Resolves to a fresh copy of `settings.json`. |
| `saveData(object)` | Replaces `settings.json` atomically through the shared file-plan writer. Saves run one at a time. |
| `addCommand({ id, name, options?, execute })` | Adds `node bin/app <plugin-id> <command-id>`. `execute(request, context)` receives the parsed `request.flags` and the invocation context (`root`, `frameworkRoot`, `input`, `signal`, `progress`, `eventBus`, `templates`), and returns a JSON object. |
| `addStudioAction({ id, label, run })` | Adds an entry to the Studio/TUI action menu. `run(context)` also receives `ui`, `workspace` and `project`. |
| `register(cleanup)` | Runs `cleanup` when the plugin unloads. |

Commands accept the common maker flags (`--json`, `--root`, `--no-interaction`, `--help`) plus the `options` they
declare. `node bin/app <plugin-id>` lists a plugin's commands. Machine mode prints the returned object in the normal
JSON result envelope.

## Managing plugins

```sh
node bin/app plugins list                      # installed, enabled, invalid; bundled plugins too
node bin/app plugins show hello-world          # manifest, settings.json and issues
node bin/app plugins enable hello-world        # preview the change to community-plugins.json
node bin/app plugins enable hello-world --yes  # apply it
node bin/app plugins disable hello-world --yes
```

None of these commands imports or runs `main.js`, so they stay safe to use when a plugin is broken. Enabling and
disabling are reviewed plans like every other write (`--yes`, `--apply <hash>` or `--plan-out`). The list file is
never rewritten while it is unreadable: repair or remove it first. To uninstall a plugin, disable it and delete its
folder.

## Loading rules

- New plugins start disabled. Only IDs listed in `community-plugins.json` load, in list order.
- Plugins load when `bin/app` runs a maker command (Studio, `sketch`, `prototype` and so on) or a plugin command.
  Framework commands such as `plugins`, `status`, `doctor` or `framework` never load plugins.
- A plugin that is invalid, fails in `main.js` or throws in `onload` is reported on stderr and skipped. Its cleanups
  run, and the other plugins and the app keep working.
- Running a disabled or invalid plugin's command fails with `COMMUNITY_PLUGIN_INACTIVE` and names the next step.
- Plugin folders and files must be real, bounded regular files. Links are refused, `main.js` is limited to 8 MB, and
  `manifest.json` and `settings.json` to 64 KB and 1 MB.

## Trust

As in Obsidian, an app plugin is code you choose to run. It runs in the `bin/app` process with your user's
permissions, and there is no sandbox. Read a plugin's `main.js` before you enable it.
