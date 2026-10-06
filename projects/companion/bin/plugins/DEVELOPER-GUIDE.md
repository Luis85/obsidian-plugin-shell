# App plugin developer guide

This folder holds the plugins of this `bin/app`. You can drop a plugin in here to extend the shell app without
rebuilding it, including a compiled framework kit where the CLI is the single `bin/app.js` bundle. The model follows
Obsidian community plugins: install a folder, review it, enable it, and the app loads it.

Typical plugins:

- **Project automations:** react to finished commands, run checks or generators, and write reviewed files.
- **Team tools:** project-specific commands that teammates run as `node bin/app <plugin> <command>`.
- **Agent tools:** small, JSON-in/JSON-out commands that AI agents create, discover (`plugins list --json`) and call
  with `--json`.

This guide is the complete plugin contract (plugin API 1).

## 1. Folder layout

```text
bin/
  app                        # launcher
  plugins/
    DEVELOPER-GUIDE.md       # this guide
    community-plugins.json   # enabled plugin IDs, in load order: ["release-notes"]
    release-notes/           # one folder per plugin, named after its ID
      manifest.json          # identity, version, description and category
      main.js                # CommonJS module that exports a Plugin subclass
      settings.json          # the plugin's own settings (a JSON object)
      ...                    # any other files the plugin reads itself
```

