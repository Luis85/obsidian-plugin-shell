import { join } from 'node:path';
import { applyFilePlan, createFilePlan } from '../../../scripts/shared/file-plan.ts';
import { serializeJson } from '../../../scripts/contracts/serialization.ts';
import { assertJsonData, parseJsonData } from '../../../scripts/contracts/json-data.ts';
import { OperationError, requireThat } from '../framework/contracts.ts';
import { readBounded } from '../framework/files.ts';
import { isCommunityPluginId, isSettingsDocument, type CommunityPluginManifest } from '../../domain/community-plugin.ts';
import type { PluginCommandContext, PluginTuiContext } from '../../../plugins/api.ts';

/** What `this.app` exposes to an app plugin: the running app, not a project. Project roots arrive per command. */
export interface CommunityApp {
  readonly version: string;
  readonly frameworkRoot: string;
}
export interface CommunityCommandRequest { readonly flags: Readonly<Record<string, string | boolean>> }
/** One CLI command: `node bin/app <plugin-id> <command-id> [--flags]`, like an Obsidian palette command. */
export interface CommunityCommand {
  readonly id: string;
  readonly name: string;
  readonly options?: { readonly booleans?: readonly string[]; readonly values?: readonly string[] };
  execute(request: CommunityCommandRequest, context: PluginCommandContext): Record<string, unknown> | Promise<Record<string, unknown>>;
}
/** One Studio/TUI menu action, the terminal counterpart of a ribbon or palette entry. */
export interface CommunityStudioAction {
  readonly id: string;
  readonly label: string;
  run(context: PluginTuiContext): void | Promise<void>;
}
type Cleanup = () => void | Promise<void>;
export interface PluginBinding {
  readonly directory: string;
  readonly commands: Map<string, CommunityCommand>;
  readonly actions: Map<string, CommunityStudioAction>;
  readonly cleanups: Cleanup[];
  saving: Promise<void>;
}
const bindings = new WeakMap<Plugin, PluginBinding>();
function binding(plugin: Plugin): PluginBinding {
  const bound = bindings.get(plugin);
  if (!bound) throw new OperationError('COMMUNITY_PLUGIN_NOT_LOADED', 'Plugin methods are available once the app has loaded the plugin.');
  return bound;
}
export function bindPlugin(plugin: Plugin, directory: string): PluginBinding {
  const bound: PluginBinding = { directory, commands: new Map(), actions: new Map(), cleanups: [], saving: Promise.resolve() };
  bindings.set(plugin, bound);
  return bound;
}
async function readSettings(directory: string): Promise<Record<string, unknown>> {
  let value: unknown;
  try { value = parseJsonData(new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(join(directory, 'settings.json')))); } catch { value = undefined; }
  requireThat(isSettingsDocument(value), 'COMMUNITY_PLUGIN_SETTINGS_INVALID', 'settings.json must be a readable JSON object.');
  return value;
}

/**
 * Base class every app plugin extends, after Obsidian's Plugin: the app constructs it with (app, manifest), calls
 * onload() when the plugin is enabled and onunload() when the invocation ends. main.js gets it through
 * `require('workbench')`. Plugin code is trusted code running with the user's permissions; this is not a sandbox.
 */
export class Plugin {
  readonly app: CommunityApp;
  readonly manifest: CommunityPluginManifest;
  constructor(app: CommunityApp, manifest: CommunityPluginManifest) {
    this.app = app;
    this.manifest = manifest;
  }
  /** Register commands, actions and cleanups here. */
  onload(): void | Promise<void> {}
  /** Runs after registered cleanups, in reverse load order. */
  onunload(): void | Promise<void> {}
  /** The plugin's settings.json as a fresh object (Obsidian: loadData over data.json). */
  async loadData(): Promise<Record<string, unknown>> {
    return readSettings(binding(this).directory);
  }
  /** Replaces settings.json with a JSON object through the shared atomic file-plan writer; saves run one at a time. */
  async saveData(data: unknown): Promise<void> {
    const bound = binding(this);
    requireThat(isSettingsDocument(data), 'COMMUNITY_PLUGIN_SETTINGS_INVALID', 'saveData accepts a plain JSON object.');
    assertJsonData(data);
    const content = serializeJson(data);
    const write = bound.saving.then(async () => { await applyFilePlan(await createFilePlan(bound.directory, [{ path: 'settings.json', content }])); });
    bound.saving = write.catch(() => undefined);
    await write;
  }
  addCommand(command: CommunityCommand): CommunityCommand {
    const { commands } = binding(this);
    requireThat(isCommunityPluginId(command?.id) && typeof command.name === 'string' && command.name.trim() && typeof command.execute === 'function',
      'COMMUNITY_PLUGIN_COMMAND_INVALID', 'A command needs a kebab-case id, a name and an execute function.');
    requireThat(!commands.has(command.id), 'COMMUNITY_PLUGIN_COMMAND_DUPLICATE', `Command ${command.id} is already registered.`);
    commands.set(command.id, command);
    return command;
  }
  addStudioAction(action: CommunityStudioAction): CommunityStudioAction {
    const { actions } = binding(this);
    requireThat(isCommunityPluginId(action?.id) && typeof action.label === 'string' && action.label.trim() && typeof action.run === 'function',
      'COMMUNITY_PLUGIN_ACTION_INVALID', 'A Studio action needs a kebab-case id, a label and a run function.');
    requireThat(!actions.has(action.id), 'COMMUNITY_PLUGIN_ACTION_DUPLICATE', `Studio action ${action.id} is already registered.`);
    actions.set(action.id, action);
    return action;
  }
  /** A cleanup run when the plugin unloads (Obsidian: this.register). */
  register(cleanup: Cleanup): void {
    requireThat(typeof cleanup === 'function', 'COMMUNITY_PLUGIN_CLEANUP_INVALID', 'register accepts a function.');
    binding(this).cleanups.push(cleanup);
  }
}
/** The module main.js receives from require('workbench'). */
export const pluginApi = Object.freeze({ apiVersion: 1, Plugin });
