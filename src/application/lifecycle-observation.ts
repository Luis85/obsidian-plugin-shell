import type { ErrorReporter, LifecycleObservation, Unsubscribe } from './ports';

/** Safe receipts only: observers receive neither resource handles nor actions. */
export class LifecycleObservations {
  private sequence = 0;
  constructor(private readonly errors: ErrorReporter, private readonly observe?: (entry: LifecycleObservation) => unknown) {}
  acquire(resource: LifecycleObservation['resource'], owner: string, operation: string, count = 1): Unsubscribe {
    const id = ++this.sequence;
    const emit = (phase: LifecycleObservation['phase']) => {
      try {
        void Promise.resolve(this.observe?.(Object.freeze({ resource, phase, owner, operation, id, count })))
          .catch(() => this.errors.report('lifecycle.observer', 'lifecycle.observe'));
      }
      catch { this.errors.report('lifecycle.observer', 'lifecycle.observe'); }
    };
    emit('acquired');
    let released = false;
    return () => { if (!released) { released = true; emit('released'); } };
  }
}
