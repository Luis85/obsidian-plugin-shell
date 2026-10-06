import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { exists, readBounded } from '../framework/files.ts';
import { parseJsonData } from '#shared/contracts/json-data.ts';
import {
  communityPluginLimit, communityPluginsFolder, enabledListFile, isCommunityPluginId, isSettingsDocument, validateCommunityManifest,
  validateEnabledList, type CommunityPluginIssue, type CommunityPluginManifest,
} from '../../domain/community-plugin.ts';

export interface InstalledCommunityPlugin {
  readonly id: string;
  readonly directory: string;
  readonly manifest?: CommunityPluginManifest;
  readonly enabled: boolean;
  readonly issues: readonly CommunityPluginIssue[];
}
export interface CommunityPluginInventory {
  /** Absolute bin/plugins folder of this app installation. */
  readonly directory: string;
  readonly appVersion: string;
  readonly enabled: readonly string[];
  readonly plugins: readonly InstalledCommunityPlugin[];
  /** Folder- or list-level problems that are not owned by one installed plugin. */
  readonly issues: readonly CommunityPluginIssue[];
}
export interface DiscoveryOptions {
  /** IDs a plugin may not take: built-in command roots and bundled Workbench plugins. */
  readonly reserved: ReadonlySet<string>;
  readonly appVersion: string;
}
const mainLimit = 8_000_000, jsonLimit = 1_048_576;
const issue = (code: string, message: string): CommunityPluginIssue => ({ code, message });
export const isLoadable = (plugin: InstalledCommunityPlugin): plugin is InstalledCommunityPlugin & { manifest: CommunityPluginManifest } =>
  plugin.enabled && plugin.manifest !== undefined && plugin.issues.length === 0;
const pluginsDirectory = (frameworkRoot: string): string => join(frameworkRoot, ...communityPluginsFolder.split('/'));

