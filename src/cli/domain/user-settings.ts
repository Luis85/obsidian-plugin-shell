import { defaultVaultConfigDirectory } from './host-paths.ts';
import { hasPortableProjectSegments, hasProtectedProjectRoot } from '#shared/platform/project-path.ts';
import { isProtectedSegment, RESERVED_FOLDER_NAMES } from '#shared/platform/protected-directories.ts';
import { firstRunDefaults, firstRunPreferenceSchema, readFirstRunPreferences, type FirstRunPreferences } from './first-run.ts';
import { object, keys, text } from './data.ts';
import { requireSketch } from '#shared/contracts/sketch-errors.ts';
import { defaultDesignRoot } from './design-folder.ts';
/** Settings, setup state, starters and project configurations; configured project paths always stay outside it. */
const configurationFolder = 'configs';
export const settingsPath = `${configurationFolder}/user-settings.json`;
export const setupStatePath = `${configurationFolder}/project-setup.json`;
export interface UserSettings {
  schemaVersion: 1;
  /** The documentation feature owns semantic validation of this shared namespace. */
  documentation?: Record<string, unknown>;
  /** design, increments, pullRequests, issues and the collection folders are optional so existing settings and saved setup state keep their exact path set; effectivePaths resolves them. */
  paths: { prds: string; project: string; prototypes: string; app: string; brief: string; firstRunReport: string; design?: string; increments?: string; pullRequests?: string; issues?: string } & { [K in CollectionPathKey]?: string };
  preferences: { author: string; ui: 'auto' | 'tui' | 'plain'; vaultConfigDirectory: string; scanRecursive: boolean; firstRun: FirstRunPreferences };
}
/**
 * Folders of the typed-note collections in configs/collections (one Markdown note per item) and of the release
 * candidate documents (one folder per version). Like design they are optional, so existing settings and saved setup
 * state keep their exact path set; collectionRoot resolves the default.
 */
