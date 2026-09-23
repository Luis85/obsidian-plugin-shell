import { PluginSettingTab, type Plugin, type Setting, type SettingDefinitionItem, type ToggleComponent } from 'obsidian';
import type { PreferenceService } from '../../application/preference-service';
import type { NotificationService } from '../../application/notification-service';
import type { Preferences } from '../../domain/preferences';
import type { BooleanSetting } from '../../application/boolean-setting';
import type { ErrorReporter, Unsubscribe } from '../../application/ports';
import { validateFolder } from '../../domain/paths';
interface SettingsServices { preferences: PreferenceService; notifications: NotificationService; diagnostics: ErrorReporter; settings?: readonly BooleanSetting[]; text(key: string): string }
export class ShellSettingsTab extends PluginSettingTab {
  private readonly releases = new Set<Unsubscribe>();
  private closed = false;
  private hidden = false;
  private epoch = 0;
  constructor(plugin: Plugin, private readonly services: SettingsServices) { super(plugin.app, plugin); }
  getSettingDefinitions(): SettingDefinitionItem[] {
    const t = (key: string) => this.services.text(key);
    return [
      { name: t('settings.hideHeader'), desc: t('settings.hideHeaderHelp'), control: { disabled: () => this.services.preferences.readonly, type: 'toggle', key: 'hideObsidianViewHeader', defaultValue: false } },
      { name: t('settings.language'), desc: t('settings.languageHelp'), control: { disabled: () => this.services.preferences.readonly, type: 'dropdown', key: 'locale', options: { en: 'English', de: 'Deutsch' }, defaultValue: 'en' } },
      { name: t('settings.folder'), desc: t('settings.folderHelp'), control: { disabled: () => this.services.preferences.readonly, type: 'text', key: 'taskFolder', defaultValue: 'Tasks', validate: value => { const r = validateFolder(value); return r.ok ? undefined : t(r.error.key); } } },
      { name: t('settings.notices'), desc: t('settings.noticesHelp'), control: { disabled: () => this.services.preferences.readonly, type: 'toggle', key: 'notifySuccess', defaultValue: true } },
      ...(this.services.settings ?? []).map(setting => ({ name: t(setting.definition.titleKey), desc: t(setting.definition.descriptionKey),
        render: (row: Setting) => this.renderBoolean(row, setting),
      })),
    ];
  }
  private renderBoolean(row: Setting, setting: BooleanSetting): Unsubscribe {
    if (this.closed) return () => undefined;
    this.hidden = false;
    const epoch = this.epoch; const owner = row.settingEl.ownerDocument.defaultView;
    let active = true; let reflecting = false; let off: Unsubscribe = () => undefined; let toggle: ToggleComponent | undefined;
    const release = () => {
      if (!active) return;
      active = false; this.releases.delete(release);
      try { owner?.removeEventListener('unload', release); } catch { this.services.diagnostics.report('settings.cleanup', 'settings.hide'); }
      try { off(); } catch { this.services.diagnostics.report('settings.cleanup', 'settings.hide'); }
    };
    const current = () => active && !this.closed && !this.hidden && this.epoch === epoch;
    const refresh = () => {
      if (!current()) return;
      try {
        reflecting = true;
        toggle?.setValue(setting.value ?? setting.definition.defaultValue).setDisabled(setting.readonly);
        row.setDesc(this.services.text(setting.definition.descriptionKey));
        row.setErrorMessage(setting.errorKey ? this.services.text(setting.errorKey) : null);
      } catch { this.services.diagnostics.report('settings.render', 'settings.refresh'); release(); }
      finally { reflecting = false; }
    };
    this.releases.add(release);
    try {
      row.addToggle(control => {
        toggle = control;
        control.onChange(value => {
          // Obsidian's public setValue invokes onChange when the value differs.
          if (reflecting || !current()) return;
          void this.setControlValue(`authoring:${setting.definition.id}`, value)
            .catch(() => { this.services.diagnostics.report('settings.write', 'settings.change'); refresh(); });
        });
      });
      if (!toggle) throw new Error('NATIVE_TOGGLE_UNAVAILABLE');
      off = setting.subscribe(refresh); owner?.addEventListener('unload', release, { once: true }); refresh();
      return release;
    } catch (error) { release(); this.epoch++; this.stop(); throw error; }
  }
  getControlValue(key: string): unknown {
    // The public getter runs while cached builtin definitions are rendered again.
    if (!this.closed) this.hidden = false;
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
    const epoch = this.epoch; const setting = this.featureSetting(key);
    if (setting) {
      const result = await setting.set(value);
      if (this.closed || this.hidden || epoch !== this.epoch) return;
      if (!result.ok) this.services.notifications.show('native-settings', 'error', result.error.key, true, 'runtime');
      // Render-owned handles update in place, even while the toggle has focus.
      return;
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
    for (const release of Array.from(this.releases)) {
      try { release(); } catch { this.services.diagnostics.report('settings.cleanup', 'settings.hide'); }
    }
  }
  hide(): void { this.hidden = true; this.epoch++; this.stop(); super.hide(); }
  dispose(): void { this.closed = true; this.stop(); }
}
