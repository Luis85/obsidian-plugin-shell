import { plainRecord, type EntityDefinition } from '../domain/entity';
import { failure, success, type Result } from '../domain/outcome';
import type { EventPort, ShellEvents } from './events';
import type { ErrorReporter } from './ports';
import { PluginDataStore, type PluginDataEnvelope } from './plugin-data-store';

export interface PluginDataSnapshot<V> {
  readonly backend: 'plugin-data';
  readonly entity: string;
  readonly id: string;
  readonly schemaVersion: number;
  readonly revision: number;
  readonly createdAt: string;
  readonly values: V;
}
interface RecordValue<V> { readonly id: string; readonly revision: number; readonly createdAt: string; readonly values: V }
interface Collection<V> { readonly schemaVersion: number; readonly revision: number; readonly records: readonly RecordValue<V>[]; readonly storedValues: ReadonlyMap<string, unknown> }
interface Registry { readonly schemaVersion: 1; readonly collections: Readonly<Record<string, unknown>> }
const corrupt = () => failure('storage', 'error.pluginDataRead');
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key));
function registry(data: PluginDataEnvelope): Result<Registry> {
  const raw = data.pluginEntities;
  if (raw === undefined) return success({ schemaVersion: 1, collections: {} });
  if (!plainRecord(raw) || raw.schemaVersion !== 1 || !plainRecord(raw.collections) || !exact(raw, ['schemaVersion', 'collections'])) return corrupt();
  return success({ schemaVersion: 1, collections: raw.collections });
}

