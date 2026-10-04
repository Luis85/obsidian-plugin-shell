# Generated project plugin system

> Type: reference · Part of the [docs index](../README.md)

> **Two plugin layers:** this document describes plugins inside a generated application. To extend Workbench itself—framework adapters, project starters, the maker event bus, CLI commands or Studio/TUI actions—use the [Workbench plugin SDK](./WORKBENCH-PLUGINS.md).

Every project starter emits the same local TypeScript extension contract. The goal is to let application developers add or remove capabilities without changing Workbench's generator or mixing plugin-specific code into the shared core.

## Directory contract

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

A plugin owns its complete implementation and tests under `plugins/<plugin-name>/`. Its root also owns the two data files required by the contract:

- `manifest.json` — stable plugin `id`, display `name`, semantic `version` and optional description.
- `config.json` — project-owned configuration. `enabled: false` disables activation without deleting the plugin.

The plugin must be TypeScript and `src/index.ts` must export a named `PluginObject`. The generated `src/core/plugin-api.ts` is the public compile-time contract.

## PluginObject

```ts
export const PluginObject = {
  manifest,
  config,
  activate(context) {
    // Add host-specific or shared behavior.
    // Return cleanup for listeners, DOM, timers or other owned resources.
  },
} satisfies AppPluginObject;
```

The activation context identifies one of `obsidian-plugin`, `webapp`, `website`, `terminal-app` or `preview`, exposes the shared project model and resolved plugin config, and provides a root element for visual hosts.

Activation is deterministic. The runtime validates plugin identity/config, rejects duplicate IDs, skips disabled plugins, unwinds already-started plugins if a later activation fails and makes final cleanup idempotent.

## Registration

`plugins/registry.ts` is the explicit composition root. Import a plugin's `PluginObject` and add it to `pluginRegistry`.

Workbench deliberately does **not** scan the filesystem or dynamically evaluate modules at runtime. Static registration works in Obsidian, Vite/browser bundles and the compiled terminal application, keeps the dependency graph visible to TypeScript/build tooling and prevents a directory entry from becoming implicit execution authority.

The generated `starter-extension` is a working example of the complete contract. Projects may replace it with product-specific plugins or remove it together with its registry entry.

## Host lifecycle

Visual target entrypoints set the host before mounting the application UI. The vanilla, Vue/Nuxt UI and Angular mounts activate registered plugins only after their own UI has mounted, then dispose plugins before tearing down the host UI.

The terminal entrypoint activates the same registry as `terminal-app` for the command invocation and disposes it before exit. A plugin should branch on `context.host` when behavior is host-specific.

The generated project remains responsible for native/browser acceptance. A successful plugin activation or build is not evidence that an Obsidian integration, browser interaction or business workflow is accepted.

## Testing and configuration

The root TypeScript configurations include `plugins/**/*.ts`, and emitted CLI/Angular configurations include the registry and plugin source so runtime imports are compiled. JSON module support is enabled for `manifest.json` and `config.json`.

`npm test` runs both the scaffold tests and `plugins/*/tests/*.test.ts`. Each plugin should test its own manifest/config contract, host behavior, cleanup and disabled/error states as relevant.

Plugin code is trusted project code, not a sandbox. Adding a plugin can introduce arbitrary application behavior and dependencies; review source, configuration and package changes before enabling it.
