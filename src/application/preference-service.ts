import { defaults, parsePreferences, type Preferences } from '../domain/preferences';
import { success, type Result } from '../domain/outcome';
import type { SettingsStorage, Unsubscribe, ErrorReporter } from './ports';
import type { EventPort, ShellEvents } from './events';
import { PluginDataStore } from './plugin-data-store';
export class PreferenceService {
  private value: Preferences = defaults;
  private disposed = false;
  private revision = 0;
  private readonly listeners = new Set<(value: Preferences) => void | Promise<void>>();
  private readonly data: PluginDataStore;
  constructor(storage: SettingsStorage | PluginDataStore, private readonly events: EventPort<ShellEvents>, private readonly errors: ErrorReporter) {
    this.data = storage instanceof PluginDataStore ? storage : new PluginDataStore(storage, errors);
  }
  get current(): Preferences { return this.value; }
  get readonly(): boolean { return this.disposed || this.data.readonly; }
  async load(): Promise<void> {
    await this.data.load();
    if (!this.disposed) this.value = this.data.current.preferences;
  }
  subscribe(listener: (value: Preferences) => void | Promise<void>): Unsubscribe { if (this.disposed) return () => undefined; this.listeners.add(listener); return () => this.listeners.delete(listener); }
  update(patch: Partial<Preferences>): Promise<Result<Preferences>> {
    const snapshot = { ...patch };
    return this.enqueue(() => snapshot);
  }
  toggleViewHeader(): Promise<Result<Preferences>> {
    return this.enqueue(current => ({ hideObsidianViewHeader: !current.hideObsidianViewHeader }));
  }
  private async enqueue(patch: (current: Preferences) => Partial<Preferences>): Promise<Result<Preferences>> {
    const result = await this.data.transact(data => {
      const parsed = parsePreferences({ ...data.preferences, ...patch(data.preferences) });
      if (!parsed.ok) return parsed;
      return success({ data: { ...data, preferences: parsed.value }, value: parsed.value });
    }, () => !this.disposed);
    if (!result.ok) return result;
    this.value = result.value;
    if (this.disposed) return success(this.value);
    for (const listener of Array.from(this.listeners)) {
      if (!this.listeners.has(listener)) continue;
      try {
        const result = listener(this.value);
        if (result) Promise.resolve(result).catch(() => this.errors.report('settings.listener', 'settings.notify'));
      } catch { this.errors.report('settings.listener', 'settings.notify'); }
    }
    try { this.events.publish({ type: 'preferences.changed', payload: { revision: ++this.revision } }); }
    catch { this.errors.report('settings.listener', 'settings.notify'); }
    return success(this.value);
  }
  dispose(): void { this.disposed = true; this.listeners.clear(); }
}
