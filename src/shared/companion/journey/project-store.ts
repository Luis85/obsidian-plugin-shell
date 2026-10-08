import { parseAuthoringDocument, validateAuthoringDocument, type AuthoringDocument } from '../authoring-contract.ts';
import type { SitemapDesign } from '../sitemap/model.ts';
import type { SitemapHost, SitemapSaveResult, SitemapSnapshot } from '../sitemap/session.ts';
import { canonicalKey, requireSitemap, utf8Length } from '../sitemap/safety.ts';

export type ProjectWrite = { status: 'committed'; content: string } | { status: 'conflict' } |
  { status: 'failed'; certainty: 'unchanged' | 'unknown' };
/** replace MUST compare exact expected bytes at the write boundary; a prior read is insufficient. */
export interface ProjectFilePort {
  read(path: string): Promise<string>;
  create(path: string, content: string): Promise<ProjectWrite>;
  replace(path: string, expected: string, content: string): Promise<ProjectWrite>;
}
export interface ProjectChange { origin: object | null; uncertain: boolean; content?: string }
export function projectFilePath(input: string): string {
  requireSitemap(typeof input === 'string' && input.length <= 240 && /\.(?:json|companion)$/i.test(input),
    'PROJECT_PATH', 'Choose a vault-relative .json or .companion project file.');
  requireSitemap(input.split('/').every(part => part.length && !/^[. ]|[. ]$|[<>:"\\|?*\u0000-\u001f]/.test(part) &&
    !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)), 'PROJECT_PATH', 'Choose a portable visible vault path.');
  return input;
}
export function importJourneyProject(text: string): AuthoringDocument {
  return structuredClone(parseAuthoringDocument(text));
}
function serialize(document: AuthoringDocument): string {
  validateAuthoringDocument(document);
  const text = JSON.stringify(document, null, 2) + '\n';
  requireSitemap(utf8Length(text) <= 4_000_000, 'COMPANION_LIMIT', 'The formatted project exceeds 4 MB.');
  return text;
}

/** One runtime owner serializes file transactions and uncertainty across independent editor leaves. */
export class JourneyProjectStore {
  private stopped = false;
  private serial = 0;
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly uncertain = new Set<string>();
  private readonly observers = new Map<string, Set<(event: ProjectChange) => void>>();
  private readonly files: ProjectFilePort;
  private readonly report: () => void;
  constructor(files: ProjectFilePort, report: () => void = () => {}) { this.files = files; this.report = report; }
  connect(input: string): JourneyProjectDocument {
    requireSitemap(!this.stopped, 'PROJECT_DISPOSED', 'The project owner is closed.');
    return new JourneyProjectDocument(this, projectFilePath(input));
  }
  writable(path: string): boolean { return !this.stopped && !this.uncertain.has(path); }
  revision(): string { return 'project-' + ++this.serial; }
  async read(path: string): Promise<string> {
    await this.queues.get(path);
    requireSitemap(!this.stopped, 'PROJECT_DISPOSED', 'The project owner is closed.');
    return this.files.read(path);
  }
  subscribe(path: string, listener: (event: ProjectChange) => void): () => void {
    const listeners = this.observers.get(path) ?? new Set(); listeners.add(listener); this.observers.set(path, listeners);
    return () => { listeners.delete(listener); if (!listeners.size) this.observers.delete(path); };
  }
  private publish(path: string, origin: object | null, content?: string): void {
    for (const listener of [...(this.observers.get(path) ?? [])]) {
      try { listener({ origin, uncertain: this.uncertain.has(path), ...(content === undefined ? {} : { content }) }); } catch { try { this.report(); } catch { /* Observation cannot change a committed write. */ } }
    }
  }
  /** Host file events are observed after queued writes settle; identical self-write events are ignored per leaf. */
  async refresh(path: string): Promise<void> {
    if(this.stopped || !this.observers.has(path))return;
    let content: string | undefined;
    try { content=await this.read(path); } catch { /* Missing, renamed or unreadable files require explicit recovery. */ }
    if(!this.stopped)this.publish(path,null,content);
  }
  recover(path: string, origin: object): void { this.uncertain.delete(path); this.publish(path, origin); }
  write(path: string, expected: string | null, content: string, origin: object): Promise<ProjectWrite> {
    const previous = this.queues.get(path) ?? Promise.resolve();
    const task = previous.then(async (): Promise<ProjectWrite> => {
      if (!this.writable(path)) return { status: 'failed', certainty: 'unchanged' };
      let result: ProjectWrite;
      try { result = expected === null ? await this.files.create(path, content) : await this.files.replace(path, expected, content); }
      catch { result = { status: 'failed', certainty: 'unknown' }; }
      if (!result || !['committed', 'conflict', 'failed'].includes(result.status) ||
        result.status === 'committed' && result.content !== content ||
        result.status === 'failed' && !['unchanged', 'unknown'].includes(result.certainty)) result = { status: 'failed', certainty: 'unknown' };
      if (result.status === 'failed' && result.certainty === 'unknown') this.uncertain.add(path);
      if (result.status === 'committed' || this.uncertain.has(path)) this.publish(path, origin);
      return result;
    });
    this.queues.set(path, task);
    void task.finally(() => { if (this.queues.get(path) === task) this.queues.delete(path); });
    return task;
  }
  /** In-flight persistence settles; closing UI is never permission to retry an uncertain write. */
  dispose(): void { this.stopped = true; this.observers.clear(); }
}

