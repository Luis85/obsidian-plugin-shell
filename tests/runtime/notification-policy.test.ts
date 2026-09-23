import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NotificationPolicy, type NotificationRequest } from '../../src/application/notification-policy';
import { NotificationService } from '../../src/application/notification-service';
import type { NoticeAction, TimerScheduler } from '../../src/application/ports';
import { deferred, host } from './helpers';
const timers: TimerScheduler = { after(ms, callback) { const timer = setTimeout(callback, ms); return () => clearTimeout(timer); } };
beforeEach(() => vi.useFakeTimers());
afterEach(() => { expect(vi.getTimerCount()).toBe(0); vi.useRealTimers(); });
function fixture() {
  const sinks: { text: string; actions: readonly NoticeAction[]; update: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> }[] = [];
  const h = host(); h.notification = vi.fn((text, actions) => {
    const sink = { text, actions, update: vi.fn((next: string, choices: readonly NoticeAction[]) => { sink.text = next; sink.actions = choices; }), dismiss: vi.fn() }; sinks.push(sink); return sink;
  });
  const errors = { report: vi.fn() }; const changed = vi.fn(); const observe = vi.fn();
  const text = vi.fn((key: string) => `localized:${key}`);
  const policy = new NotificationPolicy(h, text, errors, timers, changed, key => key !== 'unknown', observe);
  const request = (operation: string, patch: Partial<NotificationRequest> = {}) => policy.notify({ owner: 'runtime', operation, kind: 'info', key: 'message', native: true, ...patch });
  return { h, sinks, errors, changed, observe, text, policy, request };
}
it('[NTF-03-01] owns six-second expiry and cancels delayed progress before it can flash', () => {
  const f = fixture();
  try {
    const pending = f.request('work', { kind: 'progress', scope: 'view' }); expect(f.sinks).toHaveLength(0); expect(f.policy.current[0]?.visible).toBe(false);
    vi.advanceTimersByTime(299); expect(f.sinks).toHaveLength(0);
    expect(pending?.update({ kind: 'success', key: 'saved' })).toBe(true); expect(f.sinks).toHaveLength(1); expect(f.policy.current[0]?.scope).toBe('view');
    expect(f.sinks[0]?.text).toBe('localized:saved'); vi.advanceTimersByTime(5999); expect(f.policy.current).toHaveLength(1);
    vi.advanceTimersByTime(1); expect(f.policy.current).toEqual([]); expect(f.sinks[0]?.dismiss).toHaveBeenCalledOnce();
    pending?.dismiss(); expect(pending?.update({ kind: 'error', key: 'late' })).toBe(false);
    f.request('slow', { kind: 'progress' }); vi.advanceTimersByTime(300); expect(f.sinks).toHaveLength(2);
    vi.advanceTimersByTime(100000); expect(f.policy.current).toHaveLength(1); expect(f.errors.report).not.toHaveBeenCalled();
  } finally { f.policy.dispose(); }
});
it('[NTF-03-02] deduplicates operations with one updateable sink and retains persistent errors independently', () => {
  const f = fixture();
  try {
    const first = f.request('save'); const same = f.request('save', { kind: 'success', key: 'saved' });
    expect(first?.id).toBe(same?.id); expect(f.sinks).toHaveLength(1); expect(f.sinks[0]?.update).toHaveBeenCalledOnce();
    f.request('save-again'); f.request('failure', { kind: 'error', duration: 1 });
    vi.advanceTimersByTime(6000); expect(f.policy.current.map(item => item.operation)).toEqual(['failure']);
    expect(f.observe.mock.calls.map(([entry]) => entry.phase)).toContain('update');
    f.text.mockImplementation(key => `de:${key}`); f.policy.refreshLocale(); expect(f.sinks[2]?.text).toBe('de:message');
  } finally { f.policy.dispose(); }
});
it('[NTF-03-03] bounds transient native delivery, drains FIFO and keeps one overflow summary', () => {
  const f = fixture();
  try {
    for (let i = 0; i < 16; i++) f.request(`operation-${i}`);
    expect(f.sinks).toHaveLength(3); expect(f.policy.current).toHaveLength(13);
    expect(f.h.notice).toHaveBeenCalledExactlyOnceWith('localized:notification.overflow', 0);
    expect(f.observe.mock.calls.filter(([entry]) => entry.phase === 'drop')).toHaveLength(3);
    f.policy.dismiss(f.policy.current[0]?.id ?? -1); expect(f.sinks).toHaveLength(4);
    expect(f.policy.current.find(item => item.operation === 'operation-3')?.visible).toBe(true);
    vi.advanceTimersByTime(6000 * 5); expect(f.policy.current).toEqual([]); expect(f.errors.report).not.toHaveBeenCalled();
  } finally { f.policy.dispose(); }
});
it('[NTF-03-04] background errors and approved actions stay reachable when every transient slot is occupied', async () => {
  const f = fixture(); const run = vi.fn(async () => undefined);
  try {
    f.policy.registerActions('background', { open: { labelKey: 'open', available: () => true, run } });
    for (let i = 0; i < 3; i++) f.request(`transient-${i}`);
    const failure = f.policy.notify({ owner: 'background', operation: 'committed-open-failed', kind: 'error', key: 'openFailed', native: true, actions: ['open'] });
    expect(f.sinks).toHaveLength(4); expect(f.policy.current.at(-1)).toMatchObject({ native: true, visible: true, scope: 'runtime' });
    expect(f.sinks[3]?.actions[0]?.label).toBe('localized:open'); f.sinks[3]?.actions[0]?.invoke(); await Promise.resolve(); await Promise.resolve();
    expect(run).toHaveBeenCalledOnce(); vi.advanceTimersByTime(6000); expect(f.policy.current.map(item => item.id)).toEqual([failure?.id]);
    expect(f.errors.report).not.toHaveBeenCalled();
  } finally { f.policy.dispose(); }
});
it('[NTF-03-05] recovery is single-flight, revalidates context and never revives a disposed owner', async () => {
  const f = fixture(); const available = deferred<boolean>(); const run = vi.fn(async () => undefined);
  try {
    const off = f.policy.registerActions('owner', { open: { labelKey: 'open', available: () => available.promise, run } });
    const note = f.policy.notify({ owner: 'owner', operation: 'saved', kind: 'error', key: 'openFailed', native: true, actions: ['open'] });
    if (!note) throw new Error('MISSING_NOTIFICATION');
    const first = f.policy.invoke(note.id, 'open'); expect(await f.policy.invoke(note.id, 'open')).toBe(false);
    expect(f.sinks[0]?.actions[0]?.disabled).toBe(true); off(); off(); available.resolve(true);
    expect(await first).toBe(false); expect(run).not.toHaveBeenCalled(); expect(await f.policy.invoke(note.id, 'open')).toBe(false);
    expect(f.policy.current).toEqual([]);
  } finally { f.policy.dispose(); }
});
it('[NTF-03-06] stale/throwing recovery preserves the original failure and independent action diagnostics', async () => {
  const f = fixture(); const available = deferred<boolean>(); const run = vi.fn(async () => { throw new Error('open failure'); });
  try {
    const off = f.policy.registerActions('runtime', { open: { labelKey: 'open', available: () => available.promise, run } });
    const handle = f.request('open', { kind: 'error', actions: ['open'] }); if (!handle) throw new Error('MISSING_NOTIFICATION');
    const stale = f.policy.invoke(handle.id, 'open'); handle.update({ kind: 'error', key: 'changed', actions: ['open'], native: true }); available.resolve(true);
    expect(await stale).toBe(false); expect(run).not.toHaveBeenCalled();
    expect(await f.policy.invoke(handle.id, 'open')).toBe(false); expect(run).toHaveBeenCalledOnce();
    expect(f.policy.current[0]?.kind).toBe('error'); expect(f.errors.report).toHaveBeenCalledExactlyOnceWith('notice.action', 'notice.action'); off();
  } finally { f.policy.dispose(); }
});
it('[NTF-03-07] invalid requests/registrations fail explicitly and bounded recovery capacity does not silently drop', () => {
  const f = fixture();
  try {
    for (const patch of [{ key: 'unknown' }, { owner: '../private' }, { operation: '' }, { duration: NaN }, { duration: -1 }, { delay: 60001 }, { actions: ['missing'] }]) expect(f.request('invalid', patch)).toBeUndefined();
    expect(() => f.policy.registerActions('', {})).toThrow('INVALID_NOTIFICATION_OWNER');
    expect(() => f.policy.registerActions('bad', { open: { labelKey: 'unknown', available: () => true, run() {} } })).toThrow();
    f.policy.registerActions('unique', {}); expect(() => f.policy.registerActions('unique', {})).toThrow();
    for (let i = 0; i < 128; i++) expect(f.request(`persistent-${i}`, { native: false, kind: 'error' })).toBeDefined();
    expect(f.request('overflow', { kind: 'error' })).toBeUndefined(); expect(f.errors.report).toHaveBeenCalledWith('notice.capacity', 'notice.request');
    const existing = f.request('persistent-0', { native: false, kind: 'error' }); expect(existing).toBeDefined();
    expect(existing?.update({ kind: 'info', key: 'unknown' })).toBe(false);
  } finally { f.policy.dispose(); }
  expect(f.request('disposed')).toBeUndefined(); expect(() => f.policy.registerActions('later', {})).toThrow(); f.policy.dispose();
});
it('[NTF-03-08] sink/update/hide and observer failures remain observable without hiding recovery state', () => {
  const f = fixture();
  try {
    vi.mocked(f.h.notification!).mockImplementationOnce(() => { throw new Error('sink'); });
    const note = f.request('failure', { kind: 'error' }); expect(f.policy.current[0]).toMatchObject({ native: false, visible: true, scope: 'runtime' });
    expect(f.errors.report).toHaveBeenCalledWith('notice.sink', 'notice.show'); note?.dismiss();
    const updating = f.request('update', { kind: 'error' }); f.sinks[0]?.update.mockImplementationOnce(() => { throw new Error('update'); });
    updating?.update({ kind: 'error', key: 'changed', native: true }); expect(f.policy.current[0]?.native).toBe(false);
    expect(f.errors.report).toHaveBeenCalledWith('notice.sink', 'notice.update'); updating?.dismiss();
    const hide = f.request('hide', { kind: 'error' }); f.sinks[1]?.dismiss.mockImplementationOnce(() => { throw new Error('hide'); });
    f.observe.mockImplementationOnce(() => { throw new Error('observer'); }); hide?.dismiss();
    expect(f.errors.report).toHaveBeenCalledWith('notice.sink', 'notice.dismiss'); expect(f.errors.report).toHaveBeenCalledWith('notice.observer', 'notice.observe');
    f.text.mockImplementationOnce(() => { throw new Error('translate'); }); f.request('translation', { kind: 'error' }); expect(f.sinks.at(-1)?.text).toBe('Notification unavailable.');
    expect(f.errors.report).toHaveBeenCalledWith('notice.translation', 'notice.show');
  } finally { f.policy.dispose(); }
});
it('[NTF-03-09] legacy sinks get persistent handles with one owner timer and actions remain in accessible inline state', async () => {
  const h = host(); const errors = { report: vi.fn() }; const service = new NotificationService(h, key => key, errors, { scheduler: timers });
  try {
    const notice = service.notify({ owner: 'owner', operation: 'one', kind: 'info', key: 'message', native: true });
    expect(h.notice).toHaveBeenCalledWith('message', 0); notice?.update({ kind: 'success', key: 'done', native: true }); expect(h.notice).toHaveBeenCalledTimes(2);
    const run = vi.fn(); const off = service.registerActions('owner', { open: { labelKey: 'open', available: () => false, run } });
    const action = service.notify({ owner: 'owner', operation: 'two', kind: 'error', key: 'failed', native: true, actions: ['open'] });
    expect(service.current.at(-1)).toMatchObject({ native: false, visible: true }); expect(await service.invoke(action?.id ?? -1, 'open')).toBe(false); expect(run).not.toHaveBeenCalled();
    service.refreshLocale(); service.dismissOwner('owner'); expect(service.current).toEqual([]); off();
  } finally { service.dispose(); }
  const legacy = new NotificationService(h, key => key, errors);
  expect(() => legacy.notify({ owner: 'owner', operation: 'one', kind: 'info', key: 'message' })).toThrow('NOTIFICATION_SCHEDULER_REQUIRED');
  expect(() => legacy.registerActions('owner', {})).toThrow(); expect(await legacy.invoke(1, 'missing')).toBe(false); legacy.refreshLocale(); legacy.dispose();
});
