import type { ErrorReporter, HostActions, Unsubscribe } from './ports';
export interface Feedback { readonly id: number; readonly owner: string; readonly kind: 'info' | 'success' | 'error'; readonly key: string; readonly native: boolean }
export class NotificationService {
  private next = 0;
  private disposed = false;
  private items: Feedback[] = [];
  private readonly hides = new Map<number, () => void>();
  private readonly listeners = new Set<() => void>();
  constructor(private readonly host: HostActions, private readonly text: (key: string) => string, private readonly errors: ErrorReporter) {}
  get current(): readonly Feedback[] { return this.items.slice(); }
  show(owner: string, kind: Feedback['kind'], key: string, native = false): number {
    if (this.disposed) return -1;
    this.dismissOwner(owner);
    const entry = Object.freeze({ id: ++this.next, owner, kind, key, native });
    this.items = [...this.items, entry];
    while (this.items.length > 5) { const first = this.items[0]; if (first) this.dismiss(first.id); }
    if (native) {
      try { this.hides.set(entry.id, this.host.notice(this.text(key), 4000)); }
      catch {
        this.errors.report('notice.sink', 'notice.show');
        // A failed host sink must still leave owned, localized inline feedback.
        this.items = this.items.map(item => item.id === entry.id ? Object.freeze({ ...item, native: false }) : item);
      }
    }
    this.changed(); return entry.id;
  }
  dismiss(id: number): void {
    try { this.hides.get(id)?.(); } catch { this.errors.report('notice.sink', 'notice.dismiss'); }
    this.hides.delete(id); this.items = this.items.filter(item => item.id !== id); this.changed();
  }
  dismissOwner(owner: string): void { for (const item of this.items.filter(item => item.owner === owner)) this.dismiss(item.id); }
  subscribe(listener: () => void): Unsubscribe { if (this.disposed) return () => undefined; this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private changed(): void {
    const snapshot = Array.from(this.listeners);
    for (const listener of snapshot) {
      if (!this.listeners.has(listener)) continue;
      try { listener(); } catch { this.errors.report('notice.listener', 'notice.notify'); }
    }
  }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.listeners.clear(); for (const item of this.items) this.dismiss(item.id); }
}
