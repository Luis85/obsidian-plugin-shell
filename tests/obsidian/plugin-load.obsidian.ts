import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';

describe('built plugin in real Obsidian', () => {
  test('loads from the copied vault without uncaught or plugin console errors', async ({ obsidian }) => {
    const state = await obsidian.eval(({ app, pluginId }) => ({
      enabled: app.plugins.enabledPlugins.has(pluginId),
      loaded: Boolean(app.plugins.plugins[pluginId]?._loaded),
      version: app.plugins.manifests[pluginId]?.version,
      vault: app.vault.getName(),
      notes: app.vault.getMarkdownFiles().map(file => file.path).sort(),
    }));
    expect(state).toMatchObject({ enabled: true, loaded: true, version: obsidian.manifest.version });
    expect(state.notes).toEqual(['Notes/Example.md', 'Welcome.md']);
    // Late async failures from onload/layout-ready work surface here too.
    await new Promise(ok => setTimeout(ok, 1000));
    expect(obsidian.errors().map(entry => `${entry.text}\n${entry.stack}`)).toEqual([]);
  });
});
