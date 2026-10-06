import { join } from 'node:path';
import { createFilePlan, type FilePlan } from '#shared/platform/file-plan.ts';
import { serializeJson } from '#shared/contracts/serialization.ts';
import { parseJsonData } from '#shared/contracts/json-data.ts';
import { pluginRegistry } from '../../sdk/registry.ts';
import { OperationError, requireThat, result, type Context, type Request, type Result } from '../framework/contracts.ts';
import { readBounded } from '../framework/files.ts';
import { didYouMean, suggestions } from '../framework/suggest.ts';
import { communityPluginsFolder, enabledListFile, isSettingsDocument, withEnabled } from '../../domain/community-plugin.ts';
import { communityInventory } from './inventory.ts';
import type { CommunityPluginInventory, InstalledCommunityPlugin } from './discovery.ts';

const listPath = `${communityPluginsFolder}/${enabledListFile}`;
const trust = 'An enabled plugin\'s main.js runs with your user permissions whenever bin/app loads plugins (Studio, makers and plugin commands). Review it before enabling; plugins are not sandboxed.';
function status(plugin: InstalledCommunityPlugin): 'enabled' | 'disabled' | 'invalid' {
  if (plugin.issues.length) return 'invalid';
  return plugin.enabled ? 'enabled' : 'disabled';
}
function entry(plugin: InstalledCommunityPlugin) {
  return { id: plugin.id, ...plugin.manifest, folder: `${communityPluginsFolder}/${plugin.id}`, enabled: plugin.enabled, status: status(plugin), issues: plugin.issues };
}
/** Bundled Workbench plugins are compiled into the app (Obsidian's core plugins); their switch is their config.json. */
const bundled = () => pluginRegistry.map(plugin => ({ id: plugin.manifest.id, name: plugin.manifest.name, version: plugin.manifest.version, enabled: plugin.config.enabled !== false }));
function selected(inventory: CommunityPluginInventory, id: string | undefined): InstalledCommunityPlugin | undefined {
  requireThat(id, 'PLUGIN_ID_REQUIRED', 'Supply a plugin ID; list them with: node bin/app plugins list');
  return inventory.plugins.find(plugin => plugin.id === id);
}
function unknown(inventory: CommunityPluginInventory, id: string): OperationError {
  const found = suggestions(id, inventory.plugins.map(plugin => plugin.id));
  return new OperationError('COMMUNITY_PLUGIN_UNKNOWN', `No plugin ${id} is installed in ${communityPluginsFolder}.${didYouMean(found, value => `"${value}"`)}`, 'node bin/app plugins list');
}
/** The current settings.json, or null when it is missing or invalid (the issues say why). */
async function settingsOf(plugin: InstalledCommunityPlugin): Promise<unknown> {
  try {
    const value = parseJsonData(new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(join(plugin.directory, 'settings.json'))));
    return isSettingsDocument(value) ? value : null;
  } catch { return null; }
}

/** plugins list / plugins show: manifests, enabled state, settings and issues. Never imports or runs main.js. */
export async function pluginsRead(request: Request, context: Context): Promise<Result> {
  const inventory = await communityInventory(context.frameworkRoot);
  if (request.command === 'plugins show') {
    const plugin = selected(inventory, request.args[0]);
    if (!plugin) throw unknown(inventory, request.args[0]!);
    return result(request.command, { ...entry(plugin), settings: await settingsOf(plugin), execution: 'not-run' });
  }
  return result(request.command, {
    directory: communityPluginsFolder, enabledList: listPath, appVersion: inventory.appVersion,
    plugins: inventory.plugins.map(entry), bundled: bundled(), issues: inventory.issues, execution: 'not-run',
  });
}

/** plugins enable / plugins disable: a reviewed plan that rewrites only bin/plugins/community-plugins.json. */
export async function communityPluginPlan(request: Request, context: Context): Promise<{ plan: FilePlan; summary: unknown; conflicts: string[] }> {
  const inventory = await communityInventory(context.frameworkRoot);
  const id = request.args[0], enable = request.command === 'plugins enable';
  const plugin = selected(inventory, id);
  const listIssue = inventory.issues.find(issue => issue.code === 'COMMUNITY_PLUGINS_LIST_INVALID');
  if (listIssue) throw new OperationError(listIssue.code, listIssue.message, `Repair or remove ${listPath}; it is never overwritten while unreadable.`);
  if (enable) {
    if (!plugin) throw unknown(inventory, id!);
    const problem = plugin.issues[0];
    if (problem) throw new OperationError(problem.code, `${plugin.id} cannot be enabled: ${problem.message}`, `node bin/app plugins show ${plugin.id}`);
  } else if (!plugin && !inventory.enabled.includes(id!)) throw unknown(inventory, id!);
  const ids = withEnabled(inventory.enabled, id!, enable);
  const plan = await createFilePlan(context.frameworkRoot, [{ path: listPath, content: serializeJson(ids) }]);
  return { plan, conflicts: [], summary: { plugin: id, enabled: enable, enabledList: ids, loads: 'from the next bin/app invocation', ...(enable ? { trust } : {}) } };
}
