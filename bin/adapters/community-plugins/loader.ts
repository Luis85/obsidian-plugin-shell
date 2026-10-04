import { createRequire } from 'node:module';
import { join } from 'node:path';
import { compileFunction } from 'node:vm';
import { OperationError, requireThat } from '../framework/contracts.ts';
import { readBounded } from '../framework/files.ts';
import { bindPlugin, Plugin, pluginApi, type Cleanup, type PluginBinding } from './plugin.ts';
import { createApp, type AppHost, type AppSession, type WorkbenchApp } from './app-api.ts';
import { pluginsLoaded } from './app-events.ts';
import { isLoadable, type CommunityPluginInventory } from './discovery.ts';
import type { CommunityPluginManifest } from '../../domain/community-plugin.ts';
import type { PluginCliCommand, PluginTuiAction, WorkbenchPluginObject } from '../../../plugins/api.ts';

export interface CommunityPluginFailure { readonly id: string; readonly code: string; readonly message: string }
export interface CommunityPluginHost {
  /** Loaded plugins adapted to the invocation runtime: one CLI root per plugin plus its Studio actions. */
  readonly plugins: readonly WorkbenchPluginObject[];
  readonly failures: readonly CommunityPluginFailure[];
  /** Runs every cleanup and onunload in reverse load order; idempotent, and one failure does not skip the rest. */
  unload(): Promise<void>;
}
interface Loaded { manifest: CommunityPluginManifest; instance: Plugin; binding: PluginBinding }
type PluginClass = new (app: WorkbenchApp, manifest: CommunityPluginManifest) => Plugin;

const codeOf = (error: unknown): string => error instanceof OperationError ? error.code : /^([A-Z][A-Z_0-9]+):/.exec(error instanceof Error ? error.message : '')?.[1] ?? 'COMMUNITY_PLUGIN_LOAD_FAILED';
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : 'Plugin failed to load.').slice(0, 500);

