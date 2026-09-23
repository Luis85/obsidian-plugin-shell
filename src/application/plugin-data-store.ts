import { plainRecord } from '../domain/entity';
import { defaults, parsePreferences, type Preferences } from '../domain/preferences';
import { failure, success, type Result } from '../domain/outcome';
import type { ErrorReporter, SettingsStorage } from './ports';

export interface PluginDataEnvelope {
  readonly schemaVersion: 1;
  readonly preferences: Preferences;
  readonly [key: string]: unknown;
}
interface Change<T> { readonly data: PluginDataEnvelope; readonly value: T }

/** One runtime owns the entire settings envelope. A rejected save has an unknown outcome. */
export class PluginDataStore {
  private value: PluginDataEnvelope = Object.freeze({ schemaVersion: 1, preferences: defaults });
  private queue: Promise<unknown> = Promise.resolve();
  private loading: Promise<void> | undefined;
  private blocked = false;
  private disposed = false;
  constructor(private readonly storage: SettingsStorage, private readonly errors: ErrorReporter) {}
  get readonly(): boolean { return this.blocked || this.disposed; }
  get current(): PluginDataEnvelope { return this.value; }
  load(): Promise<void> {
    this.loading ??= this.initialize();
    return this.loading;
  }
  private async initialize(): Promise<void> {
    try {
      const raw = await this.storage.load();
      if (this.disposed || raw == null) return;
      const parsed = envelope(raw);
      if (!parsed.ok) throw new Error('Invalid plugin data');
      this.value = parsed.value;
    } catch { this.blocked = true; this.errors.report('settings.read', 'settings.load'); }
  }
  async read(): Promise<Result<PluginDataEnvelope>> {
    await this.load();
    if (this.disposed) return failure('disposed', 'error.disposed');
    return this.blocked ? failure('storage', 'error.settingsRead') : success(this.value);
  }
  transact<T>(change: (data: PluginDataEnvelope) => Result<Change<T>>, active: () => boolean): Promise<Result<T>> {
    const work = this.queue.then(async (): Promise<Result<T>> => {
      const current = await this.read();
      if (!current.ok) return current;
      if (!active()) return failure('disposed', 'error.disposed');
      let next: Result<Change<T>>;
      try { next = change(current.value); }
      catch { this.errors.report('plugin-data.prepare', 'plugin-data.change'); return failure('unexpected', 'error.unexpected'); }
      if (!next.ok) return next;
      const parsed = envelope(next.value.data);
      if (!parsed.ok) return parsed;
      try { await this.storage.save(parsed.value); }
      catch {
        this.blocked = true;
        this.errors.report('settings.write', 'settings.save');
        return failure('uncertain', 'error.settingsWrite');
      }
      this.value = parsed.value;
      return success(next.value.value);
    });
    this.queue = work.catch(() => undefined);
    return work;
  }
  dispose(): void { this.disposed = true; }
}

/** Reject non-JSON inputs instead of silently deleting values during serialization. */
function jsonValue(value: unknown, depth = 0): boolean {
  if (depth > 30) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1) return false;
    for (let index = 0; index < value.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor) || !jsonValue(descriptor.value, depth + 1)) return false;
    }
    return true;
  }
  if (!plainRecord(value)) return false;
  const names = Reflect.ownKeys(value);
  return names.length === Object.keys(value).length && names.every(name => {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    return descriptor !== undefined && 'value' in descriptor && jsonValue(descriptor.value, depth + 1);
  });
}
function freeze(value: unknown): void {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
}
function envelope(raw: unknown): Result<PluginDataEnvelope> {
  if (!plainRecord(raw) || raw.schemaVersion !== 1 || !jsonValue(raw)) return failure('storage', 'error.settingsRead');
  const preferences = parsePreferences(raw.preferences);
  if (!preferences.ok) return failure('storage', 'error.settingsRead');
  const bytes = JSON.stringify(raw);
  if (bytes.length > 1_000_000) return failure('validation', 'error.pluginDataLimit');
  const cloned: unknown = JSON.parse(bytes);
  if (!plainRecord(cloned)) return failure('storage', 'error.settingsRead');
  const result: PluginDataEnvelope = { ...cloned, schemaVersion: 1, preferences: preferences.value };
  freeze(result);
  return success(result);
}