export const collectionPathDefaults = { risks: 'docs/risks', learnings: 'docs/learnings', releaseItems: 'docs/releases/items', releaseCandidates: 'docs/releases/candidates' } as const;
export type CollectionPathKey = keyof typeof collectionPathDefaults;
export const collectionPathKeys = Object.keys(collectionPathDefaults) as CollectionPathKey[];
export const defaultSettings: UserSettings = {
  schemaVersion: 1,
  paths: { prds: 'docs/prds', project: 'design/project.json', prototypes: 'prototypes/project', app: 'apps/product', brief: 'docs/project-brief.md', firstRunReport: 'reports/first-run.json' },
  preferences: { author: 'Your name', ui: 'auto', vaultConfigDirectory: defaultVaultConfigDirectory, scanRecursive: true, firstRun: firstRunDefaults },
};
/** Optional path keys and their defaults; they appear in a settings file only once configured. */
export const defaultIncrementsRoot = 'docs/increments';
export const defaultPullRequestsRoot = 'docs/pull-requests';
export const defaultIssuesRoot = 'docs/issues';
const optionalPaths = ['design', 'increments', 'pullRequests', 'issues', ...collectionPathKeys] as const;
/** The folder that holds one Claude Design folder per prototype. */
export function designRoot(paths: UserSettings['paths']): string { return paths.design ?? defaultDesignRoot; }
/** The folder of one note collection: the configured path or its default. */
export function collectionRoot(paths: UserSettings['paths'], key: CollectionPathKey): string { return paths[key] ?? collectionPathDefaults[key]; }
/** The folder of Increment documents (the Definition of Ready handoffs). */
export function incrementsRoot(paths: UserSettings['paths']): string { return paths.increments ?? defaultIncrementsRoot; }
/** The folder of PullRequest documents (the planned pull requests of an increment). */
export function pullRequestsRoot(paths: UserSettings['paths']): string { return paths.pullRequests ?? defaultPullRequestsRoot; }
/** The folder of Issue documents (the units an increment is broken down into). */
export function issuesRoot(paths: UserSettings['paths']): string { return paths.issues ?? defaultIssuesRoot; }
/** Every configured location with the optional roots resolved, so checks see the folders the tools actually use. */
export function effectivePaths(paths: UserSettings['paths']): Required<UserSettings['paths']> {
  const collections = Object.fromEntries(collectionPathKeys.map(key => [key, collectionRoot(paths, key)])) as Record<CollectionPathKey, string>;
  return { ...paths, design: designRoot(paths), increments: incrementsRoot(paths), pullRequests: pullRequestsRoot(paths), issues: issuesRoot(paths), ...collections };
}
/** Optional folders a settings form shows with their default; see withoutImplicitPaths. */
const shownPathDefaults = { increments: defaultIncrementsRoot, pullRequests: defaultPullRequestsRoot, issues: defaultIssuesRoot, ...collectionPathDefaults } as const;
const shownPathKeys = Object.keys(shownPathDefaults) as (keyof typeof shownPathDefaults)[];
/** A form shows default document and collection folders; an unchanged default that was never configured is not written. */
export function withoutImplicitPaths(next: UserSettings, current: UserSettings): UserSettings {
  const paths = { ...next.paths };
  for (const key of shownPathKeys) if (current.paths[key] === undefined && paths[key] === shownPathDefaults[key]) delete paths[key];
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
  requireSketch(Object.values(effectivePaths(paths)).every(path => path.split('/')[0]!.toLowerCase() !== configurationFolder), 'SETTINGS_OVERLAP',
    `Configured paths stay outside ${configurationFolder}/, which holds settings, setup state, starters and project configurations.`);
  const locations = [...Object.values(effectivePaths(paths)), settingsPath, setupStatePath, 'configs/project-setup-draft.json', hostDirectory];
  for (let i = 0; i < locations.length; i++) for (const other of locations.slice(i + 1))
    requireSketch(!pathsOverlap(locations[i]!, other), 'SETTINGS_OVERLAP', `Input, output and configuration paths must not overlap; paths.design defaults to ${defaultDesignRoot}, paths.increments to ${defaultIncrementsRoot}, paths.pullRequests to ${defaultPullRequestsRoot} and paths.issues to ${defaultIssuesRoot}.`);
}
function readPaths(input: unknown, baseline: UserSettings['paths'], hostDirectory: string): UserSettings['paths'] {
  const raw = object(input); keys(raw, [...Object.keys(defaultSettings.paths), ...optionalPaths]);
  const merged = { ...baseline, ...raw };
  const paths = Object.fromEntries(Object.entries(merged).map(([key, value]) => [key, projectPath(value)])) as UserSettings['paths'];
  for (const [key, extension] of [['project', '.json'], ['brief', '.md'], ['firstRunReport', '.json']] as const)
    requireSketch(paths[key].endsWith(extension), 'SETTINGS_PATH', `${key} must end in ${extension}.`);
  for (const key of ['increments', 'pullRequests', 'issues'] as const) if (paths[key] !== undefined) documentFolder(key, paths[key]);
  validateLocations(paths, hostDirectory); return paths;
}
/** Increment, pull-request and issue folders hold Markdown files one level deep, outside hidden directories. */
function documentFolder(key: string, path: string): void {
  requireSketch(!/\.md$/i.test(path) && !path.split('/').some(part => part.startsWith('.')), 'SETTINGS_PATH', `${key} must be a visible folder, not a Markdown file or hidden directory.`);
}
function hostConfigName(value: unknown): string {
  const name = text(value, 'vaultConfigDirectory', 100);
  requireSketch(/^[.a-zA-Z0-9_-]+$/.test(name) && name !== '.' && name !== '..' && !isProtectedSegment(name, RESERVED_FOLDER_NAMES), 'SETTINGS_HOST_DIRECTORY', 'Use the existing vault configuration directory name, not a path or protected project directory.');
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
      properties: Object.fromEntries([...Object.keys(defaultSettings.paths), ...optionalPaths].map(name => [name, { type: 'string', minLength: 1, maxLength: 240 }])) },
    preferences: { type: 'object', additionalProperties: false, properties: {
      vaultConfigDirectory: { type: 'string', minLength: 1, maxLength: 100 },
      author: { type: 'string', minLength: 1, maxLength: 80 }, ui: { enum: ['auto', 'tui', 'plain'] }, scanRecursive: { type: 'boolean' }, firstRun: firstRunPreferenceSchema,
    } },
  },
};
