import { firstRunDefaults, firstRunPreferenceSchema, readFirstRunPreferences, type FirstRunPreferences } from './first-run.ts';
import { object, keys, text } from './data.ts';
import { requireSketch } from './errors.ts';
export const settingsPath = 'configs/user-settings.json';
export const setupStatePath = 'configs/project-setup.json';
export interface UserSettings {
  schemaVersion: 1;
  paths: { prds: string; project: string; prototypes: string; app: string; brief: string; firstRunReport: string };
  preferences: { author: string; ui: 'auto' | 'tui' | 'plain'; scanRecursive: boolean; firstRun: FirstRunPreferences };
}
export const defaultSettings: UserSettings = {
  schemaVersion: 1,
  paths: { prds: 'docs/prds', project: 'design/project.json', prototypes: 'prototypes/project', app: 'apps/product', brief: 'docs/project-brief.md', firstRunReport: 'reports/first-run.json' },
  preferences: { author: 'Your name', ui: 'auto', scanRecursive: true, firstRun: firstRunDefaults },
};
/** Portable, vault-relative paths only. Host configuration and Git are never output locations. */
export function projectPath(value: unknown): string {
  const path = text(value, 'relative path', 240);
  requireSketch(path === value, 'SETTINGS_PATH', 'Paths must not have leading or trailing whitespace.');
  requireSketch(!path.includes('\\') && !path.split('/').some(part => !part || part === '.' || part === '..' ||
    /[<>:"|?*\u0000-\u001f\u007f-\u009f]/.test(part) || /[ .]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)), 'SETTINGS_PATH', 'Use a portable vault-relative path without dot segments.');
  requireSketch(!['.git', '.obsidian', '.framework', 'node_modules', '.codex-authoring.lock', '.shell-first-run.lock'].includes(path.split('/')[0]!.toLowerCase()), 'SETTINGS_PATH', 'Host, framework, dependency and Git directories are protected.');
  return path;
}
const overlap = (a: string, b: string) => a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
export function readSettings(value: unknown, baseline: UserSettings = defaultSettings): UserSettings {
  const raw = object(value); keys(raw, ['schemaVersion', 'paths', 'preferences']);
  requireSketch(raw.schemaVersion === 1, 'SETTINGS_VERSION', 'Expected settings schemaVersion 1. Existing bytes have not been changed.');
  const paths = object(raw.paths ?? {}), prefs = object(raw.preferences ?? {});
  keys(paths, Object.keys(defaultSettings.paths)); keys(prefs, Object.keys(defaultSettings.preferences));
  const merged = { ...baseline.paths, ...paths };
  const result: UserSettings = { schemaVersion: 1, paths: {
    prds: projectPath(merged.prds), project: projectPath(merged.project), prototypes: projectPath(merged.prototypes),
    app: projectPath(merged.app), brief: projectPath(merged.brief), firstRunReport: projectPath(merged.firstRunReport),
  }, preferences: { ...baseline.preferences, firstRun: readFirstRunPreferences(prefs.firstRun ?? {}, baseline.preferences.firstRun) } };
  requireSketch(result.paths.project.endsWith('.json') && result.paths.brief.endsWith('.md') && result.paths.firstRunReport.endsWith('.json'), 'SETTINGS_PATH', 'Project must be .json; brief must be .md.');
  const locations = [...Object.values(result.paths), settingsPath, setupStatePath, 'project.config.json'].map(path => path.toLowerCase());
  for (let i = 0; i < locations.length; i++) for (let j = i + 1; j < locations.length; j++)
    requireSketch(!overlap(locations[i]!, locations[j]!), 'SETTINGS_OVERLAP', 'Input, output and configuration paths must not overlap.');
  if (prefs.author !== undefined) result.preferences.author = text(prefs.author, 'author', 80);
  if (prefs.ui !== undefined) {
    requireSketch(prefs.ui === 'auto' || prefs.ui === 'tui' || prefs.ui === 'plain', 'SETTINGS_UI', 'Use auto, tui or plain.');
    result.preferences.ui = prefs.ui;
  }
  if (prefs.scanRecursive !== undefined) {
    requireSketch(typeof prefs.scanRecursive === 'boolean', 'SETTINGS_BOOLEAN', 'scanRecursive must be boolean.');
    result.preferences.scanRecursive = prefs.scanRecursive;
  }
  return result;
}
export const settingsSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'Shell user settings (partial update or complete file)',
  type: 'object', additionalProperties: false, required: ['schemaVersion'], properties: {
    schemaVersion: { const: 1 }, paths: { type: 'object', additionalProperties: false,
      properties: Object.fromEntries(Object.keys(defaultSettings.paths).map(name => [name, { type: 'string', minLength: 1, maxLength: 240 }])) },
    preferences: { type: 'object', additionalProperties: false, properties: {
      author: { type: 'string', minLength: 1, maxLength: 80 }, ui: { enum: ['auto', 'tui', 'plain'] }, scanRecursive: { type: 'boolean' }, firstRun: firstRunPreferenceSchema,
    } },
  },
};
