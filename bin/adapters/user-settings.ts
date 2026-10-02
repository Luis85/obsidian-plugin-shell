import { validateDocumentationSettings } from './settings-documentation.ts';
import { join } from 'node:path';
import { createFilePlan } from '../../scripts/shared/file-plan.ts';
import { hash, readBounded } from './framework/files.ts';
import { parseJsonData } from '../../scripts/contracts/json-data.ts';
import { defaultSettings, readSettings, settingsPath, setupStatePath, type UserSettings } from '../domain/user-settings.ts';
import { requireSketch } from '../domain/errors.ts';
import { prepared, type Entry } from './storage.ts';
export const jsonText = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
/** Read guards join the eventual plan; changed bytes cannot be silently adopted. */
export async function guardedText(root: string, path: string): Promise<{ content: string | null; beforeHash: string | null }> {
  const plan = await createFilePlan(root, [{ path, content: null }]);
  const beforeHash = plan.changes[0]!.beforeHash;
  if (beforeHash === null) return { content: null, beforeHash };
  const bytes = await readBounded(join(root, path), 4_000_000);
  requireSketch(hash(bytes) === beforeHash, 'MAKER_STALE', 'File changed while reading: ' + path);
  return { content: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes), beforeHash };
}
export async function loadSettings(root: string): Promise<{ settings: UserSettings; content: string | null; beforeHash: string | null }> {
  const read = await guardedText(root, settingsPath);
  const settings = read.content === null ? structuredClone(defaultSettings) : readSettings(parseJsonData(read.content));
  validateDocumentationSettings(settings);
  return { ...read, settings };
}
export async function settingsPlan(root: string, input: unknown) {
  const current = await loadSettings(root), settings = readSettings(input, current.settings);
  validateDocumentationSettings(settings);
  const state = await guardedText(root, setupStatePath);
  requireSketch(state.content === null || JSON.stringify(settings.paths) === JSON.stringify(current.settings.paths), 'SETTINGS_MIGRATION_REQUIRED', 'This project is already set up. Moving paths needs an explicit file migration; settings do not move files. Preferences remain editable.');
  const entries: Entry[] = [{ path: settingsPath, content: jsonText(settings) }];
  if (state.content !== null) entries.push({ path: setupStatePath, content: state.content });
  const plan = await createFilePlan(root, entries);
  requireSketch(plan.changes[0]!.beforeHash === current.beforeHash && (state.content === null || plan.changes[1]!.beforeHash === state.beforeHash), 'MAKER_STALE', 'Configuration changed while planning.');
  return { ...prepared(plan, { settings, settingsPath }), validate: async () => {
    requireSketch((await guardedText(root, setupStatePath)).beforeHash === state.beforeHash, 'MAKER_STALE', 'Project setup state changed after settings preview.');
  } };
}
