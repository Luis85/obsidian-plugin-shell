import { pluginRegistry } from '../../../../plugins/registry.ts';
import { commands as frameworkCommands } from '../framework/catalog.ts';
import { makerCommandIds } from '../../domain/command-options.ts';
import { discoverCommunityPlugins, frameworkVersion, isLoadable, type CommunityPluginInventory } from './discovery.ts';
import { loadCommunityPlugins, type CommunityPluginHost } from './loader.ts';
import type { WorkbenchPluginObject } from '../../../../plugins/api.ts';
import type { AppSession } from './app-api.ts';

/** IDs an app plugin can never take, so `node bin/app <id>` stays unambiguous: every built-in root and bundled plugin. */
function reservedCommunityIds(registry: readonly WorkbenchPluginObject[] = pluginRegistry): ReadonlySet<string> {
  return new Set([
    ...makerCommandIds, 'memory', 'help', 'app',
    ...frameworkCommands.map(command => command.id.split(' ')[0]!),
    ...registry.flatMap(plugin => [plugin.manifest.id, ...(plugin.cli ?? []).map(command => command.id)]),
  ]);
}
export async function communityInventory(frameworkRoot: string): Promise<CommunityPluginInventory> {
  return discoverCommunityPlugins(frameworkRoot, { reserved: reservedCommunityIds(), appVersion: await frameworkVersion(frameworkRoot) });
}
export interface CommunityRoutes {
  /** Enabled, valid plugin IDs: CLI roots routed to the maker surface. */
  readonly enabled: readonly string[];
  /** Installed plugins that will not load, with the reason and the next step, keyed by ID. */
  readonly inactive: ReadonlyMap<string, string>;
}
/** Routing facts from manifests only; nothing is imported or executed. */
export function communityRoutes(inventory: CommunityPluginInventory): CommunityRoutes {
  const inactive = new Map<string, string>();
  // A folder squatting on a built-in root never shadows it; plugins list reports it instead.
  const routable = inventory.plugins.filter(entry => !isLoadable(entry) && !entry.issues.some(issue => issue.code === 'COMMUNITY_PLUGIN_ID_RESERVED'));
  for (const plugin of routable) inactive.set(plugin.id, plugin.issues[0]
    ? `bin/plugins/${plugin.id} cannot load: ${plugin.issues[0].message} Inspect it with: node bin/app plugins show ${plugin.id}`
    : `bin/plugins/${plugin.id} is installed but disabled. Review its main.js, then enable it with: node bin/app plugins enable ${plugin.id}`);
  return { enabled: inventory.plugins.filter(isLoadable).map(plugin => plugin.id), inactive };
}
/**
 * Discovers and loads the app plugins for one invocation. Discovery problems and load failures are reported through
 * `report` (stderr) and never stop the app: a broken plugin is skipped, as Obsidian skips a plugin that fails to load.
 */
export async function openCommunityPlugins(frameworkRoot: string, session: AppSession): Promise<CommunityPluginHost> {
  const report = session.report;
  let inventory: CommunityPluginInventory;
  try { inventory = await communityInventory(frameworkRoot); } catch {
    report('COMMUNITY_PLUGINS_UNREADABLE: bin/plugins could not be read; no app plugins were loaded.\n');
    return loadCommunityPlugins({ directory: '', appVersion: '0.0.0', enabled: [], plugins: [], issues: [] }, frameworkRoot, session);
  }
  for (const issue of inventory.issues) report(`${issue.code}: ${issue.message}\n`);
  for (const plugin of inventory.plugins.filter(entry => entry.enabled && entry.issues.length))
    report(`${plugin.issues[0]!.code}: bin/plugins/${plugin.id} is enabled but not loaded: ${plugin.issues[0]!.message}\n`);
  const host = await loadCommunityPlugins(inventory, frameworkRoot, session);
  for (const failure of host.failures) report(`${failure.code}: bin/plugins/${failure.id} failed to load: ${failure.message}\n`);
  return host;
}
