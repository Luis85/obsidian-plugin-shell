import { readSettings, type UserSettings } from '../domain/user-settings.ts';
import { loadSettings, settingsPlan } from '../adapters/user-settings.ts';
import { input, choose, type Prompts } from './prompts.ts';
import { review } from './review.ts';
export async function settingsForm(ui: Prompts, initial: UserSettings): Promise<UserSettings> {
  const settings = structuredClone(initial);
  const labels = { prds: 'Typed PRD folder', project: 'Companion project JSON', prototypes: 'Prototype package folder', app: 'Angular application folder', brief: 'Project brief Markdown' };
  for (const name of Object.keys(labels) as (keyof typeof labels)[]) settings.paths[name] = await input(ui, labels[name], settings.paths[name]);
  settings.preferences.author = await input(ui, 'Author', settings.preferences.author);
  const mode = await choose(ui, 'Preferred terminal interface', ['auto', 'tui', 'plain'].map(id => ({ id, label: id })), settings.preferences.ui);
  settings.preferences.ui = mode === 'tui' || mode === 'plain' ? mode : 'auto';
  settings.preferences.scanRecursive = await choose(ui, 'Scan PRD subfolders recursively?',
    [{ id: 'yes', label: 'Yes, include subfolders' }, { id: 'no', label: 'No, only the selected folder' }], initial.preferences.scanRecursive ? 'yes' : 'no') === 'yes';
  return readSettings(settings);
}
export async function settingsWizard(ui: Prompts, options: { root: string; signal?: AbortSignal }): Promise<void> {
  const current = await loadSettings(options.root);
  const settings = await settingsForm(ui, current.settings);
  await review(ui, await settingsPlan(options.root, settings), options.signal);
}
