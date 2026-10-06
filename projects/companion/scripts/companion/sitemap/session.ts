import type { SitemapCommand, SitemapDesign } from './model.ts';
import type { SitemapChange, SitemapHistory, SitemapChangeResult } from './transaction.ts';
import { applySitemapChange, planSitemapChange, travelSitemapHistory } from './transaction.ts';
import { assertJson, canonicalKey, sitemapObject as object, record, requireSitemap, sitemapText as text } from './safety.ts';
import { validateSitemapModel } from './validate.ts';

export interface SitemapSnapshot<T extends SitemapDesign> {
  revision: string;
  /** False while the canonical owner is read-only or has an unresolved persistence outcome. */
  writable: boolean;
  design: T;
}
export type SitemapSaveResult<T extends SitemapDesign> =
  | { status: 'committed'; snapshot: SitemapSnapshot<T> }
  | { status: 'conflict' }
  | { status: 'failed'; certainty: 'unchanged' | 'unknown' };

/**
 * The host owns canonical persistence and serialization. It must compare both preconditions
 * immediately before writing and publish its committed fact even if this view was disposed.
 * A session does not make an unsafe localStorage or file writer transactional.
 */
export interface SitemapHost<T extends SitemapDesign> {
  read(): Promise<SitemapSnapshot<T>>;
  validate(design: T): void;
  save(request: { expectedRevision: string; beforeKey: string; design: T }): Promise<SitemapSaveResult<T>>;
}
export interface SitemapSessionOutcome {
  status: 'loaded' | 'committed' | 'unchanged' | 'blocked' | 'conflict' | 'failed' | 'uncertain' | 'disposed';
  evicted?: number;
  detached?: boolean;
  requiresReload?: boolean;
}

/** Per-view controller. No browser globals, Pinia dependency, storage writer or global event bus. */
export class SitemapSession<T extends SitemapDesign> {
  private readonly host: SitemapHost<T>;
  private current: SitemapSnapshot<T> | null = null;
  private history: SitemapHistory<T> = { past: [], future: [] };
  private busy = false;
  private disposed = false;
  private requiresReload = false;

  constructor(host: SitemapHost<T>) { this.host = host; }

  snapshot(): SitemapSnapshot<T> | null { return this.current ? structuredClone(this.current) : null; }
  state(): { loaded: boolean; writable: boolean; busy: boolean; requiresReload: boolean; canUndo: boolean; canRedo: boolean } {
    const writable = !!this.current?.writable && !this.requiresReload && !this.disposed;
    return { loaded: this.current !== null, writable, busy: this.busy, requiresReload: this.requiresReload,
      canUndo: writable && !this.busy && this.history.past.length > 0,
      canRedo: writable && !this.busy && this.history.future.length > 0 };
  }

  private acceptSnapshot(value: SitemapSnapshot<T>): SitemapSnapshot<T> {
    assertJson(value); object(value, ['revision', 'writable', 'design']); text(value.revision, 160);
    requireSitemap(typeof value.writable === 'boolean', 'SITEMAP_HOST', 'The host must declare its write availability.');
    validateSitemapModel(value.design);
    const detached = structuredClone(value);
    // Validate against the complete project format as well as this module's structural subset.
    this.host.validate(structuredClone(detached.design));
    return detached;
  }

  /** Explicit refresh: only the canonical owner may resolve uncertain writes before returning writable=true. */
  async load(): Promise<SitemapSessionOutcome> {
    if (this.disposed) return { status: 'disposed' };
    if (this.busy) return { status: 'blocked' };
    this.busy = true;
    try {
      const snapshot = this.acceptSnapshot(await this.host.read());
      if (this.disposed) return { status: 'disposed' };
      this.current = snapshot; this.history = { past: [], future: [] }; this.requiresReload = false;
      return { status: 'loaded' };
    } catch {
      if (this.disposed) return { status: 'disposed' };
      this.requiresReload = true; return { status: 'failed' };
    } finally { this.busy = false; }
  }

  plan(command: SitemapCommand): SitemapChange {
    requireSitemap(this.current && !this.busy && !this.disposed && !this.requiresReload,
      'SITEMAP_SESSION', 'Load a current idle project before reviewing changes.');
    return planSitemapChange(this.current.design, command);
  }

  async apply(review: SitemapChange): Promise<SitemapSessionOutcome> {
    return this.change((design, history) => applySitemapChange(design, review, history));
  }
  async undo(): Promise<SitemapSessionOutcome> { return this.travel('undo'); }
  async redo(): Promise<SitemapSessionOutcome> { return this.travel('redo'); }
  private async travel(direction: 'undo' | 'redo'): Promise<SitemapSessionOutcome> {
    return this.change((design, history) => travelSitemapHistory(design, history, direction));
  }

  private async change(prepare: (design: T, history: SitemapHistory<T>) => SitemapChangeResult<T>): Promise<SitemapSessionOutcome> {
    if (this.disposed) return { status: 'disposed' };
    if (this.busy || !this.current || !this.current.writable || this.requiresReload) return { status: 'blocked' };
    const original = this.current;
    let candidate: SitemapChangeResult<T>;
    // Do not transfer history or authority until the complete candidate has been accepted by the host.
    try {
      candidate = prepare(original.design, this.history);
      this.host.validate(structuredClone(candidate.design));
    } catch { return { status: 'blocked' }; }
    if (candidate.design === original.design) return { status: 'unchanged' };
    if (this.disposed) return { status: 'disposed' };
    this.busy = true;
    try {
      let outcome: SitemapSaveResult<T>;
      try {
        outcome = await this.host.save({ expectedRevision: original.revision,
          beforeKey: canonicalKey(original.design), design: structuredClone(candidate.design) });
      } catch {
        this.requiresReload = true;
        return { status: 'uncertain', ...(this.disposed ? { detached: true } : {}) };
      }
      const status = record(outcome) ? Object.getOwnPropertyDescriptor(outcome, 'status')?.value : undefined;
      if (!['committed', 'conflict', 'failed'].includes(status)) {
        this.requiresReload = true; return { status: 'uncertain', ...(this.disposed ? { detached: true } : {}) };
      }
      if (outcome.status === 'conflict') {
        this.requiresReload = true;
        return { status: 'conflict', ...(this.disposed ? { detached: true } : {}) };
      }
      if (outcome.status === 'failed') {
        const certainty = Object.getOwnPropertyDescriptor(outcome, 'certainty')?.value;
        if (certainty !== 'unchanged') this.requiresReload = true;
        return { status: certainty === 'unchanged' ? 'failed' : 'uncertain', ...(this.disposed ? { detached: true } : {}) };
      }
      if (this.disposed) return { status: 'committed', detached: true };
      try {
        const receipt = Object.getOwnPropertyDescriptor(outcome, 'snapshot');
        requireSitemap(receipt && 'value' in receipt, 'SITEMAP_HOST', 'Expected a committed snapshot value.');
        const snapshot = this.acceptSnapshot(receipt.value);
        requireSitemap(snapshot.revision !== original.revision && canonicalKey(snapshot.design) === canonicalKey(candidate.design),
          'SITEMAP_HOST', 'The committed receipt differs from the intended design or revision.');
        this.current = snapshot; this.history = candidate.history;
        return { status: 'committed', evicted: candidate.evicted };
      } catch {
        this.requiresReload = true;
        // Persistence already succeeded. Bad observation must not turn that fact into a failed write.
        return { status: 'committed', requiresReload: true };
      }
    } finally { this.busy = false; }
  }

  /** Does not cancel an already-started canonical write or dispose resources owned by other views. */
  dispose(): void { this.disposed = true; }
}
