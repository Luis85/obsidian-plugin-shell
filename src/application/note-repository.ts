import { failure, success, type Result } from '../domain/outcome';
import { validateDocumentTitle, validateFolder } from '../domain/paths';
import { DocumentCreationService, type PreparedDocument } from './document-service';
import type { DocumentRecipe } from './document-definition';
import type { DocumentCodec } from './document-codec';
import type { DocumentStorage, ErrorReporter } from './ports';
import type { EventPort, ShellEvents } from './events';

export interface NoteSnapshot<V> {
  readonly entity: string;
  readonly id: string;
  readonly schemaVersion: number;
  readonly path: string;
  readonly values: V;
  /** Opaque runtime revision, not a durable database version. */
  readonly revision: number;
}
interface SnapshotState { readonly markdown: string; readonly folder: string }
interface Mutation<V> { readonly fingerprint: string; readonly work: Promise<Result<NoteSnapshot<V> | undefined>> }

/** Bounded folder-scoped CRUD. Notes remain canonical; snapshots grant no overwrite authority. */
export class NoteRepository<I, V> {
  private readonly snapshots = new WeakMap<NoteSnapshot<V>, SnapshotState>();
  private readonly mutations = new WeakMap<NoteSnapshot<V>, Mutation<V>>();
  private readonly committed = new WeakMap<PreparedDocument, NoteSnapshot<V>>();
  private readonly creation: DocumentCreationService<Record<string, I>>;
  private queue: Promise<unknown> = Promise.resolve();
  private revision = 0;
  private disposed = false;
  constructor(
    private readonly recipe: DocumentRecipe<I, V>,
    private readonly storage: DocumentStorage,
    private readonly codec: DocumentCodec,
    private readonly events: EventPort<ShellEvents>,
    private readonly folder: () => string,
    newId: () => string,
    now: () => string,
    private readonly errors: ErrorReporter,
  ) {
    if (Object.keys(recipe.entity.fields).some(field => !recipe.mappings.some(mapping => mapping.field === field))) throw new Error('Repository document mappings must persist every entity field');
    this.creation = new DocumentCreationService({ [recipe.entity.key]: recipe }, {
      create: (path, markdown) => {
        const folder = this.folder();
        return this.enqueue(async () => {
          const rows = await this.list();
          if (!rows.ok) return rows;
          const parsed = this.decode(path, markdown, folder);
          if (!parsed.ok) return parsed;
          if (!parsed.value || rows.value.some(row => row.id === parsed.value?.id)) return failure('conflict', 'error.conflict');
          if (this.disposed) return failure('disposed', 'error.disposed');
          if (folder !== this.folder() || !this.contains(path, folder)) return failure('stale', 'error.stale');
          return storage.create(path, markdown);
        });
      },
    }, events, codec.render, newId, now, errors);
  }
  prepare(values: I, requestId: string): Result<PreparedDocument> {
    return this.creation.prepare(this.recipe.entity.key, values, this.folder(), requestId);
  }
  discard(plan: PreparedDocument): boolean { return this.creation.discard(plan); }
  async create(values: I, requestId: string): Promise<Result<NoteSnapshot<V>>> {
    const prepared = this.prepare(values, requestId);
    return prepared.ok ? this.commit(prepared.value) : prepared;
  }
  async commit(plan: PreparedDocument): Promise<Result<NoteSnapshot<V>>> {
    const created = await this.creation.commit(plan, this.folder());
    if (!created.ok) return created;
    const prior = this.committed.get(plan);
    if (prior) return success(prior);
    const snapshot = this.decode(plan.path, plan.markdown);
    if (!snapshot.ok) return snapshot;
    if (!snapshot.value) return failure('unexpected', 'error.unexpected');
    this.committed.set(plan, snapshot.value);
    return success(snapshot.value);
  }
  async list(): Promise<Result<readonly NoteSnapshot<V>[]>> {
    if (this.disposed) return failure('disposed', 'error.disposed');
    const folder = validateFolder(this.folder());
    if (!folder.ok) return folder;
    try {
      const paths = await this.storage.list(folder.value);
      if (!paths.ok) return paths;
      if (paths.value.length > 1000) return failure('validation', 'error.repositoryLimit');
      const rows: NoteSnapshot<V>[] = [];
      const identities = new Set<string>();
      for (const path of [...paths.value].sort()) {
        if (!this.contains(path, folder.value)) return failure('validation', 'error.folder');
        const read = await this.storage.read(path);
        if (!read.ok) return read;
        const decoded = this.decode(path, read.value, folder.value);
        if (!decoded.ok) return decoded;
        if (!decoded.value) continue;
        if (identities.has(decoded.value.id)) return failure('conflict', 'error.duplicateIdentity');
        identities.add(decoded.value.id); rows.push(decoded.value);
      }
      if (this.folder() !== folder.value) return failure('stale', 'error.stale');
      return success(Object.freeze(rows));
    } catch { this.errors.report('repository.read', 'repository.list'); return failure('storage', 'error.read'); }
  }
  async get(path: string): Promise<Result<NoteSnapshot<V>>> {
    const rows = await this.list();
    if (!rows.ok) return rows;
    const match = rows.value.find(row => row.path === path);
    return match ? success(match) : failure('storage', 'error.read');
  }
  async update(snapshot: NoteSnapshot<V>, values: I): Promise<Result<NoteSnapshot<V>>> {
    const parsed = this.recipe.entity.parse(values);
    if (!parsed.ok) return parsed;
    const properties = this.recipe.properties(parsed.value);
    if (!properties.ok) return properties;
    const result = await this.mutate(snapshot, JSON.stringify(properties.value), async state => {
      const patched = this.codec.patch(state.markdown, properties.value, this.recipe.mappings.map(mapping => mapping.property));
      if (!patched.ok) return patched;
      const changed = this.decode(snapshot.path, patched.value, state.folder);
      if (!changed.ok) return changed;
      if (!changed.value) return failure('validation', 'error.entity');
      const written = await this.storage.replace(snapshot.path, state.markdown, patched.value);
      if (!written.ok) return written;
      this.publish('documents.updated', changed.value);
      return success(changed.value);
    });
    if (!result.ok) return result;
    return result.value ? success(result.value) : failure('stale', 'error.stale');
  }
  async delete(snapshot: NoteSnapshot<V>): Promise<Result<void>> {
    const result = await this.mutate(snapshot, 'delete', async state => {
      const deleted = await this.storage.trash(snapshot.path, state.markdown);
      if (!deleted.ok) return deleted;
      this.publish('documents.deleted', snapshot);
      return success(undefined);
    });
    return result.ok ? success(undefined) : result;
  }
  private mutate(snapshot: NoteSnapshot<V>, fingerprint: string, action: (state: SnapshotState) => Promise<Result<NoteSnapshot<V> | undefined>>): Promise<Result<NoteSnapshot<V> | undefined>> {
    if (this.disposed) return Promise.resolve(failure('disposed', 'error.disposed'));
    const prior = this.mutations.get(snapshot);
    if (prior) return prior.fingerprint === fingerprint ? prior.work : Promise.resolve(failure('stale', 'error.stale'));
    const state = this.snapshots.get(snapshot);
    if (!state || state.folder !== this.folder()) return Promise.resolve(failure('stale', 'error.stale'));
    const work = this.enqueue(async () => {
      const current = await this.get(snapshot.path);
      if (!current.ok) return current;
      if (this.disposed) return failure('disposed', 'error.disposed');
      if (state.folder !== this.folder() || this.snapshots.get(current.value)?.markdown !== state.markdown) return failure('stale', 'error.stale');
      try { return await action(state); }
      catch { this.errors.report('repository.write', 'repository.mutate'); return failure('uncertain', 'error.uncertain'); }
    });
    this.mutations.set(snapshot, { fingerprint, work });
    return work;
  }
  private decode(path: string, markdown: string, folder = this.folder()): Result<NoteSnapshot<V> | undefined> {
    const read = this.codec.read(markdown);
    if (!read.ok) return read;
    if (!read.value || read.value.properties.type !== this.recipe.entity.key) return success(undefined);
    const { id, schema_version: version, created_at: createdAt } = read.value.properties;
    if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(id) || version !== this.recipe.entity.schemaVersion || typeof createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(createdAt) || !Number.isFinite(Date.parse(createdAt)) || new Date(createdAt).toISOString().replace('.000Z', 'Z') !== createdAt.replace('.000Z', 'Z')) return failure('validation', 'error.entity');
    const values = this.recipe.decode(read.value.properties);
    if (!values.ok) return values;
    const snapshot = Object.freeze({ entity: this.recipe.entity.key, id, schemaVersion: version, path, values: values.value, revision: ++this.revision });
    this.snapshots.set(snapshot, { markdown, folder });
    return success(snapshot);
  }
  private contains(path: string, folder: string): boolean {
    const split = path.lastIndexOf('/');
    return path.startsWith(`${folder}/`) && path.endsWith('.md') && validateFolder(path.slice(0, split)).ok && validateDocumentTitle(path.slice(split + 1, -3)).ok;
  }
  private publish(type: 'documents.updated' | 'documents.deleted', snapshot: NoteSnapshot<V>): void {
    try { this.events.publish({ type, payload: { entity: snapshot.entity, id: snapshot.id, schemaVersion: snapshot.schemaVersion, path: snapshot.path } }); }
    catch { this.errors.report('event.publish', 'repository.publish'); }
  }
  private enqueue<T>(action: () => Promise<Result<T>>): Promise<Result<T>> {
    const work = this.queue.then(() => this.disposed ? failure('disposed', 'error.disposed') : action());
    this.queue = work.catch(() => undefined);
    return work;
  }
  dispose(): void { this.disposed = true; this.creation.dispose(); }
}
