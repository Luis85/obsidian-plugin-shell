import { defaultVaultConfigDirectory } from './host-paths.ts';
import { hasPortableProjectSegments, hasProtectedProjectRoot } from '../../scripts/shared/project-path.ts';
import { firstRunDefaults, firstRunPreferenceSchema, readFirstRunPreferences, type FirstRunPreferences } from './first-run.ts';
import { object, keys, text } from './data.ts';
import { requireSketch } from './errors.ts';
import { defaultDesignRoot } from './design-folder.ts';
export const settingsPath = 'configs/user-settings.json';
export const setupStatePath = 'configs/project-setup.json';
export interface UserSettings {
  schemaVersion: 1;
  /** The documentation feature owns semantic validation of this shared namespace. */
  documentation?: Record<string, unknown>;
  /** design is optional so existing settings and saved setup state keep their exact path set; designRoot resolves it. */
  paths: { prds: string; project: string; prototypes: string; app: string; brief: string; firstRunReport: string; design?: string } & { [K in CollectionPathKey]?: string };
  preferences: { author: string; ui: 'auto' | 'tui' | 'plain'; vaultConfigDirectory: string; scanRecursive: boolean; firstRun: FirstRunPreferences };
}
/**
 * Folders of the typed-note collections in configs/collections (one Markdown note per item). Like design they are
 * optional, so existing settings and saved setup state keep their exact path set; collectionRoot resolves the default.
 */
