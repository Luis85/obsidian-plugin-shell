import { failure, success, type Failure, type Result } from '../domain/outcome';
import type { PluginDataRepository, PluginDataSnapshot } from './plugin-data-repository';
import type { EventObserver, ShellEvents } from './events';
import type { ErrorReporter, Unsubscribe } from './ports';

type Values = { readonly enabled: boolean };
type Repository = Pick<PluginDataRepository<{ enabled?: boolean }, Values>, 'list' | 'create' | 'update'>;
export interface BooleanSettingDefinition {
  readonly id: string; readonly entity: string; readonly titleKey: string; readonly descriptionKey: string; readonly defaultValue: boolean;
}
/** A read projection over one explicit repository; this class never owns storage. */
export class BooleanSetting {
  readonly definition: BooleanSettingDefinition;
  private current: boolean | undefined;
  private problem: Failure | undefined;
  private pending = 0;
  private disposed = false;
  private initialization: Promise<Result<void>> | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<() => void | Promise<void>>();
  private readonly stops: Unsubscribe[];
  constructor(definition: BooleanSettingDefinition, private readonly repository: Repository,
    private readonly services: { events: EventObserver<ShellEvents>; diagnostics: ErrorReporter; readonly: () => boolean; readErrorKey?: () => string | undefined }) {
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(definition.id) || definition.id.length > 64 || !definition.entity
      || !/^[a-z][\w.-]{0,99}$/.test(definition.titleKey) || !/^[a-z][\w.-]{0,99}$/.test(definition.descriptionKey)
      || typeof definition.defaultValue !== 'boolean') throw new Error('INVALID_BOOLEAN_SETTING');
    this.definition = Object.freeze({ ...definition });
    this.stops = [];
    try {
      for (const type of ['plugin-data.created', 'plugin-data.updated', 'plugin-data.deleted'] as const) {
        this.stops.push(services.events.on(type, payload => { if (payload.entity === this.definition.entity) return this.refresh().then(() => undefined); }));
      }
    } catch (error) { this.dispose(); throw error; }
  }
  get value(): boolean | undefined { return this.current; }
  get readonly(): boolean { return this.disposed || this.pending > 0 || this.current === undefined || !!this.problem || this.services.readonly(); }
  get errorKey(): string | undefined { return this.problem?.key ?? (this.services.readonly() ? this.services.readErrorKey?.() ?? 'error.settingsRead' : undefined); }
  initialize(): Promise<Result<void>> { this.initialization ??= this.refresh(); return this.initialization; }
  subscribe(listener: () => void | Promise<void>): Unsubscribe {
    if (this.disposed) return () => undefined;
    this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  }
  private changed(): void {
    if (this.disposed) return;
    for (const listener of Array.from(this.listeners)) {
      if (!this.listeners.has(listener)) continue;
      try { const result = listener(); if (result) void result.catch(() => this.services.diagnostics.report('setting.listener', 'setting.notify')); }
      catch { this.services.diagnostics.report('setting.listener', 'setting.notify'); }
    }
  }
  private read(): Promise<Result<readonly PluginDataSnapshot<Values>[]>> { return this.repository.list(); }
  private accept(rows: readonly PluginDataSnapshot<Values>[]): Result<PluginDataSnapshot<Values> | undefined> {
    if (rows.length > 1) return failure('conflict', 'error.pluginDataConflict');
    return success(rows[0]);
  }
  private remember(result: Result<void>): Result<void> {
    if (!this.disposed && !result.ok) this.problem = result.error;
    return result;
  }
  private enqueue(action: () => Promise<Result<void>>): Promise<Result<void>> {
    if (this.disposed) return Promise.resolve(failure('disposed', 'error.disposed'));
    this.pending++; this.changed();
    const work = this.queue.then(async (): Promise<Result<void>> => {
      if (this.disposed) return failure('disposed', 'error.disposed');
      try { return this.remember(await action()); }
      catch { this.services.diagnostics.report('setting.operation', 'setting.change'); return this.remember(failure('unexpected', 'error.unexpected')); }
    }).finally(() => { this.pending--; this.changed(); });
    this.queue = work.then(() => undefined, () => undefined); return work;
  }
  private refresh(): Promise<Result<void>> {
    return this.enqueue(async () => {
      const rows = await this.read();
      if (this.disposed) return failure('disposed', 'error.disposed');
      if (!rows.ok) return rows;
      const record = this.accept(rows.value); if (!record.ok) return record;
      this.current = record.value?.values.enabled ?? this.definition.defaultValue; this.problem = undefined;
      return success(undefined);
    });
  }
  set(value: unknown): Promise<Result<void>> {
    return typeof value === 'boolean' ? this.change(() => value) : Promise.resolve(failure('validation', 'error.preferences'));
  }
  toggle(): Promise<Result<void>> { return this.change(value => !value); }
  private async change(next: (value: boolean) => boolean): Promise<Result<void>> {
    await this.initialize();
    return this.enqueue(async () => {
      if (this.problem) return { ok: false, error: this.problem };
      if (this.services.readonly()) return failure('storage', 'error.settingsRead');
      const rows = await this.read();
      if (this.disposed) return failure('disposed', 'error.disposed');
      if (!rows.ok) return rows;
      const record = this.accept(rows.value); if (!record.ok) return record;
      const current = record.value?.values.enabled ?? this.definition.defaultValue; const enabled = next(current);
      if (enabled === current) { this.current = current; return success(undefined); }
      return this.persist(record.value, enabled);
    });
  }
  private async persist(record: PluginDataSnapshot<Values> | undefined, enabled: boolean): Promise<Result<void>> {
    const result = record ? await this.repository.update(record, { ...record.values, enabled }) : await this.repository.create({ enabled });
    if (result.ok && !this.disposed) { this.current = result.value.values.enabled; this.problem = undefined; }
    return result.ok ? success(undefined) : result;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const stop of this.stops.splice(0)) {
      try { stop(); } catch { this.services.diagnostics.report('setting.cleanup', 'setting.dispose'); }
    }
    this.listeners.clear();
  }
}
