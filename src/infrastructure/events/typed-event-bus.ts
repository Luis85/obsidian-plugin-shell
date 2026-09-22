import type { EventInput, EventPort } from '../../application/events';
import type { ErrorReporter, Unsubscribe } from '../../application/ports';
interface Subscription { active: boolean; invoke: (payload: unknown) => void | Promise<void> }
function freeze(value: unknown): void {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value); for (const child of Object.values(value)) freeze(child);
  }
}
/** Synchronous notification order; rejected async listeners are observed, not awaited. */
export class TypedEventBus<M> implements EventPort<M> {
  private readonly listeners = new Map<keyof M, Set<Subscription>>();
  private disposed = false;
  private depth = 0;
  constructor(private readonly errors: ErrorReporter) {}
  on<K extends keyof M>(type: K, listener: (payload: M[K]) => void | Promise<void>): Unsubscribe {
    if (this.disposed) throw new Error('BUS_DISPOSED');
    const set = this.listeners.get(type) ?? new Set<Subscription>();
    // The only erased boundary: registration keeps this wrapper in the same key's set.
    const entry: Subscription = { active: true, invoke: value => listener(value as M[K]) };
    set.add(entry); this.listeners.set(type, set);
    return () => { entry.active = false; set.delete(entry); if (!set.size) this.listeners.delete(type); };
  }
  once<K extends keyof M>(type: K, listener: (payload: M[K]) => void | Promise<void>): Unsubscribe {
    const off = this.on(type, payload => { off(); return listener(payload); });
    return off;
  }
  publish(event: EventInput<M>): void {
    if (this.disposed) return;
    if (this.depth >= 32) { this.errors.report('event.recursion', 'event.dispatch'); return; }
    const payload: unknown = structuredClone(event.payload); freeze(payload);
    this.depth++;
    try {
      // Snapshot is required: a listener added during dispatch starts with the next event.
      // oxlint-disable-next-line unicorn/no-useless-spread
      for (const entry of [...(this.listeners.get(event.type) ?? [])]) {
        if (!entry.active) continue;
        try {
          const result = entry.invoke(payload);
          if (result) Promise.resolve(result).catch(() => this.errors.report('event.listener', 'event.dispatch'));
        } catch { this.errors.report('event.listener', 'event.dispatch'); }
      }
    } finally { this.depth--; }
  }
  get size(): number { return [...this.listeners.values()].reduce((sum, entries) => sum + entries.size, 0); }
  dispose(): void { this.disposed = true; for (const set of this.listeners.values()) for (const entry of set) entry.active = false; this.listeners.clear(); }
}