/** Plugin data is canonical only for explicitly selected plugin-data features. */
export class PluginDataRepository<I, V> {
  private disposed = false;
  private readonly snapshots = new WeakSet<PluginDataSnapshot<V>>();
  constructor(private readonly entity: EntityDefinition<I, V>, private readonly data: PluginDataStore,
    private readonly events: EventPort<ShellEvents>, private readonly newId: () => string,
    private readonly now: () => string, private readonly errors: ErrorReporter) {}
  private collection(data: PluginDataEnvelope): Result<Collection<V>> {
    const root = registry(data);
    if (!root.ok) return root;
    const raw = Object.hasOwn(root.value.collections, this.entity.key) ? root.value.collections[this.entity.key] : undefined;
    if (raw === undefined) return success({ schemaVersion: this.entity.schemaVersion, revision: 0, records: [], storedValues: new Map() });
    if (!plainRecord(raw) || !exact(raw, ['schemaVersion', 'revision', 'records']) || raw.schemaVersion !== this.entity.schemaVersion || !Number.isSafeInteger(raw.revision) || typeof raw.revision !== 'number' || raw.revision < 0 || !Array.isArray(raw.records) || raw.records.length > 1000) return corrupt();
    const records: RecordValue<V>[] = [];
    const storedValues = new Map<string, unknown>();
    const ids = new Set<string>();
    for (const row of raw.records) {
      if (!plainRecord(row) || !exact(row, ['id', 'revision', 'createdAt', 'values']) || !validId(row.id) || ids.has(row.id) || typeof row.revision !== 'number' || !Number.isSafeInteger(row.revision) || row.revision < 1 || row.revision > raw.revision || typeof row.createdAt !== 'string' || !row.createdAt.length || row.createdAt.length > 100) return corrupt();
      const values = this.entity.decode(row.values);
      if (!values.ok) return corrupt();
      records.push({ id: row.id, revision: row.revision, createdAt: row.createdAt, values: values.value });
      storedValues.set(row.id, row.values);
      ids.add(row.id);
    }
    return success({ schemaVersion: this.entity.schemaVersion, revision: raw.revision, records, storedValues });
  }
  private snapshot(row: RecordValue<V>): PluginDataSnapshot<V> {
    const snapshot: PluginDataSnapshot<V> = Object.freeze({ ...row, entity: this.entity.key, schemaVersion: this.entity.schemaVersion, backend: 'plugin-data' });
    this.snapshots.add(snapshot);
    return snapshot;
  }
  async list(): Promise<Result<readonly PluginDataSnapshot<V>[]>> {
    const data = await this.data.read();
    if (this.disposed) return failure('disposed', 'error.disposed');
    if (!data.ok) return data;
    const collection = this.collection(data.value);
    return collection.ok ? success(Object.freeze(collection.value.records.map(row => this.snapshot(row)))) : collection;
  }
  async get(id: string): Promise<Result<PluginDataSnapshot<V>>> {
    const rows = await this.list();
    if (!rows.ok) return rows;
    const row = rows.value.find(row => row.id === id);
    return row ? success(row) : failure('storage', 'error.pluginDataMissing');
  }
  create(input: I): Promise<Result<PluginDataSnapshot<V>>> {
    const values = this.entity.parse(input);
    if (!values.ok) return Promise.resolve(values);
    return this.write('created', collection => {
      if (collection.records.length >= 1000) return failure('validation', 'error.pluginDataLimit');
      const id = this.newId(); const createdAt = this.now();
      if (!validId(id) || !createdAt.length || createdAt.length > 100) return failure('validation', 'error.entity');
      if (collection.records.some(row => row.id === id)) return failure('conflict', 'error.pluginDataConflict');
      const row = { id, revision: collection.revision + 1, createdAt, values: values.value };
      return success({ row, records: [...collection.records, row] });
    });
  }
  update(snapshot: PluginDataSnapshot<V>, input: I): Promise<Result<PluginDataSnapshot<V>>> {
    const values = this.entity.parse(input);
    if (!values.ok) return Promise.resolve(values);
    return this.write('updated', collection => {
      const current = this.match(collection, snapshot);
      if (!current.ok) return current;
      const row = { ...current.value, revision: collection.revision + 1, values: values.value };
      return success({ row, records: collection.records.map(value => value.id === row.id ? row : value) });
    });
  }
  async delete(snapshot: PluginDataSnapshot<V>): Promise<Result<void>> {
    const result = await this.write('deleted', collection => {
      const current = this.match(collection, snapshot);
      return current.ok ? success({ row: { ...current.value, revision: collection.revision + 1 }, records: collection.records.filter(row => row.id !== snapshot.id) }) : current;
    });
    return result.ok ? success(undefined) : result;
  }
  private match(collection: Collection<V>, snapshot: PluginDataSnapshot<V>): Result<RecordValue<V>> {
    if (!this.snapshots.has(snapshot)) return failure('stale', 'error.pluginDataStale');
    const current = collection.records.find(row => row.id === snapshot.id);
    return current && current.revision === snapshot.revision ? success(current) : failure('stale', 'error.pluginDataStale');
  }
  private async write(kind: 'created' | 'updated' | 'deleted', change: (collection: Collection<V>) => Result<{ row: RecordValue<V>; records: readonly RecordValue<V>[] }>): Promise<Result<PluginDataSnapshot<V>>> {
    const result = await this.data.transact(data => {
      const collection = this.collection(data);
      if (!collection.ok) return collection;
      if (collection.value.revision >= Number.MAX_SAFE_INTEGER) return failure('validation', 'error.pluginDataLimit');
      const next = change(collection.value);
      if (!next.ok) return next;
      const root = registry(data);
      if (!root.ok) return root;
      const records = next.value.records.map(row => ({ ...row,
        values: collection.value.records.includes(row) ? collection.value.storedValues.get(row.id) : row.values,
      }));
      const updated = { schemaVersion: collection.value.schemaVersion, revision: collection.value.revision + 1, records };
      return success({ data: { ...data, pluginEntities: { ...root.value, collections: { ...root.value.collections, [this.entity.key]: updated } } }, value: this.snapshot(next.value.row) });
    }, () => !this.disposed);
    if (result.ok && !this.disposed) {
      const row = result.value;
      try { this.events.publish({ type: `plugin-data.${kind}`, payload: { entity: row.entity, id: row.id, schemaVersion: row.schemaVersion, revision: row.revision } }); }
      catch { this.errors.report('plugin-data.listener', 'plugin-data.notify'); }
    }
    return result;
  }
  dispose(): void { this.disposed = true; }
}
