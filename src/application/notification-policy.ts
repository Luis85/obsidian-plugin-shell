import type { ErrorReporter, HostActions, NoticeHandle, TimerScheduler, Unsubscribe } from './ports';
export type NotificationKind = 'info' | 'success' | 'warning' | 'error' | 'progress';
export interface NotificationRequest {
  readonly owner: string; readonly operation: string; readonly kind: NotificationKind; readonly key: string;
  readonly native?: boolean; readonly duration?: number; readonly delay?: number; readonly actions?: readonly string[];
  readonly scope?: 'runtime' | 'view';
}
export interface RecoveryAction { readonly labelKey: string; available(): boolean | Promise<boolean>; run(): void | Promise<void> }
export interface NotificationFeedback {
  readonly id: number; readonly owner: string; readonly operation: string; readonly kind: NotificationKind; readonly key: string;
  readonly native: boolean; readonly visible: boolean; readonly actions: readonly { readonly id: string; readonly labelKey: string; readonly busy: boolean }[];
  readonly scope: 'runtime' | 'view';
}
export interface NotificationHandle { readonly id: number; update(request: Omit<NotificationRequest, 'owner' | 'operation'>): boolean; dismiss(): void }
export interface NotificationObservation { readonly id: number; readonly kind: NotificationKind; readonly phase: 'show' | 'update' | 'queue' | 'dismiss' | 'drop' | 'action' }
interface Entry { spec: NotificationRequest; feedback: NotificationFeedback; sink?: NoticeHandle; timer?: Unsubscribe; running: boolean }
const token = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,160}$/.test(value);
const essential = (spec: NotificationRequest) => ['error', 'warning'].includes(spec.kind) || !!spec.actions?.length || spec.duration === 0;
/** Runtime-owned timing/queue/action policy. No canonical mutation or retry is inferred. */
export class NotificationPolicy {
  private sequence = 0; private disposed = false; private overflow?: () => void; private capacityOverflow = false;
  private readonly entries = new Map<number, Entry>();
  private readonly queue: number[] = [];
  private readonly owners = new Map<string, Readonly<Record<string, RecoveryAction>>>();
  constructor(private readonly host: HostActions, private readonly text: (key: string) => string, private readonly errors: ErrorReporter,
    private readonly timers: TimerScheduler, private readonly changed: () => void,
    private readonly validKey: (key: string) => boolean = token,
    private readonly observe?: (value: NotificationObservation) => void) {}
  get current(): readonly NotificationFeedback[] { return [...this.entries.values()].map(entry => entry.feedback); }
  private observation(entry: Entry, phase: NotificationObservation['phase']) {
    try { this.observe?.({ id: entry.feedback.id, kind: entry.spec.kind, phase }); }
    catch { this.errors.report('notice.observer', 'notice.observe'); }
  }
  registerActions(owner: string, actions: Readonly<Record<string, RecoveryAction>>): Unsubscribe {
    if (this.disposed || !token(owner) || this.owners.has(owner) || Object.entries(actions).some(([id, action]) => !token(id) || !this.validKey(action.labelKey))) throw new Error('INVALID_NOTIFICATION_OWNER');
    const registry = Object.freeze({ ...actions }); this.owners.set(owner, registry);
    return () => { if (this.owners.get(owner) !== registry) return; this.owners.delete(owner); this.dismissOwner(owner); };
  }
  private valid(spec: NotificationRequest): boolean {
    return token(spec.owner) && token(spec.operation) && token(spec.key) && this.validKey(spec.key)
      && ['info', 'success', 'warning', 'error', 'progress'].includes(spec.kind)
      && (spec.native === undefined || typeof spec.native === 'boolean')
      && (spec.scope === undefined || spec.scope === 'runtime' || spec.scope === 'view')
      && (spec.duration === undefined || Number.isFinite(spec.duration) && spec.duration >= 0 && spec.duration <= 60000)
      && (spec.delay === undefined || Number.isFinite(spec.delay) && spec.delay >= 0 && spec.delay <= 60000)
      && (spec.actions === undefined || spec.actions.length <= 3 && new Set(spec.actions).size === spec.actions.length && spec.actions.every(id => token(id) && Object.hasOwn(this.owners.get(spec.owner) ?? {}, id)));
  }
  notify(spec: NotificationRequest): NotificationHandle | undefined {
    if (this.disposed) return undefined;
    if (!this.valid(spec)) { this.errors.report('notice.specification', 'notice.request'); return undefined; }
    const existing = [...this.entries.values()].find(entry => entry.spec.owner === spec.owner && entry.spec.operation === spec.operation);
    const id = existing?.feedback.id ?? ++this.sequence;
    if (!existing && this.entries.size >= 128) {
      const optional = essential(spec) ? [...this.entries.values()].find(entry => !this.essential(entry)) : undefined;
      if (optional) { this.entries.delete(optional.feedback.id); this.stop(optional); this.observation(optional, 'drop'); }
      else { this.errors.report('notice.capacity', 'notice.request'); if (essential(spec)) this.showOverflow(true); return undefined; }
    }
    if (existing) this.update(id, spec);
    else {
      const snapshot = Object.freeze({ ...spec, actions: Object.freeze([...(spec.actions ?? [])]) });
      const entry: Entry = { spec: snapshot, feedback: this.feedback(id, snapshot, false, false), running: false };
      this.entries.set(id, entry);
      const delay = spec.delay ?? (spec.kind === 'progress' ? 300 : 0);
      if (!delay || !this.schedule(entry, delay, () => { if (this.entries.has(id)) this.display(entry); })) this.display(entry);
    }
    return Object.freeze({ id, update: (request: Omit<NotificationRequest, 'owner' | 'operation'>) => this.update(id, request), dismiss: () => this.dismiss(id) });
  }
  private feedback(id: number, spec: NotificationRequest, native: boolean, visible: boolean, busy = false): NotificationFeedback {
    const registry = this.owners.get(spec.owner);
    return Object.freeze({ id, owner: spec.owner, operation: spec.operation, kind: spec.kind, key: spec.key, native, visible, scope: spec.scope ?? 'runtime',
      actions: Object.freeze((spec.actions ?? []).map(action => Object.freeze({ id: action, labelKey: registry?.[action]?.labelKey ?? action, busy }))) });
  }
  private persistent(entry: Entry): boolean { return ['error', 'warning', 'progress'].includes(entry.spec.kind) || !!entry.spec.actions?.length || entry.spec.duration === 0; }
  private essential(entry: Entry): boolean { return essential(entry.spec); }
  private active(): number { return [...this.entries.values()].filter(entry => entry.sink !== undefined && !this.essential(entry)).length; }
  private translated(key: string): string {
    try { return this.text(key); } catch { this.errors.report('notice.translation', 'notice.show'); return 'Notification unavailable.'; }
  }
  private sink(entry: Entry): NoticeHandle {
    const actions = () => entry.feedback.actions.map(action => ({ label: this.translated(action.labelKey), disabled: action.busy, invoke: () => { void this.invoke(entry.feedback.id, action.id); } }));
    const text = this.translated(entry.spec.key);
    if (this.host.notification) return this.host.notification(text, actions());
    let hide = this.host.notice(text, 0);
    return { update: next => { hide(); hide = this.host.notice(next, 0); }, dismiss: () => hide() };
  }
  private schedule(entry: Entry, milliseconds: number, callback: () => void): boolean {
    let active = true; let completed = false; let cancel: Unsubscribe | undefined;
    const stop = () => { active = false; cancel?.(); };
    entry.timer = stop;
    try {
      cancel = this.timers.after(milliseconds, () => {
        if (!active) return; active = false; completed = true;
        if (entry.timer === stop) entry.timer = undefined;
        callback();
      });
      return true;
    } catch {
      active = false; if (entry.timer === stop) entry.timer = undefined;
      this.errors.report('notice.timer', 'notice.schedule'); return completed;
    }
  }
  private cancelTimer(entry: Entry) {
    const cancel = entry.timer; entry.timer = undefined;
    try { cancel?.(); } catch { this.errors.report('notice.timer', 'notice.cancel'); }
  }
  private showOverflow(capacity = false) {
    this.capacityOverflow ||= capacity;
    if (this.overflow) return;
    try { this.overflow = this.host.notice(this.translated('notification.overflow'), 0); }
    catch { this.errors.report('notice.sink', 'notice.show'); }
  }
  private display(entry: Entry) {
    const id = entry.feedback.id;
    if (entry.spec.native && this.active() >= 3 && !this.essential(entry)) {
      if (this.queue.length >= 10) {
        this.observation(entry, 'drop'); this.entries.delete(id);
        this.showOverflow();
      } else { this.queue.push(id); this.observation(entry, 'queue'); }
      this.changed(); return;
    }
    const native = !!entry.spec.native && (this.essential(entry) || this.active() < 3) && (!entry.spec.actions?.length || !!this.host.notification);
    entry.feedback = this.feedback(id, entry.spec, native, true, entry.running);
    if (native) {
      try { entry.sink = this.sink(entry); }
      catch { this.errors.report('notice.sink', 'notice.show'); entry.feedback = this.feedback(id, entry.spec, false, true, entry.running); }
    }
    if (!this.persistent(entry)) this.schedule(entry, entry.spec.duration ?? 6000, () => this.dismiss(id));
    this.observation(entry, 'show'); this.changed();
  }
  private stop(entry: Entry) {
    this.cancelTimer(entry);
    try { entry.sink?.dismiss(); } catch { this.errors.report('notice.sink', 'notice.dismiss'); }
    entry.sink = undefined;
    const queued = this.queue.indexOf(entry.feedback.id); if (queued !== -1) this.queue.splice(queued, 1);
  }
  private drain() {
    while (!this.disposed && this.active() < 3 && this.queue.length) {
      const id = this.queue.shift(); const entry = id === undefined ? undefined : this.entries.get(id); if (entry) this.display(entry);
    }
    if (!this.queue.length && this.overflow && (!this.capacityOverflow || this.entries.size < 128)) {
      try { this.overflow(); } catch { this.errors.report('notice.sink', 'notice.dismiss'); } this.overflow = undefined; this.capacityOverflow = false;
    }
  }
  private update(id: number, patch: Omit<NotificationRequest, 'owner' | 'operation'>): boolean {
    const entry = this.entries.get(id); if (!entry || this.disposed) return false;
    const spec = { ...patch, owner: entry.spec.owner, operation: entry.spec.operation, scope: patch.scope ?? entry.spec.scope, native: patch.native ?? entry.spec.native };
    if (!this.valid(spec)) { this.errors.report('notice.specification', 'notice.request'); return false; }
    const hadSink = entry.sink; const wasVisible = entry.feedback.visible;
    this.cancelTimer(entry);
    const queued = this.queue.indexOf(id); if (queued !== -1) this.queue.splice(queued, 1);
    entry.spec = Object.freeze({ ...spec, actions: Object.freeze([...(spec.actions ?? [])]) });
    entry.feedback = this.feedback(id, entry.spec, !!hadSink, wasVisible, entry.running);
    if (hadSink && spec.native !== false && (this.essential(entry) || this.active() <= 3)) {
      this.refresh(entry);
      if (!this.persistent(entry)) this.schedule(entry, spec.duration ?? 6000, () => this.dismiss(id));
      this.changed();
    } else { this.stop(entry); this.display(entry); }
    this.observation(entry, 'update'); this.drain(); return true;
  }
  private refresh(entry: Entry) {
    try { entry.sink?.update(this.translated(entry.spec.key), entry.feedback.actions.map(action => ({ label: this.translated(action.labelKey), disabled: action.busy, invoke: () => { void this.invoke(entry.feedback.id, action.id); } }))); }
    catch { this.errors.report('notice.sink', 'notice.update'); this.stop(entry); entry.feedback = this.feedback(entry.feedback.id, entry.spec, false, true, entry.running); }
  }
  refreshLocale(): void { for (const entry of this.entries.values()) this.refresh(entry); this.changed(); }
  async invoke(id: number, actionId: string): Promise<boolean> {
    const entry = this.entries.get(id); const registry = entry && this.owners.get(entry.spec.owner); const action = registry?.[actionId];
    if (!entry || !action || !entry.spec.actions?.includes(actionId) || entry.running || this.disposed) return false;
    const request = entry.spec;
    entry.running = true; entry.feedback = this.feedback(id, entry.spec, entry.feedback.native, entry.feedback.visible, true); this.refresh(entry); this.changed();
    try {
      if (!await action.available() || this.entries.get(id) !== entry || entry.spec !== request || this.owners.get(entry.spec.owner) !== registry) return false;
      await action.run(); this.observation(entry, 'action'); return true;
    } catch { this.errors.report('notice.action', 'notice.action'); return false; }
    finally {
      entry.running = false;
      if (this.entries.get(id) === entry) { entry.feedback = this.feedback(id, entry.spec, entry.feedback.native, entry.feedback.visible); this.refresh(entry); this.changed(); }
    }
  }
  dismiss(id: number): void {
    const entry = this.entries.get(id); if (!entry) return;
    this.entries.delete(id); this.stop(entry); this.observation(entry, 'dismiss'); this.drain(); this.changed();
  }
  dismissOwner(owner: string): void {
    // A changed listener may create another request; dismiss only this snapshot.
    // oxlint-disable-next-line unicorn/no-useless-spread
    for (const entry of [...this.entries.values()]) if (entry.spec.owner === owner) this.dismiss(entry.feedback.id);
  }
  dispose(): void { if (this.disposed) return; this.disposed = true; for (const id of this.entries.keys()) this.dismiss(id); this.drain(); this.owners.clear(); }
}
