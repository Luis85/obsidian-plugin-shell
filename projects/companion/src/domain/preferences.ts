import { failure, success, type Result } from './outcome';
import { validateFolder } from './paths';
export interface Preferences { readonly locale: 'en' | 'de'; readonly taskFolder: string; readonly notifySuccess: boolean; readonly hideObsidianViewHeader: boolean }
export const defaults: Preferences = Object.freeze({ locale: 'en', taskFolder: 'Tasks', notifySuccess: true, hideObsidianViewHeader: false });
export function parsePreferences(value: unknown): Result<Preferences> {
  if (!value || typeof value !== 'object') return failure('validation', 'error.preferences');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !['locale', 'taskFolder', 'notifySuccess', 'hideObsidianViewHeader'].includes(k))) return failure('validation', 'error.preferences');
  const folder = validateFolder(v.taskFolder);
  if (!folder.ok) return folder;
  if ((v.locale !== 'en' && v.locale !== 'de') || typeof v.notifySuccess !== 'boolean') return failure('validation', 'error.preferences');
  const hideObsidianViewHeader = 'hideObsidianViewHeader' in v ? v.hideObsidianViewHeader : false;
  if (typeof hideObsidianViewHeader !== 'boolean') return failure('validation', 'error.preferences');
  return success(Object.freeze({ hideObsidianViewHeader, locale: v.locale, taskFolder: folder.value, notifySuccess: v.notifySuccess }));
}