/** Per-leaf read preimage, history and drafts are not another canonical persistence mechanism. */
export class JourneyProjectDocument implements SitemapHost<SitemapDesign> {
  private saved: { raw: string; document: AuthoringDocument; revision: string } | null = null;
  private stopped = false;
  private busy = false;
  private readonly owner: JourneyProjectStore;
  readonly path: string;
  constructor(owner: JourneyProjectStore, path: string) { this.owner = owner; this.path = path; }
  private accept(raw: string): SitemapSnapshot<SitemapDesign> {
    const document = importJourneyProject(raw);
    this.saved = { raw, document, revision: this.owner.revision() };
    return { revision: this.saved.revision, writable: this.owner.writable(this.path), design: structuredClone(document.design) };
  }
  async read(): Promise<SitemapSnapshot<SitemapDesign>> {
    requireSitemap(!this.stopped && !this.busy, 'PROJECT_BUSY', 'The project session is closed or saving.');
    const raw = await this.owner.read(this.path);
    requireSitemap(!this.stopped, 'PROJECT_DISPOSED', 'The project session is closed.');
    return this.accept(raw);
  }
  validate(design: SitemapDesign): void {
    requireSitemap(this.saved, 'PROJECT_UNLOADED', 'Open a project before editing.');
    validateAuthoringDocument({ ...this.saved.document, design });
  }
  export(): string {
    requireSitemap(this.saved && !this.stopped, 'PROJECT_UNLOADED', 'Open a project before exporting.');
    return serialize(this.saved.document);
  }
  subscribe(listener: (event: ProjectChange) => void): () => void { return this.owner.subscribe(this.path, event => {
    if(event.origin===null && !event.uncertain && event.content===this.saved?.raw)return;
    listener(event);
  }); }
  async save(request: { expectedRevision: string; beforeKey: string; design: SitemapDesign }): Promise<SitemapSaveResult<SitemapDesign>> {
    if (!this.saved || request.expectedRevision !== this.saved.revision || request.beforeKey !== canonicalKey(this.saved.document.design)) return { status: 'conflict' };
    let content: string;
    try { content = serialize(validateAuthoringDocument({ ...this.saved.document, design: structuredClone(request.design) })); }
    catch { return { status: 'failed', certainty: 'unchanged' }; }
    return this.persist(content, this.saved.raw);
  }
  /** Explicit user confirmation chooses create-only or replacement of this session's exact read preimage. */
  async importProject(text: string, mode: 'create' | 'replace'): Promise<SitemapSaveResult<SitemapDesign>> {
    requireSitemap(mode === 'create' || mode === 'replace', 'PROJECT_MODE', 'Choose create or replace.');
    const candidate = serialize(importJourneyProject(text));
    requireSitemap(mode === 'create' || this.saved, 'PROJECT_UNLOADED', 'Open the existing project before replacing it.');
    return this.persist(candidate, mode === 'create' ? null : this.saved!.raw);
  }
  private async persist(content: string, expected: string | null): Promise<SitemapSaveResult<SitemapDesign>> {
    if (this.stopped || this.busy || !this.owner.writable(this.path)) return { status: 'failed', certainty: 'unchanged' };
    this.busy = true;
    try {
      const result = await this.owner.write(this.path, expected, content, this);
      if (result.status !== 'committed') return result;
      // An already committed operation is reported as such, even after its view closes.
      return { status: 'committed', snapshot: this.accept(result.content) };
    } finally { this.busy = false; }
  }
  /** Only an explicit recovery action can restore write permission after inspecting stored bytes. */
  async recover(): Promise<SitemapSnapshot<SitemapDesign>> {
    const snapshot = await this.read();
    this.owner.recover(this.path, this);
    return { ...snapshot, writable: this.owner.writable(this.path) };
  }
  dispose(): void { this.stopped = true; }
}
