/**
 * App plugins installed under bin/plugins/<id>/, modelled on Obsidian community plugins: each folder brings main.js,
 * manifest.json and settings.json, and bin/plugins/community-plugins.json lists the enabled IDs in enable order.
 * Pure validation only; reading folders and executing main.js belong to the adapters.
 */
export interface CommunityPluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly minAppVersion: string;
  readonly description: string;
  readonly author: string;
  readonly authorUrl?: string;
}
export interface CommunityPluginIssue { readonly code: string; readonly message: string }

export const communityPluginsFolder = 'bin/plugins';
export const enabledListFile = 'community-plugins.json';
/** At most this many installed folders or enabled IDs are considered; more is refused, not silently truncated. */
export const communityPluginLimit = 256;

const identifier = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const semver = /^(\d{1,6})\.(\d{1,6})\.(\d{1,6})$/;
export const isCommunityPluginId = (value: unknown): value is string => typeof value === 'string' && value.length <= 64 && identifier.test(value);
const plainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const text = (value: unknown, limit: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;

/** Numeric x.y.z ordering; callers validate both operands first. */
export function compareVersions(left: string, right: string): number {
  const a = semver.exec(left)!.slice(1).map(Number), b = semver.exec(right)!.slice(1).map(Number);
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index]! < b[index]! ? -1 : 1;
  return 0;
}
const isVersion = (value: unknown): value is string => typeof value === 'string' && semver.test(value);

const issue = (code: string, message: string): CommunityPluginIssue => ({ code, message });
type Fields = { manifest: Record<string, unknown>; issues: CommunityPluginIssue[] };
function requiredFields({ manifest, issues }: Fields, folder: string): void {
  if (!isCommunityPluginId(manifest.id)) issues.push(issue('COMMUNITY_PLUGIN_MANIFEST_INVALID', 'id must be a lowercase kebab-case identifier of at most 64 characters.'));
  else if (manifest.id !== folder) issues.push(issue('COMMUNITY_PLUGIN_ID_MISMATCH', `manifest id ${manifest.id} differs from its folder ${folder}.`));
  for (const [key, limit] of [['name', 100], ['description', 500], ['author', 100]] as const)
    if (!text(manifest[key], limit)) issues.push(issue('COMMUNITY_PLUGIN_MANIFEST_INVALID', `${key} must be a non-empty string of at most ${limit} characters.`));
  for (const key of ['version', 'minAppVersion'])
    if (!isVersion(manifest[key])) issues.push(issue('COMMUNITY_PLUGIN_MANIFEST_INVALID', `${key} must be an x.y.z version.`));
  if (manifest.authorUrl !== undefined && !(text(manifest.authorUrl, 500) && manifest.authorUrl.startsWith('https://')))
    issues.push(issue('COMMUNITY_PLUGIN_MANIFEST_INVALID', 'authorUrl must be an https URL when present.'));
}
/**
 * Validates manifest.json against its folder and the running app version. Unknown Obsidian fields (fundingUrl,
 * isDesktopOnly) are tolerated and dropped; the returned manifest holds only the declared contract.
 */
export function validateCommunityManifest(value: unknown, folder: string, appVersion: string): { manifest?: CommunityPluginManifest; issues: CommunityPluginIssue[] } {
  if (!plainObject(value)) return { issues: [issue('COMMUNITY_PLUGIN_MANIFEST_INVALID', 'manifest.json must be a JSON object.')] };
  const fields: Fields = { manifest: value, issues: [] };
  requiredFields(fields, folder);
  if (fields.issues.length) return { issues: fields.issues };
  const manifest = Object.freeze({
    id: value.id as string, name: value.name as string, version: value.version as string, minAppVersion: value.minAppVersion as string,
    description: value.description as string, author: value.author as string,
    ...(typeof value.authorUrl === 'string' ? { authorUrl: value.authorUrl } : {}),
  });
  const issues = isVersion(appVersion) && compareVersions(manifest.minAppVersion, appVersion) > 0
    ? [issue('COMMUNITY_PLUGIN_APP_VERSION', `${manifest.id} requires app ${manifest.minAppVersion}; this app is ${appVersion}.`)] : [];
  return { manifest, issues };
}

/** The enabled list is a JSON array of unique plugin IDs (Obsidian's community-plugins.json shape). */
export function validateEnabledList(value: unknown): { ids: string[]; issues: CommunityPluginIssue[] } {
  const invalid = (message: string) => ({ ids: [], issues: [issue('COMMUNITY_PLUGINS_LIST_INVALID', message)] });
  if (!Array.isArray(value)) return invalid(`${enabledListFile} must be a JSON array of plugin IDs.`);
  if (value.length > communityPluginLimit) return invalid(`${enabledListFile} lists more than ${communityPluginLimit} plugins.`);
  if (!value.every(isCommunityPluginId)) return invalid(`${enabledListFile} must contain only plugin IDs.`);
  if (new Set(value).size !== value.length) return invalid(`${enabledListFile} lists a plugin more than once.`);
  return { ids: [...value], issues: [] };
}

/** settings.json is the plugin's own JSON object (Obsidian's data.json); its fields are plugin-defined. */
export function isSettingsDocument(value: unknown): value is Record<string, unknown> {
  return plainObject(value);
}

/** Enabling appends (enable order is load order); disabling removes. Both are idempotent. */
export function withEnabled(ids: readonly string[], id: string, enabled: boolean): string[] {
  if (!enabled) return ids.filter(item => item !== id);
  return ids.includes(id) ? [...ids] : [...ids, id];
}
