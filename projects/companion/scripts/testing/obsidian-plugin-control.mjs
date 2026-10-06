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
/** Record the view types this plugin registers while `action` runs. Types are attributed by the
 * `plugin:<id>` script frame of each registerView call, so core plugins registering concurrently are
 * never mistaken for this plugin's views. The host method is restored even when `action` fails. */
async function capturingViews(page, id, action) {
  await page.evaluate(pluginId => {
    const registry = window.app?.viewRegistry;
    if (!registry || window.__pluginShellViews) return;
    const original = registry.registerView; const types = [];
    registry.registerView = function (type, ...rest) {
      if ((new Error().stack ?? '').includes(`plugin:${encodeURIComponent(pluginId)}`)) types.push(type);
      return original.call(this, type, ...rest);
    };
    window.__pluginShellViews = { original, types };
  }, id);
  let types = [];
  try { await action(); }
  finally {
    types = await page.evaluate(() => {
      const capture = window.__pluginShellViews;
      if (!capture) return [];
      window.app.viewRegistry.registerView = capture.original; delete window.__pluginShellViews;
      return capture.types;
    }).catch(() => []);
  }
  return [...new Set(types)];
}
/** Enable for this vault (persisted in its community-plugins.json) and wait for onload to finish. */
export async function enablePlugin(page, id, options) {
  const started = Date.now();
  await page.waitForFunction(() => window.app?.workspace?.layoutReady === true, undefined, { timeout: options?.timeout ?? 30000 });
  const registered = await capturingViews(page, id, () => page.evaluate(async pluginId => {
    await window.app.plugins.loadManifests();
    if (!await window.app.plugins.enablePluginAndSave(pluginId)) throw new Error(`OBSIDIAN_PLUGIN_ENABLE_REFUSED: ${pluginId}`);
  }, id));
  const state = await waitForPlugin(page, id, options);
  return { ...state, durationMs: Date.now() - started, viewTypes: [...registered].sort() };
}
/** Hot reload: disable then enable re-reads main.js/styles.css from the vault plugin folder.
 * The host's non-persistent disablePlugin drops the id from enabledPlugins and enablePlugin does not
 * restore it, so a persisted enablement is re-recorded (and saved) instead of silently lost.
 * `viewTypes` lists the views the fresh instance registered, in registration order. */
export async function reloadPlugin(page, id, options) {
  const started = Date.now(); let error = null; let viewTypes = [];
  try {
    viewTypes = await capturingViews(page, id, () => page.evaluate(async pluginId => {
      const plugins = window.app.plugins;
      const persisted = plugins.enabledPlugins.has(pluginId);
      await plugins.disablePlugin(pluginId);
      await plugins.loadManifests();
      if (persisted) await plugins.enablePluginAndSave(pluginId);
      else await plugins.enablePlugin(pluginId);
    }, id));
  } catch (failure) { if (options?.required !== false) throw failure; error = failure.message; }
  const state = await waitForPlugin(page, id, options);
  return { ...state, durationMs: Date.now() - started, error, viewTypes };
}
/** Show the plugin's first registered view in the main area (reusing an open leaf of that type), so a
 * screenshot shows the plugin instead of an empty tab. No registered view is not an error. */
export async function openPluginView(page, viewTypes) {
  const type = viewTypes?.[0];
  if (!type) return null;
  try {
    const shown = await page.evaluate(async viewType => {
      const workspace = window.app.workspace;
      const leaf = workspace.getLeavesOfType(viewType)[0] ?? workspace.getLeaf('tab');
      if (leaf.view?.getViewType?.() !== viewType) await leaf.setViewState({ type: viewType, active: true });
      await workspace.revealLeaf(leaf);
      workspace.setActiveLeaf(leaf, { focus: true });
      return leaf.view?.getViewType?.() ?? null;
    }, type);
    return { type, opened: shown === type, registered: viewTypes };
  } catch (error) { return { type, opened: false, registered: viewTypes, error: error.message }; }
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
