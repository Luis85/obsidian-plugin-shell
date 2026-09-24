import type { Diagnostic, LifecycleObservation, Unsubscribe } from '../application/ports';

type RuntimeObservation =
  | { readonly kind: 'error'; readonly sequence: number; readonly entry: Diagnostic }
  | { readonly kind: 'lifecycle'; readonly sequence: number; readonly entry: LifecycleObservation };

/** Live safe-metadata observation. Consumers own their ledger and can detect missed delivery. */
export function createRuntimeObservation() {
  const listeners = new Set<(event: RuntimeObservation) => unknown>();
  let sequence = 0;
  let errors = 0;
  let resources = 0;
  let observerFailures = 0;
  let disposed = false;
  const publish = (event: RuntimeObservation) => {
    for (const listener of Array.from(listeners)) {
      if (!listeners.has(listener)) continue;
      try {
        void Promise.resolve(listener(event)).catch(() => { observerFailures++; });
      } catch { observerFailures++; }
    }
  };
  const observation = Object.freeze({
    subscribe(listener: (event: RuntimeObservation) => unknown): Unsubscribe {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    snapshot: () => Object.freeze({ sequence, errors, resources, observerFailures }),
  });
  return {
    observation,
    error(entry: Diagnostic) {
      errors++;
      publish(Object.freeze({ kind: 'error', sequence: ++sequence, entry: Object.freeze({ ...entry }) }));
    },
    lifecycle(entry: LifecycleObservation) {
      resources++;
      publish(Object.freeze({ kind: 'lifecycle', sequence: ++sequence, entry: Object.freeze({ ...entry }) }));
    },
    dispose() { disposed = true; listeners.clear(); },
  };
}
