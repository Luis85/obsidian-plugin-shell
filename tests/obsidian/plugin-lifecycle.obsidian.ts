import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture';
import { writeEvidence } from './support/evidence';

describe('plugin unload and reload in real Obsidian', () => {
  test('disabling removes commands, views and plugin DOM; re-enabling restores the same leaves without errors', async ({ obsidian }) => {
    const types = obsidian.pluginViewTypes;
    for (const type of types) await obsidian.openView(type);
    const snapshot = () => obsidian.eval(({ app, pluginId }, viewTypes) => ({
      loaded: Boolean(app.plugins.plugins[pluginId]?._loaded),
      commands: app.commands.listCommands().filter(command => command.id.startsWith(`${pluginId}:`)).length,
      registeredViews: viewTypes.filter(type => type in app.viewRegistry.viewByType),
      leaves: viewTypes.reduce((total, type) => total + app.workspace.getLeavesOfType(type).length, 0),
      viewDom: viewTypes.reduce((total, type) => total + document.querySelectorAll(`.workspace-leaf-content[data-type="${type}"] .view-content > *`).length, 0),
    }), types);
    const loaded = await snapshot();
    expect(loaded).toMatchObject({ loaded: true, registeredViews: [...types], leaves: types.length });
    expect(loaded.commands).toBeGreaterThan(0);

    await obsidian.disablePlugin();
    const unloaded = await snapshot();
    // Obsidian keeps the leaves as placeholders (plugins must not detach them); plugin DOM must be gone.
    expect(unloaded).toMatchObject({ loaded: false, commands: 0, registeredViews: [], leaves: types.length, viewDom: 0 });

    const reenabled = await obsidian.enablePlugin();
    expect(reenabled.loaded).toBe(true);
    // The retained leaves are reattached, not duplicated, and render again.
    await expect.poll(snapshot).toMatchObject({ loaded: true, commands: loaded.commands, registeredViews: [...types], leaves: types.length });
    // Obsidian 1.7+ defers background tabs: a restored leaf renders when it is shown, like a user
    // selecting the tab. Load each one explicitly instead of assuming every tab is visible.
    await obsidian.eval(async ({ app }, viewTypes) => {
      for (const type of viewTypes) for (const leaf of app.workspace.getLeavesOfType(type)) await leaf.loadIfDeferred();
    }, types);
    await expect.poll(async () => (await snapshot()).viewDom >= types.length, { message: 'restored leaves render plugin DOM' }).toBe(true);
    const restored = await snapshot();
    await writeEvidence(obsidian.directory, 'lifecycle-snapshots', { loaded, unloaded, restored });
    expect(obsidian.errors()).toEqual([]);
  });
});
