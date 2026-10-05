import { readSettings, withoutImplicitPaths, type UserSettings } from '../domain/user-settings.ts';
import { startForm, startWizard } from './wizards/registry.ts';
import type { Prompts } from './prompts.ts';
/**
 * configs/forms/user-settings.json (with its advanced and documentation sections), committed through readSettings. Optional
 * folders the form shows with their default are kept only when configured or changed, so the saved path set stays exact.
 */
export async function settingsForm(ui: Prompts, initial: UserSettings): Promise<UserSettings> {
  return withoutImplicitPaths(readSettings(await startForm(ui, 'user-settings', { ...structuredClone(initial) })), initial);
}
/** configs/wizards/settings.json: the settings form and one reviewed settings or migration plan. */
export async function settingsWizard(ui: Prompts, options: { root: string; signal?: AbortSignal }): Promise<void> {
  await startWizard(ui, 'settings', { ...options, frameworkRoot: options.root });
}