Every plugin folder must bring `manifest.json`, `main.js` and `settings.json`. A folder that has only a `config.json`
belongs to a plugin bundled into the app (a Workbench plugin, Obsidian's "core plugin"); see `plugins list`.

`bin/plugins` belongs to you. The rest of the toolchain treats it as follows:

- `framework status` does not fingerprint your plugins.
- `framework upgrade` keeps them, and replaces this guide only if you did not edit it.
- `framework pack` and project generation never copy them.
- A source checkout ignores everything here except this guide in Git.

## 2. manifest.json

```json
{
  "id": "release-notes",
  "name": "Release notes",
  "version": "1.2.0",
  "minAppVersion": "0.4.0",
  "apiVersion": 1,
  "description": "Drafts docs/release-notes.md from the configured project after each generate.",
  "author": "Platform team",
  "authorUrl": "https://example.com/platform",
  "license": "MIT",
  "category": "automation",
  "tags": ["release", "docs"]
}
```

| Field | Required | Rule |
| --- | --- | --- |
| `id` | yes | Lowercase kebab-case, at most 64 characters, equal to the folder name. It may not be a built-in command root (`plugins`, `make`, `sketch`, `help`, `app`, ...) or a bundled plugin ID. |
| `name` | yes | Display name, at most 100 characters. |
| `version` | yes | The plugin's own `x.y.z` version. |
| `minAppVersion` | yes | The oldest app version (`node bin/app version`) the plugin supports, `x.y.z`. On an older app the plugin does not load. |
| `apiVersion` | yes | The plugin API this plugin is written against. This app provides API `1`; a plugin that needs a newer API does not load. |
| `description` | yes | What the plugin does, at most 500 characters. Agents and `plugins list` show it. |
| `author` | yes | A person, team or agent, at most 100 characters. |
| `category` | yes | One of `automation`, `tool`, `integration`, `generator`, `quality`, `documentation`, `other`. |
| `tags` | yes | Up to 10 unique kebab-case tags for filtering, which may be `[]`. |
| `authorUrl` | no | An `https://` URL. |
| `license` | no | A license name, ideally an SPDX identifier. |

Other Obsidian fields, such as `fundingUrl` and `isDesktopOnly`, are accepted and ignored.

## 3. settings.json

`settings.json` is a JSON object that the plugin owns; ship your defaults in it. Read it with `this.loadData()` and
replace it with `this.saveData(object)`. Writes are atomic and run one at a time. Disabling a plugin keeps its settings.

## 4. main.js

`main.js` is a CommonJS module, like an Obsidian plugin bundle. `require('workbench')` returns the plugin API, and any
other `require` resolves relative to the plugin folder, including `node:` built-ins. If the plugin has dependencies,
bundle them into one file, for example with
`esbuild src/main.ts --bundle --format=cjs --platform=node --external:workbench --outfile=main.js`.

```js
const { Plugin } = require('workbench');

module.exports = class ReleaseNotes extends Plugin {
  async onload() {
    this.settings = { target: 'docs/release-notes.md', ...await this.loadData() };

    // Your own event, which other plugins can subscribe to as "release-notes.drafted".
    this.drafted = this.app.events.define('drafted');

    // Automation: react whenever a command finishes in this invocation.
    this.app.events.on('app.command-finished', ({ command, status }) => {
      if (status !== 'failed') this.app.log(`${command} finished`);
    });

    // Tool: node bin/app release-notes draft [--title <text>] [--yes] [--json]
    this.addCommand({
      id: 'draft',
      name: 'Draft release notes',
      options: { values: ['title'], booleans: ['yes'] },
      execute: async (request, context) => {
        const { data } = await this.app.commands.run('version');
        const content = `# ${request.flags.title ?? 'Release notes'}\n\nBuilt with Workbench ${data.frameworkVersion}.\n`;
        const plan = await this.app.files.plan([{ path: this.settings.target, content }], { root: context.root });
        if (!request.flags.yes) return { status: 'planned', changes: plan.changes.map(c => ({ path: c.path, status: c.status })) };
        const applied = await this.app.files.apply(plan);
        this.app.events.dispatch(this.drafted, { path: this.settings.target });
        return { status: 'applied', written: applied.written };
      },
    });

    // The same capability inside Studio (node bin/app studio).
    this.addStudioAction({
      id: 'preview',
      label: 'Preview release notes',
      run: ({ ui }) => ui.write(`Release notes go to ${this.settings.target}\n`),
    });

    this.register(() => { /* release anything acquired in onload */ });
  }

  onunload() {}
};
```

## 5. Plugin class

| Member | Purpose |
| --- | --- |
| `this.app` | The app API (section 6). |
| `this.manifest` | The validated manifest. |
| `onload()` | Called once when the app loads the plugin. Register commands, actions and listeners here; it may be async. |
| `onunload()` | Called when the invocation ends, after the plugin's cleanups. Plugins unload in reverse load order. |
| `loadData()` | Resolves to a fresh copy of `settings.json`. |
| `saveData(object)` | Replaces `settings.json` with a JSON object. |
| `addCommand({ id, name, options?, execute })` | Adds `node bin/app <plugin-id> <id>`. See section 7. |
| `addStudioAction({ id, label, run })` | Adds a Studio/TUI menu entry. `run(context)` gets `ui` (prompts), `workspace`, `project`, `root`, `eventBus` and `templates`. |
| `register(cleanup)` | Runs `cleanup` (which may be async) when the plugin unloads. |

## 6. App API (`this.app`)

| Member | Purpose |
| --- | --- |
| `apiVersion` | The plugin API version the app provides (`1`). |
| `version` | The app version. |
| `frameworkRoot` | The folder that holds `bin/app`. |
| `root` | The project root of this invocation: `--root`, else the working directory. During `onload` it is the working directory. |
| `events` | The invocation event system (below). |
| `commands.list()` | The built-in command catalog: `{ id, summary, effect, options }` for every `node bin/app` command. |
| `commands.run(command, { args?, options?, root? })` | Runs a built-in command in process and resolves to its JSON result envelope `{ command, status, data, diagnostics }`. |
| `files.plan(entries, { root? })` | Builds a reviewable plan of whole-file writes. Each entry is `{ path, content }`; `content: null` deletes, and `encoding: 'base64'` is allowed. Paths are relative to `root` (default `this.app.root`). Each change reports `path`, `status`, `beforeHash` and `afterHash`. |
| `files.apply(plan)` | Applies a plan atomically. Files that changed after planning are refused, and protected folders such as `.git` and `node_modules` are never written. |
| `plugins.list()` | Manifests of the app plugins loaded so far, in load order. |
| `plugins.get(id)` | Another loaded plugin's instance, so plugins can offer an API to each other. |
| `log(message)` | Writes `[plugin-id] message` to stderr. stdout is reserved for command results. |

### Running built-in commands

`commands.run` uses exactly the CLI's own contracts:

- Read commands return their data.
- Plan commands (`make`, `generate`, `docs export`, `plugins enable`, ...) return `status: 'planned'` with a
  `planHash`. Pass `options: { yes: true }`, or `{ apply: '<planHash>' }` after reviewing, to apply.
- Process commands (`build`, `test`, `check`, ...) start the same processes the CLI starts.
- Failures resolve to `status: 'failed'` with `diagnostics` and do not throw.
- `mcp` is refused, because it owns stdin and stdout.

```js
const listed = await this.app.commands.run('templates list', { options: { 'atomic-level': 'atom' } });
const planned = await this.app.commands.run('make', { args: ['feature', 'bookmarks'], options: { 'dry-run': true } });
```

Prefer `commands.run` and `files.plan`/`files.apply` over writing files directly. You keep the same review,
conflict and protected-path rules as the CLI.

### Events

All plugins of an invocation, the bundled Workbench plugins and the app share one event bus.

| Method | Purpose |
| --- | --- |
| `events.define(name, validate?)` | Defines `<plugin-id>.<name>` and returns its definition. Without `validate`, a payload must be JSON data. |
| `events.on(event, listener)` | Subscribes and returns `off()`. `event` is a definition or a full ID such as `'release-notes.drafted'`. |
| `events.once(event, listener)` | Like `on`, but delivers only once. |
| `events.dispatch(event, payload)` | Publishes one of the plugin's own events. Other plugins' events and `app.*` events are refused. |
| `events.list()` | Every event ID defined so far. |

Built-in app events:

| Event | Payload | When |
| --- | --- | --- |
| `app.plugins-loaded` | `{ plugins: string[] }` | After every enabled plugin has loaded. |
| `app.command-started` | `{ command, action }` | Before a non-interactive maker or plugin command runs. |
| `app.command-finished` | `{ command, action, status }` | After it ran. `status` is the result status, or `failed`. |

Delivery rules:

- Payloads are validated, cloned and frozen.
- A failing listener is reported and never stops the others.
- Recursive dispatch is bounded at 32 levels.
- Subscriptions made through `this.app.events` end when the plugin unloads.
- An event must be defined before anyone subscribes to it. To listen to a plugin that loads later, subscribe inside an
  `app.plugins-loaded` listener.

## 7. Commands

A command's `execute(request, context)` runs for `node bin/app <plugin-id> <command-id> [flags]`.

- `request.flags` holds the parsed flags. Declare your own in `options: { booleans: [...], values: [...] }`. Every
  command also accepts the shared maker flags (`--json`, `--root`, `--input`, `--out`, `--name`, `--no-interaction`,
  `--help` and the other maker options), and these names cannot be redeclared. Undeclared flags are rejected.
- `context` holds `root`, `frameworkRoot`, `input` (stdin), `signal` (cancellation), `progress(message)` (stderr),
  `eventBus` and `templates` (the component-template catalog: `list()`, `get(id)`).
- Return a JSON object. With `--json` the app prints one envelope,
  `{ "protocolVersion": 1, "command": "<plugin-id>", "status": "ok", "data": { ... }, "diagnostics": [] }`. Return a
  `status` field (`planned`, `applied`, ...) to set the envelope status.
- Throw to fail. An error whose message starts with `UPPER_CASE_CODE:` reports that code, and the exit code is `1`.
- `node bin/app <plugin-id>` lists the plugin's commands, and `node bin/app <plugin-id> --help` describes the plugin.

For agents, keep commands non-interactive. Read inputs from flags or `--input`-style files, and return everything as
data.

## 8. Managing plugins

```sh
node bin/app plugins list --json                # every plugin: manifest, category, tags, enabled state, issues
node bin/app plugins show release-notes         # one plugin, with its settings.json
node bin/app plugins enable release-notes       # preview the change to community-plugins.json
node bin/app plugins enable release-notes --yes # apply it; the plugin loads from the next invocation
node bin/app plugins disable release-notes --yes
```

None of these commands imports or runs `main.js`, so they stay safe to use when a plugin is broken. Enabling and
disabling are reviewed plans (`--yes`, `--apply <hash>` or `--plan-out`). An unreadable `community-plugins.json` is
never overwritten: repair or remove it first. To uninstall a plugin, disable it and delete its folder.

## 9. Loading rules

- New plugins start disabled. Only IDs listed in `community-plugins.json` load, in list order.
- Plugins load for maker and plugin commands (Studio, `sketch`, `prototype`, `<plugin-id> ...`). Framework commands
  such as `plugins`, `status`, `doctor` or `framework` never load plugins, but a plugin can run them through
  `this.app.commands.run`.
- A plugin is skipped, with the reason on stderr, when any of these is true: its manifest is invalid,
  `minAppVersion` or `apiVersion` is too new, `main.js` throws, it does not export a `Plugin` subclass, or `onload`
  throws. Its registered cleanups still run, and the other plugins and the app keep working.
- Running a disabled or invalid plugin's command fails with `COMMUNITY_PLUGIN_INACTIVE` and names the next step.
- Plugin folders and files must be real files, not links. Size limits: `main.js` 8 MB, `manifest.json` 64 KB,
  `settings.json` 1 MB.

## 10. Testing a plugin

You can drive a plugin end to end through the real CLI:

```sh
node bin/app plugins show release-notes --json                  # manifest valid? issues = []
node bin/app plugins enable release-notes --yes
node bin/app release-notes --json                               # lists its commands
node bin/app release-notes draft --title "1.2.0" --json         # preview
node bin/app release-notes draft --title "1.2.0" --yes --json   # apply
```

Check stderr for `COMMUNITY_PLUGIN_*` diagnostics. For unit tests, keep logic in plain functions that `main.js`
calls, and test those with `node --test`.

## 11. Trust

As in Obsidian, an app plugin is code you choose to run. It runs in the `bin/app` process with your user's
permissions, and there is no sandbox: it can do anything that Node.js can. Read a plugin's `main.js`, including
plugins written by teammates or agents, before you enable it.
