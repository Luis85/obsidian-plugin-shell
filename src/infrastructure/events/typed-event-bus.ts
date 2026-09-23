import type { EventInput, EventObserver, EventPort, EventPublisher, EventSubscriber } from '../../application/events';
import { composeEvents, type EventDefinition, type EventMapOf } from '../../application/event-definition';
import type { ErrorReporter, Unsubscribe } from '../../application/ports';
interface Subscription {
  active: boolean;
  invoke: (payload: unknown) => void | Promise<void>;
}
function freeze(value: unknown): void {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
}
/** Synchronous notification order; rejected async listeners are observed, not awaited. */
export class TypedEventBus<M> implements EventPort<M> {
  private readonly listeners = new Map<keyof M | string, Set<Subscription>>();
  private readonly definitions: ReadonlyMap<string, EventDefinition>;
  private disposed = false;
  private depth = 0;
  constructor(
    private readonly errors: ErrorReporter,
    definitions: readonly EventDefinition[] = [],
  ) {
    this.definitions = new Map(composeEvents(definitions).map((definition) => [definition.id, definition]));
  }
  observer(): EventObserver<M> & { readonly size: number } {
    const size = () => this.size;
    return Object.freeze({
      on: this.on.bind(this),
      once: this.once.bind(this),
      get size() {
        return size();
      },
    });
  }
  private registered(definition: EventDefinition): void {
    if (this.definitions.get(definition.id) !== definition) throw new Error('EVENT_UNREGISTERED_REFERENCE');
  }
  observe<N extends string, P>(
    definition: EventDefinition<N, P>,
    listener: (payload: NoInfer<P>) => void | Promise<void>,
  ): Unsubscribe {
    this.registered(definition);
    return this.subscribe(definition.id, (payload) => {
      if (definition.valid(payload)) return listener(payload);
    });
  }
  subscriber<N extends string, P>(definition: EventDefinition<N, P>): EventSubscriber<P> {
    this.registered(definition);
    return Object.freeze({
      on: (listener: (payload: P) => void | Promise<void>) => this.observe(definition, listener),
      once: (listener: (payload: P) => void | Promise<void>) => {
        const off = this.observe(definition, (payload) => {
          off();
          return listener(payload);
        });
        return off;
      },
    });
  }
  publisher<D extends EventDefinition>(definition: D): EventPublisher<EventMapOf<D>> {
    this.registered(definition);
    return Object.freeze({
      publish: (event: EventInput<EventMapOf<D>>) => {
        if (event.type !== definition.id) {
          this.errors.report('event.payload', 'event.dispatch');
          return;
        }
        this.dispatch(definition.id, event.payload);
      },
    });
  }
  on<K extends keyof M>(type: K, listener: (payload: M[K]) => void | Promise<void>): Unsubscribe {
    // Registration keeps this erased wrapper in the same typed key's set.
    return this.subscribe(type, (value) => listener(value as M[K]));
  }
  private subscribe(type: keyof M | string, invoke: Subscription['invoke']): Unsubscribe {
    if (this.disposed) throw new Error('BUS_DISPOSED');
    const set = this.listeners.get(type) ?? new Set<Subscription>();
    const entry: Subscription = { active: true, invoke };
    set.add(entry);
    this.listeners.set(type, set);
    return () => {
      entry.active = false;
      set.delete(entry);
      if (!set.size) this.listeners.delete(type);
    };
  }
  once<K extends keyof M>(type: K, listener: (payload: M[K]) => void | Promise<void>): Unsubscribe {
    const off = this.on(type, (payload) => {
      off();
      return listener(payload);
    });
    return off;
  }
  publish(event: EventInput<M>): void {
    this.dispatch(event.type, event.payload);
  }
  private deliver(entry: Subscription, payload: unknown): void {
    try {
      const result = entry.invoke(payload);
      if (result) Promise.resolve(result).catch(() => this.errors.report('event.listener', 'event.dispatch'));
    } catch { this.errors.report('event.listener', 'event.dispatch'); }
  }
  private dispatch(type: keyof M | string, input: unknown): void {
    if (this.disposed) return;
    if (this.depth >= 32) {
      this.errors.report('event.recursion', 'event.dispatch');
      return;
    }
    let payload: unknown;
    try {
      payload = structuredClone(input);
      if (this.definitions.size && (typeof type !== 'string' || !this.definitions.get(type)?.valid(payload))) {
        this.errors.report('event.payload', 'event.dispatch');
        return;
      }
      freeze(payload);
    } catch {
      this.errors.report('event.payload', 'event.dispatch');
      return;
    }
    this.depth++;
    try {
      // Snapshot is required: a listener added during dispatch starts with the next event.
      // oxlint-disable-next-line unicorn/no-useless-spread
      for (const entry of [...(this.listeners.get(type) ?? [])]) {
        if (!entry.active) continue;
        this.deliver(entry, payload);
      }
    } finally {
      this.depth--;
    }
  }
  get size(): number {
    return [...this.listeners.values()].reduce((sum, entries) => sum + entries.size, 0);
  }
  dispose(): void {
    this.disposed = true;
    for (const set of this.listeners.values()) for (const entry of set) entry.active = false;
    this.listeners.clear();
  }
}
