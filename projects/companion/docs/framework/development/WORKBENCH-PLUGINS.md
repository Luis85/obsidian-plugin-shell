> **Framework reference — not this project's backlog or instructions; follow ./AGENTS.md**

# Workbench plugin development

Workbench has a trusted TypeScript plugin SDK for extending the **development framework itself** without adding framework IDs, starter IDs, CLI commands or Studio actions to central switch statements.

This is separate from the plugin system emitted into generated projects. Workbench plugins extend project creation and authoring; generated-project plugins extend the generated application.

## Required directory contract

Each plugin is self-contained:

```text
plugins/
  registry.ts
  my-plugin/
    manifest.json
    config.json
    src/
      index.ts
    tests/
      plugin.test.ts
```

`src/index.ts` exports a named `PluginObject` satisfying `WorkbenchPluginObject`. The manifest ID must equal the directory name; `npm run check:plugins` verifies the directory, manifest/config, source/test layout and explicit registry entry. `config.json` is plugin-owned configuration and may set `enabled: false`. Disabled plugins contribute nothing and are not activated.

Register the plugin explicitly in `plugins/registry.ts`. Workbench does not scan folders and execute whatever it finds. Plugin code is trusted application/tooling code, not a sandbox.

Create a plugin through the reviewed maker instead of hand-creating the package:

```sh
npm run make -- plugin my-extension --dry-run
npm run make -- plugin my-extension --yes
```

The generated plugin is registered automatically and starts disabled until its source/configuration is reviewed. This authoring command targets the Workbench source checkout itself; generated applications and extracted immutable framework kits use their own extension boundaries and do not mutate the reviewed Workbench plugin registry.

Run:

```sh
npm run check:plugins
npm run test:plugins
npm run typecheck:maker
```

## PluginObject contribution points

A plugin may provide any combination of:

- `events` — new typed event definitions available on the invocation event bus.
- `cli` — top-level CLI commands, actions and plugin-specific boolean/value flags.
- `tui` — Studio/TUI actions with the rich prompt API and current workspace.
- `frameworks` — project framework adapters.
- `starters` — normal starter definitions supplied by the plugin.
- `activate(context)` — invocation lifecycle setup and optional cleanup.

All contributions use one invocation-scoped runtime. Cleanup is deterministic and idempotent.

## Event bus

A plugin defines events explicitly rather than dispatching unregistered string names:

```ts
export const itemChanged = definePluginEvent(
  'my-plugin.item-changed',
  (value): value is { id: string } =>
    Boolean(value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string'),
);

export const PluginObject = {
  manifest,
  config,
  events: [itemChanged],
  activate({ eventBus }) {
    return eventBus.on(itemChanged, payload => {
      // payload is a validated, cloned and frozen value
      console.log(payload.id);
    });
  },
} satisfies WorkbenchPluginObject;
```

The same `eventBus` is available to `activate`, CLI commands and TUI actions. Plugins can `on`, `once` and `dispatch` events they registered. Event IDs must be namespaced under the owning manifest ID (for example `my-plugin.item-changed`). Duplicate event IDs, unregistered definitions and invalid payloads fail closed or are reported by the runtime; one listener failure does not stop unrelated listeners. Synchronous recursive dispatch is bounded at 32 nested publications and reports `WORKBENCH_PLUGIN_EVENT_RECURSION` instead of exhausting the stack.

## Extending the CLI

CLI contributions become top-level Workbench commands:

```ts
cli: [{
  id: 'inventory',
  summary: 'Inspect plugin inventory.',
  options: { booleans: ['verbose'], values: ['format'] },
  async execute(request, { eventBus, root }) {
    return { root, verbose: request.flags.verbose === true };
  },
}],
```

Workbench keeps common flags such as `--json`, `--root`, `--help` and `--no-interaction`. A plugin can add its own declared flags. Built-in maker commands and framework command roots cannot be shadowed. The top-level `bin/app` launcher resolves registered plugin command IDs before dispatch, so `node bin/app <plugin-command> ...` reaches the plugin in both source and compiled framework kit modes. Machine mode remains noninteractive and the returned object is serialized through the normal shell response path.

## Extending Studio / the TUI

A TUI contribution is added to the Studio action menu:

```ts
tui: [{
  id: 'inventory',
  label: 'Plugin inventory',
  async run({ ui, workspace, eventBus }) {
    ui.write(`Current project: ${workspace.document.project.name}\n`);
  },
}],
```

The action receives the same event bus as the CLI plus the current `Workspace` and `Prompts` interface. It can therefore implement a complete plugin-owned guided flow, not just a callback with no UI access.

## Extending frameworks

A framework name in a project starter is now an adapter ID, not a closed enum. Built-ins are `nuxtui`, `vanilla`, `angular` and `none`. A plugin can register another adapter and then provide starters that select it.

The included disabled `example-extension` demonstrates React:

```ts
export const reactAdapter = defineFrameworkAdapter({
  id: 'react',
  label: 'React',
  engine: 'vanilla',
  dependencies: {
    react: '19.3.0',
    'react-dom': '19.3.0',
  },
  devDependencies: {
    '@types/react': '19.3.0',
    '@types/react-dom': '19.3.0',
  },
  files() {
    return {
      'src/ui/mount.ts': '/* React createRoot integration */',
    };
  },
});
```

The adapter reuses the qualified `vanilla` Vite/TypeScript build engine while replacing the UI mount and adding exact dependencies. This is the intended path for React-like client frameworks that fit the existing Vite engine. Frameworks requiring a fundamentally different compiler/bundler need a new qualified build engine rather than smuggling arbitrary build commands into starter JSON.

Adapter-contributed generated files are restricted to `src/ui/**`; normal Workbench ownership and safe-generation rules still apply.

## Plugin-provided starters

A plugin can place validated starter definitions in `PluginObject.starters`:

```ts
const starter = {
  schemaVersion: 1,
  id: 'webapp-react',
  // metadata omitted
  generator: {
    kind: 'project',
    projectType: 'webapp',
    framework: 'react',
    targets: ['webapp'],
  },
  inputs: [],
  files: [],
  processes: [],
  firstRun: [],
} satisfies StarterDefinition;
```

Plugin starters enter the same discovery list as `configs/starters/*.json`. They use the same schema/runtime validation and content hashing. A duplicate ID between a file starter and plugin starter is rejected. A project starter using an unknown framework ID is valid data but cannot be selected until its adapter is installed.

The example plugin contributes `webapp-react`; because the plugin is disabled by default, that starter is absent from ordinary discovery until the developer enables the plugin.

Plugin-provided starters are **not copied into the standalone `workbench-starters-*.zip`**. That archive remains data-only and contains only `configs/starters/*.json`. A plugin starter stays with the registered plugin that supplies its framework adapter and other trusted capabilities; normal Workbench discovery merges both sources at runtime. Plugin-local tests/qualification own that extension path instead of requiring the core starter-pack matrix to know every third-party starter.

## Safety and compatibility boundaries

Plugin source is trusted code and can use Node APIs available to the Workbench host. Static registration makes that authority explicit and keeps imports visible to TypeScript, linting, architecture analysis and distribution packaging.

Starter JSON remains data-only. Installing a framework adapter does not make starter JSON executable; execution authority comes from the reviewed plugin source that registered the adapter.

Adding a new adapter does not weaken existing starter compatibility. Saved `project.config.json` files retain the adapter ID and generation fails clearly if that adapter is no longer installed.
