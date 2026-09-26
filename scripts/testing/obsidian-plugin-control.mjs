/** In-page control of one community plugin through Obsidian's own plugin manager.
 * These call the host's plugin lifecycle; they never edit other plugins or settings. */
function pluginState(page, id) {
  return page.evaluate(pluginId => {
    const plugins = window.app.plugins;
    const instance = plugins.plugins[pluginId];
    return { installed: Boolean(plugins.manifests[pluginId]), enabled: plugins.enabledPlugins.has(pluginId),
      loaded: Boolean(instance && instance._loaded), version: plugins.manifests[pluginId]?.version ?? null };
  }, id);
}
/** Poll the host state; `required: false` returns the last state instead of throwing on timeout. */
async function waitForPlugin(page, id, { loaded = true, timeout = 30000, required = true } = {}) {
  const deadline = Date.now() + timeout; let state;
  while (Date.now() < deadline) {
    state = await pluginState(page, id);
    if (state.loaded === loaded) return state;
    await new Promise(ok => setTimeout(ok, 100));
  }
  if (!required) return state;
  throw new Error(`OBSIDIAN_PLUGIN_${loaded ? 'LOAD' : 'UNLOAD'}_TIMEOUT: ${id} ${JSON.stringify(state)}`);
}
/** Enable for this vault (persisted in its community-plugins.json) and wait for onload to finish.
 * View types are attributed by the `plugin:<id>` script frame of each registerView call, so core
 * plugins registering concurrently are never mistaken for this plugin's views. */
export async function enablePlugin(page, id, options) {
  const started = Date.now();
  await page.waitForFunction(() => window.app?.workspace?.layoutReady === true, undefined, { timeout: options?.timeout ?? 30000 });
  const registered = await page.evaluate(async pluginId => {
    const registry = window.app.viewRegistry; const original = registry.registerView; const types = [];
    registry.registerView = function (type, ...rest) {
      if ((new Error().stack ?? '').includes(`plugin:${encodeURIComponent(pluginId)}`)) types.push(type);
      return original.call(this, type, ...rest);
    };
    try {
      await window.app.plugins.loadManifests();
      if (!await window.app.plugins.enablePluginAndSave(pluginId)) throw new Error(`OBSIDIAN_PLUGIN_ENABLE_REFUSED: ${pluginId}`);
    } finally { registry.registerView = original; }
    return types;
  }, id);
  const state = await waitForPlugin(page, id, options);
  return { ...state, durationMs: Date.now() - started, viewTypes: [...new Set(registered)].sort() };
}
/** Hot reload: disable then enable re-reads main.js/styles.css from the vault plugin folder. */
export async function reloadPlugin(page, id, options) {
  const started = Date.now(); let error = null;
  try {
    await page.evaluate(async pluginId => {
      const plugins = window.app.plugins;
      await plugins.disablePlugin(pluginId);
      await plugins.loadManifests();
      await plugins.enablePlugin(pluginId);
    }, id);
  } catch (failure) { if (options?.required !== false) throw failure; error = failure.message; }
  const state = await waitForPlugin(page, id, options);
  return { ...state, durationMs: Date.now() - started, error };
}
export async function disablePlugin(page, id, options) {
  await page.evaluate(pluginId => window.app.plugins.disablePlugin(pluginId), id);
  return waitForPlugin(page, id, { ...options, loaded: false });
}
export function pluginCommands(page, id) {
  return page.evaluate(pluginId => window.app.commands.listCommands()
    .filter(command => command.id.startsWith(`${pluginId}:`))
    .map(command => ({ id: command.id, name: command.name }))
    .sort((a, b) => a.id.localeCompare(b.id)), id);
}
export async function executeCommand(page, id) {
  const executed = await page.evaluate(commandId => window.app.commands.executeCommandById(commandId), id);
  if (!executed) throw new Error(`OBSIDIAN_COMMAND_NOT_EXECUTED: ${id}`);
}
