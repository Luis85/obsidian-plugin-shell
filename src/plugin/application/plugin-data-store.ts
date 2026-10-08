import { plainRecord } from '../domain/entity';
import { defaults, parsePreferences, type Preferences } from '../domain/preferences';
import { failure, success, type Failure, type Result } from '../domain/outcome';
import type { ErrorReporter, SettingsStorage } from './ports';

export interface PluginDataEnvelope {
  readonly schemaVersion: 1;
  readonly preferences: Preferences;
  readonly [key: string]: unknown;
}
interface Change<T> { readonly data: PluginDataEnvelope; readonly value: T }
export type PluginDataStatus = 'unloaded' | 'absent' | 'ready' | 'corrupt' | 'future' | 'inaccessible' | 'uncertain';

function futureEnvelope(raw: unknown): boolean {
  if (!plainRecord(raw)) return false;
  const version: unknown = Object.getOwnPropertyDescriptor(raw, 'schemaVersion')?.value;
  return typeof version === 'number' && Number.isSafeInteger(version) && version > 1;
}

/** One runtime owns the entire settings envelope. A rejected save has an unknown outcome. */
export class PluginDataStore {
  private value: PluginDataEnvelope = Object.freeze({ schemaVersion: 1, preferences: defaults });
  private queue: Promise<unknown> = Promise.resolve();
  private loading: Promise<void> | undefined;
  private problem: Failure | undefined;
  private state: PluginDataStatus = 'unloaded';
  private disposed = false;
  constructor(private readonly storage: SettingsStorage, private readonly errors: ErrorReporter) {}
  get readonly(): boolean { return this.problem !== undefined || this.disposed; }
  get status(): PluginDataStatus { return this.state; }
  get readErrorKey(): string | undefined { return this.problem?.key; }
  get current(): PluginDataEnvelope { return this.value; }
  load(): Promise<void> {
    this.loading ??= this.initialize();
    return this.loading;
  }
  private async stored(): Promise<{ readonly present: boolean; readonly value: unknown }> {
    if (this.storage.read) {
      const text = await this.storage.read();
      if (text === null) return { present: false, value: null };
      if (typeof text !== 'string') throw new TypeError('Invalid stored JSON text');
      const value: unknown = JSON.parse(text);
      return { present: true, value };
    }
    // Legacy object readers cannot distinguish missing storage from present JSON null.
    const value = await this.storage.load();
    return { present: value != null, value };
  }
  private async initialize(): Promise<void> {
    try {
      const stored = await this.stored();
      if (this.disposed) return;
      if (!stored.present) { this.state = 'absent'; return; }
      const parsed = envelope(stored.value);
      if (!parsed.ok) { this.protect(futureEnvelope(stored.value) ? 'future' : 'corrupt'); return; }
      this.value = parsed.value;
      this.state = 'ready';
    } catch (error) {
      // An adapter that preserves JSON parse failures can identify corruption;
      // an otherwise opaque host load failure establishes only inaccessibility.
      this.protect(error instanceof SyntaxError ? 'corrupt' : 'inaccessible');
    }
  }
  private protect(status: 'corrupt' | 'future' | 'inaccessible'): void {
    this.state = status;
    this.problem = Object.freeze({ code: 'storage', key: 'error.settingsRead', effect: 'none' });
    this.errors.report('settings.read', 'settings.load');
  }
  async read(): Promise<Result<PluginDataEnvelope>> {
    await this.load();
    if (this.disposed) return failure('disposed', 'error.disposed');
    return this.problem ? { ok: false, error: this.problem } : success(this.value);
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
        this.state = 'uncertain';
        this.problem = Object.freeze({ code: 'uncertain', key: 'error.settingsWrite', effect: 'uncertain' });
        this.errors.report('settings.write', 'settings.save');
        return { ok: false, error: this.problem };
      }
      this.value = parsed.value;
      this.state = 'ready';
      return success(next.value.value);
    });
    this.queue = work.catch(() => undefined);
    return work;
  }
  dispose(): void { this.disposed = true; }
}

/** Reject non-JSON inputs instead of silently deleting values during serialization. */
function jsonArray(value: unknown[], depth: number): boolean {
    if (Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1) return false;
    for (let index = 0; index < value.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor) || !jsonValue(descriptor.value, depth + 1)) return false;
    }
    return true;
}
function jsonValue(value: unknown, depth = 0): boolean {
  if (depth > 30) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return jsonArray(value, depth);
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
