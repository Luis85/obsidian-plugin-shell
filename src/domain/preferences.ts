import { failure, success, type Result } from './outcome';
import { validateFolder } from './paths';
export interface Preferences { readonly locale: 'en' | 'de'; readonly taskFolder: string; readonly notifySuccess: boolean }
export const defaults: Preferences = Object.freeze({ locale: 'en', taskFolder: 'Tasks', notifySuccess: true });
export function parsePreferences(value: unknown): Result<Preferences> {
  if (!value || typeof value !== 'object') return failure('validation', 'error.preferences');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !['locale', 'taskFolder', 'notifySuccess'].includes(k))) return failure('validation', 'error.preferences');
  const folder = validateFolder(v.taskFolder);
  if (!folder.ok) return folder;
  if ((v.locale !== 'en' && v.locale !== 'de') || typeof v.notifySuccess !== 'boolean') return failure('validation', 'error.preferences');
  return success(Object.freeze({ locale: v.locale, taskFolder: folder.value, notifySuccess: v.notifySuccess }));
}
