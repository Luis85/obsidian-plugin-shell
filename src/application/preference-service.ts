import { defaults, parsePreferences, type Preferences } from '../domain/preferences';
import { failure, success, type Result } from '../domain/outcome';
import type { SettingsStorage, Unsubscribe, ErrorReporter } from './ports';
import type { EventPort, ShellEvents } from './events';
export class PreferenceService {
  private value: Preferences = defaults;
  private queue: Promise<unknown> = Promise.resolve();
  private blocked = false;
  private disposed = false;
  private revision = 0;
  private readonly listeners = new Set<(value: Preferences) => void | Promise<void>>();
  constructor(private readonly storage: SettingsStorage, private readonly events: EventPort<ShellEvents>, private readonly errors: ErrorReporter) {}
  get current(): Preferences { return this.value; }
  get readonly(): boolean { return this.blocked; }
  async load(): Promise<void> {
    try {
      const raw = await this.storage.load();
      if (this.disposed) return;
      if (raw == null) return;
      if (typeof raw !== 'object' || !('schemaVersion' in raw) || raw.schemaVersion !== 1 || !('preferences' in raw)) throw new Error('SETTINGS_SCHEMA');
      const parsed = parsePreferences(raw.preferences);
      if (!parsed.ok) throw new Error('SETTINGS_INVALID');
      this.value = parsed.value;
    } catch { this.blocked = true; this.errors.report('settings.read', 'settings.load'); }
  }
  subscribe(listener: (value: Preferences) => void | Promise<void>): Unsubscribe { if (this.disposed) return () => undefined; this.listeners.add(listener); return () => this.listeners.delete(listener); }
  update(patch: Partial<Preferences>): Promise<Result<Preferences>> {
    const snapshot = { ...patch };
    return this.enqueue(() => snapshot);
  }
  toggleViewHeader(): Promise<Result<Preferences>> {
    return this.enqueue(current => ({ hideObsidianViewHeader: !current.hideObsidianViewHeader }));
  }
  private enqueue(patch: (current: Preferences) => Partial<Preferences>): Promise<Result<Preferences>> {
    const work = this.queue.then(async (): Promise<Result<Preferences>> => {
      if (this.blocked) return failure('storage', 'error.settingsRead');
      const parsed = parsePreferences({ ...this.value, ...patch(this.value) });
      if (!parsed.ok) return parsed;
      try { await this.storage.save({ schemaVersion: 1, preferences: parsed.value }); }
      catch { this.errors.report('settings.write', 'settings.save'); return failure('storage', 'error.settingsWrite'); }
      this.value = parsed.value;
      if (this.disposed) return success(this.value);
      for (const listener of Array.from(this.listeners)) {
        if (!this.listeners.has(listener)) continue;
        try {
          const result = listener(this.value);
          if (result) Promise.resolve(result).catch(() => this.errors.report('settings.listener', 'settings.notify'));
        } catch { this.errors.report('settings.listener', 'settings.notify'); }
      }
      this.events.publish({ type: 'preferences.changed', payload: { revision: ++this.revision } });
      return success(this.value);
    });
    this.queue = work.catch(() => undefined); return work;
  }
  dispose(): void { this.disposed = true; this.listeners.clear(); this.blocked = true; }
}