/** main.js is a CommonJS module, as an Obsidian plugin bundle is; `require('workbench')` resolves to the plugin API. */
async function pluginClass(directory: string): Promise<PluginClass> {
  const filename = join(directory, 'main.js');
  const source = (await readBounded(filename, 8_000_000)).toString('utf8');
  const module: { exports: unknown } = { exports: {} };
  const local = createRequire(filename);
  const load = (specifier: string): unknown => specifier === 'workbench' ? pluginApi : local(specifier);
  compileFunction(source, ['exports', 'require', 'module', '__filename', '__dirname'], { filename })
    .call(module.exports, module.exports, load, module, filename, directory);
  const exported = module.exports as { default?: unknown } | undefined;
  const candidate = typeof exported === 'function' ? exported : exported?.default;
  requireThat(typeof candidate === 'function' && candidate.prototype instanceof Plugin, 'COMMUNITY_PLUGIN_EXPORT_INVALID',
    'main.js must export a class extending Plugin from require(\'workbench\').');
  return candidate as PluginClass;
}
async function runCleanups(entry: Loaded, includeUnload: boolean): Promise<unknown> {
  let failure: unknown;
  for (const cleanup of entry.binding.cleanups.splice(0).reverse()) {
    try { await cleanup(); } catch (error) { failure ??= error; }
  }
  if (includeUnload) try { await entry.instance.onunload(); } catch (error) { failure ??= error; }
  return failure;
}
function unionOptions(binding: PluginBinding): PluginCliCommand['options'] {
  const booleans = new Set<string>(), values = new Set<string>();
  for (const command of binding.commands.values()) {
    for (const name of command.options?.booleans ?? []) booleans.add(name);
    for (const name of command.options?.values ?? []) values.add(name);
  }
  return { booleans: [...booleans], values: [...values] };
}
/** `node bin/app <plugin-id> <command-id>` runs one command; without a command it lists them. */
function cliRoot({ manifest, binding }: Loaded): PluginCliCommand {
  const listing = () => [...binding.commands.values()].map(command => ({ id: command.id, name: command.name }));
  return Object.freeze({
    id: manifest.id,
    summary: `${manifest.name} ${manifest.version} (bin/plugins/${manifest.id}): ${listing().map(command => command.id).join(', ') || 'no commands'}`,
    options: unionOptions(binding),
    async execute(request, context) {
      if (!request.action) return { plugin: manifest.id, version: manifest.version, commands: listing() };
      const command = binding.commands.get(request.action);
      if (!command) throw new OperationError('COMMUNITY_PLUGIN_COMMAND_UNKNOWN', `${manifest.id} has no command ${request.action}.`, `node bin/app ${manifest.id}`);
      const data = await command.execute({ flags: request.flags }, context);
      requireThat(data !== null && typeof data === 'object' && !Array.isArray(data), 'COMMUNITY_PLUGIN_RESULT_INVALID', `${manifest.id} ${command.id} must return an object.`);
      return data;
    },
  } satisfies PluginCliCommand);
}
function adapt(entry: Loaded): WorkbenchPluginObject {
  const { manifest, binding } = entry;
  const tui: PluginTuiAction[] = [...binding.actions.values()].map(action => Object.freeze({
    id: `${manifest.id}-${action.id}`, label: `${manifest.name}: ${action.label}`, run: action.run.bind(action),
  }));
  return Object.freeze({
    manifest: Object.freeze({ id: manifest.id, name: manifest.name, version: manifest.version, description: manifest.description }),
    config: Object.freeze({ enabled: true }),
    cli: Object.freeze([cliRoot(entry)]),
    tui: Object.freeze(tui),
  });
}
async function loadOne(directory: string, manifest: CommunityPluginManifest, host: AppHost): Promise<Loaded> {
  const Constructor = await pluginClass(directory);
  const cleanups: Cleanup[] = [];
  const instance = new Constructor(createApp(host, manifest, cleanup => cleanups.push(cleanup)), manifest);
  requireThat(instance instanceof Plugin, 'COMMUNITY_PLUGIN_EXPORT_INVALID', 'The plugin constructor must return its Plugin instance.');
  const entry: Loaded = { manifest, instance, binding: bindPlugin(instance, directory, cleanups) };
  try { await entry.instance.onload(); } catch (error) { await runCleanups(entry, false); throw error; }
  return entry;
}

/**
 * Loads every enabled, valid plugin of an inventory in enable order (Obsidian's startup). One failing plugin is
 * reported and skipped; it never stops the others or the app.
 */
export async function loadCommunityPlugins(inventory: CommunityPluginInventory, frameworkRoot: string, session: AppSession): Promise<CommunityPluginHost> {
  // The host extends the live session object, so `this.app.root` follows the root parsed after loading.
  const host: AppHost = Object.assign(session, { frameworkRoot, version: inventory.appVersion, loaded: new Map() });
  const byId = new Map(inventory.plugins.filter(isLoadable).map(plugin => [plugin.id, plugin]));
  const loaded: Loaded[] = [], failures: CommunityPluginFailure[] = [];
  for (const id of inventory.enabled) {
    const plugin = byId.get(id);
    if (!plugin) continue;
    try {
      const entry = await loadOne(plugin.directory, plugin.manifest, host);
      loaded.push(entry);
      host.loaded.set(id, { manifest: entry.manifest, instance: entry.instance });
    } catch (error) { failures.push({ id, code: codeOf(error), message: messageOf(error) }); }
  }
  session.bus.dispatch(pluginsLoaded, { plugins: loaded.map(entry => entry.manifest.id) });
  let unloaded = false;
  return Object.freeze({
    plugins: Object.freeze(loaded.map(adapt)),
    failures: Object.freeze(failures),
    async unload() {
      if (unloaded) return;
      unloaded = true;
      let failure: unknown;
      for (const entry of [...loaded].reverse()) {
        const error = await runCleanups(entry, true);
        failure ??= error;
      }
      if (failure) throw failure;
    },
  });
}
