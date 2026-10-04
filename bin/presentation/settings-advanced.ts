import { documentationSettings } from '../adapters/settings-documentation.ts';
import { incrementsRoot, pullRequestsRoot, type UserSettings } from '../domain/user-settings.ts';
import { input, choose, confirm, type Prompts } from './prompts.ts';
async function booleanPreference(ui: Prompts, label: string, current: boolean): Promise<boolean> {
  return await choose(ui, label, [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }], current ? 'yes' : 'no') === 'yes';
}
export async function advancedSettingsForm(ui: Prompts, settings: UserSettings): Promise<void> {
  settings.paths.firstRunReport = await input(ui, 'First-run report JSON', settings.paths.firstRunReport);
  await documentFolders(ui, settings);
  settings.preferences.vaultConfigDirectory = await input(ui, 'Existing vault configuration directory', settings.preferences.vaultConfigDirectory);
  const run = settings.preferences.firstRun;
  const install = await choose(ui, 'Dependency installation strategy', ['auto', 'install', 'ci'].map(id => ({ id, label: id })), run.install);
  run.install = install === 'ci' || install === 'install' ? install : 'auto';
  run.openBrowser = await booleanPreference(ui, 'Prefer opening the showcase browser?', run.openBrowser);
  const labels = { port: 'Default showcase port', stepTimeoutMs: 'Per-stage timeout in milliseconds',
    readyTimeoutMs: 'Readiness timeout in milliseconds', showcaseDurationMs: 'Showcase duration in milliseconds' };
  for (const key of Object.keys(labels) as (keyof typeof labels)[]) run[key] = Number(await input(ui, labels[key], String(run[key])));
  if (await confirm(ui, 'Configure Markdown documentation settings?')) await documentationForm(ui, settings);
}
/** The optional folders are written only when configured or changed, so accepting the defaults keeps the saved path set. */
async function documentFolders(ui: Prompts, settings: UserSettings): Promise<void> {
  const folders = [['increments', 'Increment documents folder', incrementsRoot], ['pullRequests', 'Pull-request documents folder', pullRequestsRoot]] as const;
  for (const [key, label, resolve] of folders) {
    const current = resolve(settings.paths), value = await input(ui, label, current);
    if (settings.paths[key] !== undefined || value !== current) settings.paths[key] = value;
  }
}
async function documentationForm(ui: Prompts, settings: UserSettings): Promise<void> {
  const current = documentationSettings(settings);
  const root = await input(ui, 'Application documentation root', current.root);
  const value = { ...current, root, paths: { ...current.paths } };
  if (root !== current.root && await confirm(ui, 'Reset documentation folders beneath the new root?'))
    value.paths = Object.fromEntries(Object.keys(value.paths).map(key => [key, root + '/' + key]));
  value.indexFile = await input(ui, 'Documentation index JSON', current.indexFile);
  value.recursive = await booleanPreference(ui, 'Scan documentation subfolders?', current.recursive);
  value.linkFormat = await choose(ui, 'Documentation link format', ['markdown', 'wikilink'].map(id => ({ id, label: id })), current.linkFormat) === 'wikilink' ? 'wikilink' : 'markdown';
  value.include = (await input(ui, 'Included glob patterns, separated by semicolons', current.include.join(';'))).split(';').map(item => item.trim()).filter(Boolean);
  value.exclude = (await input(ui, 'Excluded glob patterns, separated by semicolons', current.exclude.join(';'))).split(';').map(item => item.trim()).filter(Boolean);
  if (await confirm(ui, 'Configure individual documentation folders?')) for (const key of Object.keys(value.paths))
    value.paths[key] = await input(ui, 'Documentation folder: ' + key, value.paths[key]);
  settings.documentation = { ...settings.documentation, ...value, preserveAuthoredContent: true, conflictPolicy: 'review', deleteMissing: false };
  documentationSettings(settings);
}