export const collectionPathDefaults = { risks: 'docs/risks' } as const;
export type CollectionPathKey = keyof typeof collectionPathDefaults;
export const collectionPathKeys = Object.keys(collectionPathDefaults) as CollectionPathKey[];
export const defaultSettings: UserSettings = {
  schemaVersion: 1,
  paths: { prds: 'docs/prds', project: 'design/project.json', prototypes: 'prototypes/project', app: 'apps/product', brief: 'docs/project-brief.md', firstRunReport: 'reports/first-run.json' },
  preferences: { author: 'Your name', ui: 'auto', vaultConfigDirectory: defaultVaultConfigDirectory, scanRecursive: true, firstRun: firstRunDefaults },
};
/** The folder that holds one Claude Design folder per prototype. */
export function designRoot(paths: UserSettings['paths']): string { return paths.design ?? defaultDesignRoot; }
/** The folder of one note collection: the configured path or its default. */
export function collectionRoot(paths: UserSettings['paths'], key: CollectionPathKey): string { return paths[key] ?? collectionPathDefaults[key]; }
/** Every configured location with the optional design and collection roots resolved, so checks see the folders the tools actually use. */
export function effectivePaths(paths: UserSettings['paths']): Required<UserSettings['paths']> {
  const collections = Object.fromEntries(collectionPathKeys.map(key => [key, collectionRoot(paths, key)])) as Record<CollectionPathKey, string>;
  return { ...paths, design: designRoot(paths), ...collections };
}
/** A form shows default collection folders; an unchanged default that was never configured is not written. */
export function withoutImplicitPaths(next: UserSettings, current: UserSettings): UserSettings {
  const paths = { ...next.paths };
  for (const key of collectionPathKeys) if (current.paths[key] === undefined && paths[key] === collectionPathDefaults[key]) delete paths[key];
  return { ...next, paths };
}
/** The one overlap rule for settings, design and migration checks: equal or nested, ignoring case. */
export function pathsOverlap(a: string, b: string): boolean {
  const left = a.toLowerCase(), right = b.toLowerCase();
  return left === right || left.startsWith(right + '/') || right.startsWith(left + '/');
}
/** Portable, vault-relative paths only. Host configuration and Git are never output locations. */
export function projectPath(value: unknown): string {
  const path = text(value, 'relative path', 240);
  requireSketch(path === value, 'SETTINGS_PATH', 'Paths must not have leading or trailing whitespace.');
  requireSketch(hasPortableProjectSegments(path), 'SETTINGS_PATH', 'Use a portable vault-relative path without dot segments.');
  requireSketch(!hasProtectedProjectRoot(path), 'SETTINGS_PATH', 'Host, framework, dependency and Git directories are protected.');
  return path;
}
function validateLocations(paths: UserSettings['paths'], hostDirectory: string): void {
  const locations = [...Object.values(effectivePaths(paths)), settingsPath, setupStatePath, 'configs/project-setup-draft.json', 'project.config.json', hostDirectory];
  for (let i = 0; i < locations.length; i++) for (const other of locations.slice(i + 1))
    requireSketch(!pathsOverlap(locations[i]!, other), 'SETTINGS_OVERLAP', `Input, output and configuration paths must not overlap; paths.design defaults to ${defaultDesignRoot}.`);
}
function readPaths(input: unknown, baseline: UserSettings['paths'], hostDirectory: string): UserSettings['paths'] {
  const raw = object(input); keys(raw, [...Object.keys(defaultSettings.paths), 'design', ...collectionPathKeys]);
  const merged = { ...baseline, ...raw };
  const paths = Object.fromEntries(Object.entries(merged).map(([key, value]) => [key, projectPath(value)])) as UserSettings['paths'];
  for (const [key, extension] of [['project', '.json'], ['brief', '.md'], ['firstRunReport', '.json']] as const)
    requireSketch(paths[key].endsWith(extension), 'SETTINGS_PATH', `${key} must end in ${extension}.`);
  validateLocations(paths, hostDirectory); return paths;
}
function hostConfigName(value: unknown): string {
  const name = text(value, 'vaultConfigDirectory', 100);
  requireSketch(/^[.a-zA-Z0-9_-]+$/.test(name) && !['.', '..', '.git', '.framework', 'node_modules'].includes(name.toLowerCase()), 'SETTINGS_HOST_DIRECTORY', 'Use the existing vault configuration directory name, not a path or protected project directory.');
  return name;
}
function readPreferences(input: unknown, baseline: UserSettings['preferences']): UserSettings['preferences'] {
  const prefs = object(input); keys(prefs, Object.keys(defaultSettings.preferences));
  const result = { ...baseline, firstRun: readFirstRunPreferences(prefs.firstRun ?? {}, baseline.firstRun) };
  if (prefs.vaultConfigDirectory !== undefined) result.vaultConfigDirectory = hostConfigName(prefs.vaultConfigDirectory);
  if (prefs.author !== undefined) result.author = text(prefs.author, 'author', 80);
  if (prefs.ui !== undefined) {
    requireSketch(prefs.ui === 'auto' || prefs.ui === 'tui' || prefs.ui === 'plain', 'SETTINGS_UI', 'Use auto, tui or plain.');
    result.ui = prefs.ui;
  }
  if (prefs.scanRecursive !== undefined) {
    requireSketch(typeof prefs.scanRecursive === 'boolean', 'SETTINGS_BOOLEAN', 'scanRecursive must be boolean.');
    result.scanRecursive = prefs.scanRecursive;
  }
  return result;
}
export function readSettings(value: unknown, baseline: UserSettings = defaultSettings): UserSettings {
  const raw = object(value); keys(raw, ['schemaVersion', 'paths', 'preferences', 'documentation']);
  requireSketch(raw.schemaVersion === 1, 'SETTINGS_VERSION', 'Expected settings schemaVersion 1. Existing bytes have not been changed.');
  const preferences = readPreferences(raw.preferences ?? {}, baseline.preferences);
  const documentation = mergeDocumentation(raw.documentation, baseline.documentation);
  return { schemaVersion: 1, paths: readPaths(raw.paths ?? {}, baseline.paths, preferences.vaultConfigDirectory), preferences,
    ...(documentation === undefined ? {} : { documentation }) };
}
/** Partial maker updates retain the documentation owner's complete data, including its safety policy. */
function mergeDocumentation(input: unknown, baseline?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (input === undefined) return baseline === undefined ? undefined : structuredClone(baseline);
  const raw = object(input), previous = baseline ?? {};
  const value = { ...structuredClone(previous), ...structuredClone(raw) };
  if (raw.paths !== undefined) value.paths = { ...object(previous.paths ?? {}), ...object(raw.paths) };
  return value;
}
export const settingsSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'Shell user settings (partial update or complete file)',
  type: 'object', additionalProperties: false, required: ['schemaVersion'], properties: {
    schemaVersion: { const: 1 }, documentation: { type: 'object', additionalProperties: false, properties: {
      root: { type: 'string' }, indexFile: { type: 'string' }, paths: { type: 'object', additionalProperties: { type: 'string' } },
      recursive: { type: 'boolean' }, linkFormat: { enum: ['markdown', 'wikilink'] },
      include: { type: 'array', maxItems: 32, items: { type: 'string', maxLength: 240 } },
      exclude: { type: 'array', maxItems: 32, items: { type: 'string', maxLength: 240 } },
      preserveAuthoredContent: { const: true }, conflictPolicy: { const: 'review' }, deleteMissing: { const: false },
    } }, paths: { type: 'object', additionalProperties: false,
      properties: Object.fromEntries([...Object.keys(defaultSettings.paths), 'design', ...collectionPathKeys].map(name => [name, { type: 'string', minLength: 1, maxLength: 240 }])) },
    preferences: { type: 'object', additionalProperties: false, properties: {
      vaultConfigDirectory: { type: 'string', minLength: 1, maxLength: 100 },
      author: { type: 'string', minLength: 1, maxLength: 80 }, ui: { enum: ['auto', 'tui', 'plain'] }, scanRecursive: { type: 'boolean' }, firstRun: firstRunPreferenceSchema,
    } },
  },
};
