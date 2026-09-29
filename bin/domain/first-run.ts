import { object, keys } from './data.ts';
import { requireSketch } from './errors.ts';
export interface FirstRunPreferences {
  install: 'auto' | 'install' | 'ci'; port: number; openBrowser: boolean;
  stepTimeoutMs: number; readyTimeoutMs: number; showcaseDurationMs: number;
}
export interface FirstRunRequest extends FirstRunPreferences { schemaVersion: 1; mode: 'verify' | 'showcase' }
export const firstRunDefaults: FirstRunPreferences = {
  install: 'auto', port: 4173, openBrowser: false,
  stepTimeoutMs: 600_000, readyTimeoutMs: 30_000, showcaseDurationMs: 300_000,
};
const bounds = { port: [1024, 65535], stepTimeoutMs: [1000, 3_600_000], readyTimeoutMs: [1000, 120_000], showcaseDurationMs: [1000, 3_600_000] } as const;
export function readFirstRunPreferences(input: unknown, defaults = firstRunDefaults): FirstRunPreferences {
  const raw = object(input); keys(raw, Object.keys(firstRunDefaults));
  const value = { ...defaults, ...raw };
  requireSketch(['auto', 'install', 'ci'].includes(String(value.install)), 'FIRST_RUN_INSTALL', 'Use auto, install or ci.');
  requireSketch(typeof value.openBrowser === 'boolean', 'FIRST_RUN_BROWSER', 'openBrowser must be boolean.');
  for (const [key, range] of Object.entries(bounds)) {
    const item = value[key as keyof typeof bounds];
    requireSketch(typeof item === 'number' && Number.isSafeInteger(item) && item >= range[0] && item <= range[1], 'FIRST_RUN_LIMIT', `${key} must be an integer from ${range[0]} to ${range[1]}.`);
  }
  return value;
}
export function readFirstRunRequest(input: unknown, defaults = firstRunDefaults): FirstRunRequest {
  const raw = object(input); keys(raw, ['schemaVersion', 'mode', ...Object.keys(firstRunDefaults)]);
  requireSketch(raw.schemaVersion === 1, 'FIRST_RUN_VERSION', 'Expected first-run schemaVersion 1.');
  requireSketch(raw.mode === 'verify' || raw.mode === 'showcase', 'FIRST_RUN_MODE', 'Use verify or showcase. Skipping requires no command.');
  const { schemaVersion, mode, ...options } = raw;
  requireSketch(mode !== 'verify' || options.openBrowser !== true, 'FIRST_RUN_BROWSER', 'Browser opening requires showcase mode.');
  return { schemaVersion, mode, ...readFirstRunPreferences(options, { ...defaults, openBrowser: mode === 'showcase' && defaults.openBrowser }) };
}
/** Only absent/root-only locks select install. Resolved but inconsistent locks stay on ci and fail visibly. */
export function installCommand(mode: FirstRunPreferences['install'], input: unknown): 'install' | 'ci' {
  if (mode !== 'auto') return mode;
  if (input === null) return 'install';
  const lock = object(input);
  requireSketch(lock.lockfileVersion === 2 || lock.lockfileVersion === 3, 'FIRST_RUN_LOCK', 'Use a reviewed npm lockfile version 2 or 3.');
  const packages = object(lock.packages); object(packages['']);
  const root = object(packages['']);
  const dependencies = { ...object(root.dependencies ?? {}), ...object(root.devDependencies ?? {}) };
  return Object.keys(packages).length === 1 && Object.keys(dependencies).length > 0 ? 'install' : 'ci';
}
export const firstRunPreferenceSchema = { type: 'object', additionalProperties: false, properties: {
  install: { enum: ['auto', 'install', 'ci'] }, openBrowser: { type: 'boolean' },
  ...Object.fromEntries(Object.entries(bounds).map(([key, [minimum, maximum]]) => [key, { type: 'integer', minimum, maximum }])),
} };
export const firstRunSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'Reviewed first run', type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'mode'], properties: {
    schemaVersion: { const: 1 }, mode: { enum: ['verify', 'showcase'] }, ...firstRunPreferenceSchema.properties,
  }, anyOf: [{ properties: { mode: { const: 'showcase' } } }, { properties: { mode: { const: 'verify' }, openBrowser: { const: false } } }],
};
