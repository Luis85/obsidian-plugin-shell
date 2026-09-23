import { PluginSettingTab, type Plugin, type SettingDefinitionItem } from 'obsidian';
import type { PreferenceService } from '../../application/preference-service';
import type { NotificationService } from '../../application/notification-service';
import type { Preferences } from '../../domain/preferences';
import type { BooleanSetting } from '../../application/boolean-setting';
import type { ErrorReporter, Unsubscribe } from '../../application/ports';
interface SettingsServices { preferences: PreferenceService; notifications: NotificationService; diagnostics: ErrorReporter; settings?: readonly BooleanSetting[]; text(key: string): string }
import { validateFolder } from '../../domain/paths';
export class ShellSettingsTab extends PluginSettingTab {
  private releases: Unsubscribe[] = [];
  private closed = false;
  private hidden = false;
  private epoch = 0;
  constructor(plugin: Plugin, private readonly services: SettingsServices) { super(plugin.app, plugin); }
  getSettingDefinitions(): SettingDefinitionItem[] {
    this.hidden = false;
    if (!this.closed && !this.releases.length) {
      const epoch = this.epoch;
      try {
        for (const setting of this.services.settings ?? []) this.releases.push(setting.subscribe(() => {
          if (!this.closed && !this.hidden && this.epoch === epoch) this.update();
        }));
      } catch (error) { this.epoch++; this.stop(); throw error; }
    }
    const t = (key: string) => this.services.text(key);
    return [
      { name: t('settings.hideHeader'), desc: t('settings.hideHeaderHelp'), control: { disabled: () => this.services.preferences.readonly, type: 'toggle', key: 'hideObsidianViewHeader', defaultValue: false } },
      { name: t('settings.language'), desc: t('settings.languageHelp'), control: { disabled: () => this.services.preferences.readonly, type: 'dropdown', key: 'locale', options: { en: 'English', de: 'Deutsch' }, defaultValue: 'en' } },
      { name: t('settings.folder'), desc: t('settings.folderHelp'), control: { disabled: () => this.services.preferences.readonly, type: 'text', key: 'taskFolder', defaultValue: 'Tasks', validate: value => { const r = validateFolder(value); return r.ok ? undefined : t(r.error.key); } } },
      { name: t('settings.notices'), desc: t('settings.noticesHelp'), control: { disabled: () => this.services.preferences.readonly, type: 'toggle', key: 'notifySuccess', defaultValue: true } },
      ...(this.services.settings ?? []).map(setting => ({ name: t(setting.definition.titleKey),
        desc: t(setting.definition.descriptionKey) + (setting.errorKey ? ` ${t(setting.errorKey)}` : ''),
        control: { type: 'toggle' as const, key: `authoring:${setting.definition.id}`, defaultValue: setting.definition.defaultValue, disabled: () => this.closed || setting.readonly },
      })),
    ];
  }
  getControlValue(key: string): unknown {
    const setting = this.featureSetting(key);
    if (setting) return setting.value;
    const value = this.services.preferences.current;
    if (key === 'hideObsidianViewHeader') return value.hideObsidianViewHeader;
    if (key === 'locale') return value.locale;
    if (key === 'taskFolder') return value.taskFolder;
    if (key === 'notifySuccess') return value.notifySuccess;
    return undefined;
  }
  async setControlValue(key: string, value: unknown): Promise<void> {
    if (this.closed) return;
    const epoch = this.epoch;
    const setting = this.featureSetting(key);
    if (setting) {
      const result = await setting.set(value);
      if (this.closed || this.hidden || epoch !== this.epoch) return;
      if (!result.ok) this.services.notifications.show('native-settings', 'error', result.error.key, true, 'runtime');
      this.update(); return;
    }
    const patch: Partial<Preferences> | null = key === 'hideObsidianViewHeader' && typeof value === 'boolean' ? { hideObsidianViewHeader: value }
      : key === 'locale' && (value === 'en' || value === 'de') ? { locale: value }
      : key === 'taskFolder' && typeof value === 'string' ? { taskFolder: value }
      : key === 'notifySuccess' && typeof value === 'boolean' ? { notifySuccess: value } : null;
    if (!patch) return;
    const result = await this.services.preferences.update(patch);
    if (this.closed || this.hidden || epoch !== this.epoch) return;
    if (!result.ok) this.services.notifications.show('native-settings', 'error', result.error.key, true, 'runtime');
    this.update();
  }
  private featureSetting(key: string): BooleanSetting | undefined { return this.services.settings?.find(setting => `authoring:${setting.definition.id}` === key); }
  private stop(): void {
    for (const release of this.releases.splice(0)) {
      try { release(); } catch { this.services.diagnostics.report('settings.cleanup', 'settings.hide'); }
    }
  }
  hide(): void { this.hidden = true; this.epoch++; this.stop(); super.hide(); }
  dispose(): void { this.closed = true; this.stop(); }
}