async function jsonFile(path: string, limit = jsonLimit): Promise<{ value?: unknown; error?: string }> {
  try {
    return { value: parseJsonData(new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(path, limit))) };
  } catch (error) { return { error: error instanceof Error ? error.message : 'unreadable' }; }
}
/** The version minAppVersion is compared with: the kit inventory in a compiled kit, package.json in a checkout. */
export async function frameworkVersion(frameworkRoot: string): Promise<string> {
  const kit = await exists(join(frameworkRoot, 'bin/kit.json'));
  const { value } = await jsonFile(join(frameworkRoot, kit ? 'bin/kit.json' : 'package.json'), 8_000_000);
  const version = value && typeof value === 'object' ? (value as { version?: unknown }).version : undefined;
  return typeof version === 'string' ? version : '0.0.0';
}
/** A missing list means nothing is enabled. A corrupt list is reported and enables nothing; it is never rewritten silently. */
async function readEnabledList(frameworkRoot: string): Promise<{ ids: string[]; issues: CommunityPluginIssue[] }> {
  const path = join(pluginsDirectory(frameworkRoot), enabledListFile);
  if (!await exists(path)) return { ids: [], issues: [] };
  const { value, error } = await jsonFile(path);
  return error ? { ids: [], issues: [issue('COMMUNITY_PLUGINS_LIST_INVALID', `${enabledListFile}: ${error}`)] } : validateEnabledList(value);
}
async function regularFile(path: string, name: string, limit: number): Promise<CommunityPluginIssue | undefined> {
  const stat = await lstat(path).catch(() => undefined);
  if (!stat) return issue('COMMUNITY_PLUGIN_FILE_MISSING', `${name} is missing.`);
  if (!stat.isFile()) return issue('COMMUNITY_PLUGIN_FILE_INVALID', `${name} must be a regular file, not a link or folder.`);
  return stat.size > limit ? issue('COMMUNITY_PLUGIN_FILE_INVALID', `${name} exceeds ${limit} bytes.`) : undefined;
}
async function settingsIssue(directory: string): Promise<CommunityPluginIssue | undefined> {
  const file = await regularFile(join(directory, 'settings.json'), 'settings.json', jsonLimit);
  if (file) return file;
  const { value, error } = await jsonFile(join(directory, 'settings.json'));
  if (error) return issue('COMMUNITY_PLUGIN_SETTINGS_INVALID', `settings.json: ${error}`);
  return isSettingsDocument(value) ? undefined : issue('COMMUNITY_PLUGIN_SETTINGS_INVALID', 'settings.json must be a JSON object.');
}
async function manifestOf(directory: string, folder: string, appVersion: string): Promise<{ manifest?: CommunityPluginManifest; issues: CommunityPluginIssue[] }> {
  const file = await regularFile(join(directory, 'manifest.json'), 'manifest.json', 65_536);
  if (file) return { issues: [file] };
  const { value, error } = await jsonFile(join(directory, 'manifest.json'), 65_536);
  return error ? { issues: [issue('COMMUNITY_PLUGIN_MANIFEST_INVALID', `manifest.json: ${error}`)] } : validateCommunityManifest(value, folder, appVersion);
}
/** Reads one plugin folder without executing it: manifest, main.js presence/size and settings.json shape. */
async function inspectFolder(directory: string, folder: string, enabled: boolean, options: DiscoveryOptions): Promise<InstalledCommunityPlugin> {
  if (!isCommunityPluginId(folder)) return { id: folder, directory, enabled, issues: [issue('COMMUNITY_PLUGIN_ID_INVALID', 'Plugin folders use a lowercase kebab-case ID of at most 64 characters.')] };
  const { manifest, issues } = await manifestOf(directory, folder, options.appVersion);
  if (options.reserved.has(folder)) issues.push(issue('COMMUNITY_PLUGIN_ID_RESERVED', `${folder} is a built-in command or bundled plugin ID.`));
  const main = await regularFile(join(directory, 'main.js'), 'main.js', mainLimit);
  const settings = await settingsIssue(directory);
  for (const found of [main, settings]) if (found) issues.push(found);
  return { id: folder, directory, enabled, issues, ...(manifest ? { manifest } : {}) };
}
/** A folder is an app plugin when it brings manifest.json or main.js; bundled plugin config folders bring neither. */
async function pluginFolder(directory: string): Promise<boolean> {
  return await exists(join(directory, 'manifest.json')) || await exists(join(directory, 'main.js'));
}
async function folderEntries(directory: string): Promise<{ names: string[]; issues: CommunityPluginIssue[] }> {
  const stat = await lstat(directory).catch(() => undefined);
  if (!stat) return { names: [], issues: [] };
  if (!stat.isDirectory()) return { names: [], issues: [issue('COMMUNITY_PLUGINS_FOLDER_INVALID', `${communityPluginsFolder} must be a folder, not a link or file.`)] };
  const names = (await readdir(directory)).sort();
  return names.length > communityPluginLimit + 1
    ? { names: [], issues: [issue('COMMUNITY_PLUGINS_LIMIT', `${communityPluginsFolder} holds more than ${communityPluginLimit} entries.`)] } : { names, issues: [] };
}

/** Inventory of bin/plugins. Never imports or executes main.js; that is the loader's job for enabled, valid plugins only. */
export async function discoverCommunityPlugins(frameworkRoot: string, options: DiscoveryOptions): Promise<CommunityPluginInventory> {
  const directory = pluginsDirectory(frameworkRoot);
  const listed = await readEnabledList(frameworkRoot), folder = await folderEntries(directory);
  const plugins: InstalledCommunityPlugin[] = [];
  for (const name of folder.names) {
    const path = join(directory, name), stat = await lstat(path);
    const enabled = listed.ids.includes(name);
    if (stat.isSymbolicLink()) plugins.push({ id: name, directory: path, enabled, issues: [issue('COMMUNITY_PLUGIN_LINK', 'Plugin folders must be real folders, not links.')] });
    else if (stat.isDirectory() && await pluginFolder(path)) plugins.push(await inspectFolder(path, name, enabled, options));
  }
  const installed = new Set(plugins.map(plugin => plugin.id));
  const missing = listed.ids.filter(id => !installed.has(id)).map(id => issue('COMMUNITY_PLUGIN_MISSING', `${id} is enabled but bin/plugins/${id} is not installed.`));
  return Object.freeze({ directory, appVersion: options.appVersion, enabled: Object.freeze(listed.ids), plugins: Object.freeze(plugins),
    issues: Object.freeze([...folder.issues, ...listed.issues, ...missing]) });
}
