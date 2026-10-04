import { readSettings, type UserSettings } from '../domain/user-settings.ts';
import { startForm, startWizard } from './wizards/registry.ts';
import type { Prompts } from './prompts.ts';
/** configs/forms/user-settings.json (with its advanced and documentation sections), committed through readSettings. */
export async function settingsForm(ui: Prompts, initial: UserSettings): Promise<UserSettings> {
  return readSettings(await startForm(ui, 'user-settings', { ...structuredClone(initial) }));
}
/** configs/wizards/settings.json: the settings form and one reviewed settings or migration plan. */
export async function settingsWizard(ui: Prompts, options: { root: string; signal?: AbortSignal }): Promise<void> {
  await startWizard(ui, 'settings', { ...options, frameworkRoot: options.root });
}
