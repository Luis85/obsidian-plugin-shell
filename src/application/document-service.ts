import { validateDocumentTitle, validateFolder } from '../domain/paths';
import { failure, success, type Result } from '../domain/outcome';
import type { DocumentWriter, ErrorReporter } from './ports';
import type { EventPort, ShellEvents } from './events';
export type Frontmatter = Readonly<Record<string, string | number | boolean | readonly string[]>>;
export interface DocumentDefinition<I> {
  project(input: I): Result<{ readonly title: string; readonly properties: Frontmatter; readonly body: string; readonly schemaVersion?: number }>;
}
export interface DocumentReceipt { readonly id: string; readonly entity: string; readonly path: string; readonly schemaVersion: number }
export interface PreparedDocument extends DocumentReceipt { readonly markdown: string; readonly requestId: string; readonly folder: string }
interface RecordEntry { readonly input: string; readonly plan: PreparedDocument; result?: Result<DocumentReceipt>; work?: Promise<Result<DocumentReceipt>> }
/** Session-bounded creation. Markdown, never data.json, is the entity's durable record. */
export class DocumentCreationService<Inputs> {
  private readonly requests = new Map<string, RecordEntry>();
  private disposed = false;
  constructor(
    private readonly definitions: { [K in keyof Inputs]: DocumentDefinition<Inputs[K]> },
    private readonly writer: DocumentWriter,
    private readonly events: EventPort<ShellEvents>,
    private readonly serialize: (properties: Frontmatter, body: string) => string,
    private readonly newId: () => string,
    private readonly now: () => string,
    private readonly errors?: ErrorReporter,
  ) { this.definitions = Object.freeze({ ...definitions }); }
  prepare<K extends keyof Inputs & string>(entity: K, values: Inputs[K], folderInput: string, requestId: string): Result<PreparedDocument> {
    try { return this.prepareRequest(entity, values, folderInput, requestId); }
    catch { this.errors?.report('document.prepare', 'document.prepare'); return failure('unexpected', 'error.unexpected'); }
  }
  private prepareRequest<K extends keyof Inputs & string>(entity: K, values: Inputs[K], folderInput: string, requestId: string): Result<PreparedDocument> {
    if (this.disposed) return failure('disposed', 'error.disposed');
    const folder = validateFolder(folderInput);
    if (!folder.ok) return folder;
    if (!/^[a-zA-Z0-9:-]{1,100}$/.test(requestId)) return failure('validation', 'error.request');
    const definition = Object.hasOwn(this.definitions, entity) ? this.definitions[entity] : undefined;
    if (!definition) return failure('validation', 'error.entity');
    const projection = definition.project(values);
    if (!projection.ok) return projection;
    const fingerprint = JSON.stringify([entity, projection.value, folder.value]);
    const previous = this.requests.get(requestId);
    if (previous) return previous.input === fingerprint ? success(previous.plan) : failure('stale', 'error.stale');
    if (this.requests.size >= 100) return failure('validation', 'error.sessionLimit');
    const id = this.newId();
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) return failure('unexpected', 'error.unexpected');
    const { title, properties, body } = projection.value;
    const schemaVersion = projection.value.schemaVersion ?? 1;
    if (!Number.isSafeInteger(schemaVersion) || schemaVersion < 1 || typeof title !== 'string' || typeof body !== 'string' || body.length > 1_000_000) return failure('validation', 'error.entity');
    const filename = validateDocumentTitle(title);
    if (!filename.ok) return filename;
    if (Object.keys(properties).some(k => ['type', 'id', 'schema_version', 'created_at'].includes(k))) return failure('validation', 'error.entity');
    const markdown = this.serialize({ type: entity, id, schema_version: schemaVersion, created_at: this.now(), ...properties }, body);
    if (markdown.length > 1_000_000) return failure('validation', 'error.entity');
    const plan = Object.freeze({ entity, id, schemaVersion, requestId, folder: folder.value, path: `${folder.value}/${filename.value}.md`, markdown });
    this.requests.set(requestId, { input: fingerprint, plan });
    return success(plan);
  }
  /** Release only an unused preview. Keep all attempted writes for safe deduplication. */
  discard(plan: PreparedDocument): boolean {
    const entry = this.requests.get(plan.requestId);
    if (!entry || entry.plan !== plan || entry.work || entry.result) return false;
    return this.requests.delete(plan.requestId);
  }
  async commit(plan: PreparedDocument, currentFolder: string): Promise<Result<DocumentReceipt>> {
    if (this.disposed) return failure('disposed', 'error.disposed');
    const entry = this.requests.get(plan.requestId);
    if (!entry || entry.plan !== plan || plan.folder !== currentFolder) return failure('stale', 'error.stale');
    if (entry.result) return entry.result;
    if (entry.work) return entry.work;
    entry.work = this.write(entry);
    return entry.work;
  }
  private async write(entry: RecordEntry): Promise<Result<DocumentReceipt>> {
    const plan = entry.plan;
    let outcome: Result<void>;
    try { outcome = await this.writer.create(plan.path, plan.markdown); }
    catch { outcome = failure('uncertain', 'error.uncertain'); }
    if (!outcome.ok) { entry.result = outcome; return outcome; }
    const receipt = Object.freeze({ entity: plan.entity, id: plan.id, path: plan.path, schemaVersion: plan.schemaVersion });
    entry.result = success(receipt);
    try { this.events.publish({ type: 'documents.created', payload: receipt }); }
    catch { this.errors?.report('event.publish', 'document.publish'); }
    return entry.result;
  }
  dispose(): void { this.disposed = true; this.requests.clear(); }
}
