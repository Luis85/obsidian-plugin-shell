import type { ErrorReporter, HostActions, TimerScheduler, Unsubscribe } from './ports';
import { NotificationPolicy, type NotificationRequest, type NotificationKind, type NotificationObservation, type RecoveryAction } from './notification-policy';
export interface Feedback { readonly id: number; readonly owner: string; readonly kind: NotificationKind; readonly key: string; readonly native: boolean; readonly visible?: boolean; readonly scope?: 'runtime' | 'view'; readonly actions?: readonly { readonly id: string; readonly labelKey: string; readonly busy: boolean }[] }
export class NotificationService {
  private next = 0;
  private disposed = false;
  private items: Feedback[] = [];
  private readonly hides = new Map<number, () => void>();
  private readonly listeners = new Set<() => void | Promise<void>>();
  private readonly policy?: NotificationPolicy;
  constructor(private readonly host: HostActions, private readonly text: (key: string) => string, private readonly errors: ErrorReporter,
    options?: { scheduler: TimerScheduler; validKey?: (key: string) => boolean; observe?: (value: NotificationObservation) => void }) {
    if (options) this.policy = new NotificationPolicy(host, text, errors, options.scheduler, () => this.changed(), options.validKey, options.observe);
  }
  get current(): readonly Feedback[] { return this.policy?.current ?? this.items.slice(); }
  notify(request: NotificationRequest) { if (!this.policy) throw new Error('NOTIFICATION_SCHEDULER_REQUIRED'); return this.policy.notify(request); }
  registerActions(owner: string, actions: Readonly<Record<string, RecoveryAction>>): Unsubscribe { if (!this.policy) throw new Error('NOTIFICATION_SCHEDULER_REQUIRED'); return this.policy.registerActions(owner, actions); }
  invoke(id: number, action: string): Promise<boolean> { return this.policy?.invoke(id, action) ?? Promise.resolve(false); }
  refreshLocale(): void { this.policy?.refreshLocale(); }
  show(owner: string, kind: Feedback['kind'], key: string, native = false, scope: 'runtime' | 'view' = 'view'): number {
    if (this.disposed) return -1;
    if (this.policy) return this.policy.notify({ owner, operation: 'feedback', kind, key, native, scope })?.id ?? -1;
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
    if (this.policy) { this.policy.dismiss(id); return; }
    try { this.hides.get(id)?.(); } catch { this.errors.report('notice.sink', 'notice.dismiss'); }
    this.hides.delete(id); this.items = this.items.filter(item => item.id !== id); this.changed();
  }
  dismissOwner(owner: string): void { if (this.policy) this.policy.dismissOwner(owner); else for (const item of this.items.filter(item => item.owner === owner)) this.dismiss(item.id); }
  subscribe(listener: () => void | Promise<void>): Unsubscribe { if (this.disposed) return () => undefined; this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private changed(): void {
    const snapshot = Array.from(this.listeners);
    for (const listener of snapshot) {
      if (!this.listeners.has(listener)) continue;
      try {
        const result = listener();
        if (result) Promise.resolve(result).catch(() => this.errors.report('notice.listener', 'notice.notify'));
      } catch { this.errors.report('notice.listener', 'notice.notify'); }
    }
  }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.listeners.clear(); this.policy?.dispose(); for (const item of this.items) this.dismiss(item.id); }
}
