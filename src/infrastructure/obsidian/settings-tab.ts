import { PluginSettingTab, type Plugin, type SettingDefinitionItem } from 'obsidian';
import type { PreferenceService } from '../../application/preference-service';
import type { NotificationService } from '../../application/notification-service';
import type { Preferences } from '../../domain/preferences';
interface SettingsServices { preferences: PreferenceService; notifications: NotificationService; text(key: string): string }
import { validateFolder } from '../../domain/paths';
export class ShellSettingsTab extends PluginSettingTab {
  constructor(plugin: Plugin, private readonly services: SettingsServices) { super(plugin.app, plugin); }
  getSettingDefinitions(): SettingDefinitionItem[] {
    const t = (key: string) => this.services.text(key);
    return [
      { name: t('settings.language'), desc: t('settings.languageHelp'), control: { type: 'dropdown', key: 'locale', options: { en: 'English', de: 'Deutsch' }, defaultValue: 'en' } },
      { name: t('settings.folder'), desc: t('settings.folderHelp'), control: { type: 'text', key: 'taskFolder', defaultValue: 'Tasks', validate: value => { const r = validateFolder(value); return r.ok ? undefined : t(r.error.key); } } },
      { name: t('settings.notices'), desc: t('settings.noticesHelp'), control: { type: 'toggle', key: 'notifySuccess', defaultValue: true } },
    ];
  }
  getControlValue(key: string): unknown {
    const value = this.services.preferences.current;
    if (key === 'locale') return value.locale;
    if (key === 'taskFolder') return value.taskFolder;
    if (key === 'notifySuccess') return value.notifySuccess;
    return undefined;
  }
  async setControlValue(key: string, value: unknown): Promise<void> {
    const patch: Partial<Preferences> | null = key === 'locale' && (value === 'en' || value === 'de') ? { locale: value }
      : key === 'taskFolder' && typeof value === 'string' ? { taskFolder: value }
      : key === 'notifySuccess' && typeof value === 'boolean' ? { notifySuccess: value } : null;
    if (!patch) return;
    const result = await this.services.preferences.update(patch);
    if (!result.ok) this.services.notifications.show('native-settings', 'error', result.error.key, true);
    this.update();
  }
}
