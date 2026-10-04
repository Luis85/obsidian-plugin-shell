# Workbench plugins

This folder is the trusted, statically registered extension surface for **Workbench itself**. Plugins that users drop into an installed or compiled app live in `bin/plugins/` instead; see [app plugins](../docs/development/APP-PLUGINS.md).

Infrastructure lives at the root:

- `api.ts` — public TypeScript contribution contracts.
- `runtime.ts` — invocation-scoped activation, event bus and contribution collection.
- `registry.ts` — explicit composition root.

Create one through the reviewed maker:

```sh
npm run make -- plugin my-extension --dry-run
npm run make -- plugin my-extension --yes
```

The generated plugin is explicitly registered and starts disabled until its source/configuration is reviewed.

Every actual plugin lives completely under `plugins/<plugin-name>/`:

```text
plugins/my-plugin/
  manifest.json
  config.json
  src/
    index.ts          # exports const PluginObject
  tests/
    plugin.test.ts
```

The repository guard `npm run check:plugins` requires that structure, matching manifest/directory IDs, a named `PluginObject`, at least one plugin-local test, and explicit registration.

`example-extension` is deliberately disabled in its `config.json`. It is an executable reference showing typed events, a CLI command, a Studio/TUI action, a custom React framework adapter and a `webapp-react` starter. Set `enabled` to `true` only when intentionally exercising the example.

See [Workbench plugin development](../docs/development/WORKBENCH-PLUGINS.md). Generated applications have a separate plugin composition root documented in [generated project plugins](../docs/development/GENERATED-PROJECT-PLUGINS.md).

## Component templates

Plugins may contribute validated `componentTemplates` and can read the merged baseline/project/plugin catalog through `context.templates.list()` and `context.templates.get(id)`, then instantiate through the same validated catalog with `context.templates.instantiate(workspace, id, name)`. Template contributions remain inert JSON; they do not execute plugin code when listed, documented or instantiated.
