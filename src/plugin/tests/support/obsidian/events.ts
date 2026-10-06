/** Obsidian-compatible synchronous event emitter plus the kit's pending-work tracker. */
export type EventCallback = (...data: never[]) => unknown;
export interface KitEventRef { readonly e: Events; readonly name: string; readonly fn: EventCallback; readonly ctx?: unknown }

export class Events {
  private readonly handlers = new Map<string, KitEventRef[]>();
  on(name: string, callback: EventCallback, ctx?: unknown): KitEventRef {
    const ref: KitEventRef = { e: this, name, fn: callback, ctx };
    this.handlers.set(name, [...(this.handlers.get(name) ?? []), ref]);
    return ref;
  }
  off(name: string, callback: EventCallback): void {
    this.handlers.set(name, (this.handlers.get(name) ?? []).filter(ref => ref.fn !== callback));
  }
  offref(ref: object): void {
    for (const [name, refs] of this.handlers) this.handlers.set(name, refs.filter(item => item !== ref));
  }
  /** Handlers run synchronously in registration order, like the host. A throwing handler does not stop later ones. */
  trigger(name: string, ...data: unknown[]): void {
    for (const ref of this.handlers.get(name) ?? []) this.tryTrigger(ref, data);
  }
  tryTrigger(ref: object, args: unknown[]): void {
    if (!isRef(ref)) return;
    try { Reflect.apply(ref.fn, ref.ctx, args); }
    catch (error) { hostErrors.push(error); }
  }
  /** Kit-only: number of live handlers for one event name. */
  listenerCount(name: string): number { return this.handlers.get(name)?.length ?? 0; }
}
function isRef(value: object): value is KitEventRef {
  return 'fn' in value && typeof value.fn === 'function' && 'e' in value && value.e instanceof Events;
}

/**
 * Errors the host would only log to its console: throwing event handlers and rejected
 * tracked promises (async command callbacks, `onOpen`, setting listeners). Assert it is empty.
 */
export const hostErrors: unknown[] = [];
const pending = new Set<Promise<unknown>>();
/** Kit-internal: register async host work (metadata parsing, view closing, returned callback promises). */
export function track<T>(work: Promise<T>): Promise<T> {
  const settled = work.then(() => undefined, (error: unknown) => { hostErrors.push(error); });
  pending.add(settled);
  void settled.then(() => pending.delete(settled));
  return work;
}
/**
 * Settle kit-owned asynchronous host work (metadata-cache parsing, view close, tracked
 * callbacks) plus a bounded number of microtask turns. It never advances timers, so it
 * works with fake timers; use `vi.advanceTimersByTime` for debounced/timed host work.
 */
export async function flushObsidian(turns = 10): Promise<void> {
  for (let round = 0; round < 100; round++) {
    for (let i = 0; i < turns; i++) await Promise.resolve();
    if (!pending.size) return;
    await Promise.all([...pending]);
  }
  throw new Error('OBSIDIAN_TEST_KIT_WORK_DID_NOT_SETTLE');
}
