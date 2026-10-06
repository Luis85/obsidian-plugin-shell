import { expect, it, vi } from 'vitest';
import { ModalService } from '../../src/application/modal-service';
import type { ModalHandle, ModalSink } from '../../src/application/modal-port';
import { NoticeService } from '../../src/application/notice-service';
import type { Diagnostic, LifecycleObservation, NoticeHandle, TimerScheduler } from '../../src/application/ports';
import { Diagnostics } from '../../src/infrastructure/diagnostics';
import { deferred, host } from './helpers';

function ledger() {
  const observations: LifecycleObservation[] = []; const faults: Diagnostic[] = [];
  const live = new Map<string, LifecycleObservation>();
  const diagnostics = new Diagnostics(entry => { faults.push(entry); });
  const observe = (entry: LifecycleObservation) => {
    observations.push(entry);
    const key = `${entry.resource}:${entry.id}`;
    if (entry.phase === 'acquired') { expect(live.has(key)).toBe(false); live.set(key, entry); }
    else { expect(live.has(key)).toBe(true); live.delete(key); }
  };
  const count = (owner: string, resource: LifecycleObservation['resource']) => [...live.values()]
    .filter(entry => entry.owner === owner && entry.resource === resource).reduce((total, entry) => total + entry.count, 0);
  return { observations, faults, live, diagnostics, observe, count };
}
function sinks() {
  const notices: NoticeHandle[] = []; const dialogs: ModalHandle[] = [];
  const h = host();
  h.notification = vi.fn(() => { const handle = { update: vi.fn(), dismiss: vi.fn() }; notices.push(handle); return handle; });
  const modals: ModalSink = { open: vi.fn(() => { const handle = { update: vi.fn(), close: vi.fn() }; dialogs.push(handle); return handle; }) };
  return { h, notices, dialogs, modals };
}
const resourceKinds = ['notice', 'timer', 'modal', 'action', 'availability'] as const;

it('[LIFECYCLE-OBS-01] counts actual owned sinks, delayed timer and pending availability independently through owner close and settlement', async () => {
  const f = ledger(); const native = sinks(); const callbacks: (() => void)[] = []; const cancels: ReturnType<typeof vi.fn>[] = [];
  const scheduler: TimerScheduler = { after(_delay, callback) { callbacks.push(callback); const cancel = vi.fn(); cancels.push(cancel); return cancel; } };
  const notices = new NoticeService(native.h, key => key, f.diagnostics, { scheduler, observeLifecycle: f.observe });
  const modals = new ModalService(native.modals, key => key, f.diagnostics, undefined, f.observe);
  const available = deferred<boolean>(); const run = vi.fn();
  const unregister = notices.registerActions('first', { recover: { labelKey: 'recover', available: () => available.promise, run } });
  const first = notices.error({ owner: 'first', operation: 'saved', key: 'open.failed', actions: ['recover'] });
  notices.error({ owner: 'sibling', operation: 'independent', key: 'sibling' });
  const progress = notices.progress({ owner: 'first', operation: 'pending', key: 'waiting' });
  const modal = modals.confirm({ owner: 'first', titleKey: 'confirm', message: 'Private body never enters observations' });
  if (!first || !progress) throw new Error('MISSING_HANDLES');
  const pending = notices.invoke(first.id, 'recover');
  expect(resourceKinds.map(resource => f.count('first', resource))).toEqual([1, 1, 1, 1, 1]);
  expect(native.notices).toHaveLength(2); expect(native.dialogs).toHaveLength(1);
  unregister(); modals.closeOwner('first');
  expect(await modal).toEqual({ status: 'cancelled' });
  expect(resourceKinds.map(resource => f.count('first', resource))).toEqual([0, 0, 0, 0, 1]);
  expect(f.count('sibling', 'notice')).toBe(1);
  expect(native.notices[0]?.dismiss).toHaveBeenCalledOnce(); expect(native.notices[1]?.dismiss).not.toHaveBeenCalled();
  expect(native.dialogs[0]?.close).toHaveBeenCalledOnce(); expect(cancels[0]).toHaveBeenCalledOnce();
  const closed = f.observations.slice();
  callbacks[0]?.(); expect(f.observations).toEqual(closed);
  available.resolve(true); expect(await pending).toBe(false); expect(run).not.toHaveBeenCalled();
  expect(f.count('first', 'availability')).toBe(0);
  expect(progress.update({ kind: 'success', key: 'late' })).toBe(false);
  expect(await notices.invoke(first.id, 'recover')).toBe(false);
  notices.dispose(); modals.dispose();
  expect(f.live.size).toBe(0); expect(f.faults).toEqual([]);
  expect(f.observations.every(Object.isFrozen)).toBe(true);
  expect(JSON.stringify(f.observations)).not.toContain('Private body');
  expect(f.observations.every(entry => Object.values(entry).every(value => typeof value !== 'function'))).toBe(true);
});

it('[LIFECYCLE-OBS-02] failed handle cleanup stays outstanding and exact independent faults survive disposal', async () => {
  const f = ledger(); const native = sinks(); const callbacks: (() => void)[] = [];
  const scheduler: TimerScheduler = { after(_delay, callback) { callbacks.push(callback); return () => { throw new Error('Controlled cancellation failure'); }; } };
  const notices = new NoticeService(native.h, key => key, f.diagnostics, { scheduler, observeLifecycle: f.observe });
  const modals = new ModalService(native.modals, key => key, f.diagnostics, undefined, f.observe);
  notices.info({ owner: 'first', operation: 'timed', key: 'notice' });
  const modal = modals.info({ owner: 'first', titleKey: 'modal', message: 'body' });
  vi.mocked(native.notices[0]!.dismiss).mockImplementation(() => { throw new Error('Controlled dismiss failure'); });
  vi.mocked(native.dialogs[0]!.close).mockImplementation(() => { throw new Error('Controlled modal close failure'); });
  notices.dispose(); modals.dispose(); expect(await modal).toEqual({ status: 'cancelled' });
  expect(f.count('first', 'timer')).toBe(1); expect(f.count('first', 'notice')).toBe(1); expect(f.count('first', 'modal')).toBe(1);
  expect(f.faults.map(({ code, operation }) => ({ code, operation }))).toEqual([
    { code: 'notice.timer', operation: 'notice.cancel' }, { code: 'notice.sink', operation: 'notice.dismiss' }, { code: 'modal.close', operation: 'modal.close' },
  ]);
  callbacks[0]?.(); expect(f.count('first', 'timer')).toBe(0);
  expect(native.notices).toHaveLength(1); expect(f.live.size).toBe(2);
});

it('[LIFECYCLE-OBS-03] normal firing and synchronous scheduling balance handles and observer failure cannot alter service outcomes', () => {
  const f = ledger(); const native = sinks();
  const notices = new NoticeService(native.h, key => key, f.diagnostics, {
    scheduler: { after(_delay, callback) { callback(); return vi.fn(); } }, observeLifecycle: f.observe,
  });
  notices.info({ owner: 'first', operation: 'instant', key: 'notice' });
  expect(f.live.size).toBe(0); expect(native.notices[0]?.dismiss).toHaveBeenCalledOnce(); expect(f.faults).toEqual([]);
  notices.dispose();
  const throwing = new NoticeService(native.h, key => key, f.diagnostics, {
    scheduler: { after: vi.fn(() => vi.fn()) }, observeLifecycle: () => { throw new Error('Controlled observer failure'); },
  });
  const handle = throwing.error({ owner: 'owner', operation: 'persistent', key: 'notice' });
  expect(handle).toBeDefined(); handle?.dismiss(); handle?.dismiss(); throwing.dispose();
  expect(f.faults.map(({ code }) => code)).toEqual(['lifecycle.observer', 'lifecycle.observer']);
});

it('[LIFECYCLE-OBS-04] legacy notice replacement, overflow summary and runtime action disposal balance independently', () => {
  const f = ledger(); const native = host();
  const notices = new NoticeService(native, key => key, f.diagnostics, { scheduler: { after: () => vi.fn() }, observeLifecycle: f.observe });
  notices.registerActions('owner', { recover: { labelKey: 'recover', available: () => true, run: vi.fn() } });
  const first = notices.info({ owner: 'owner', operation: 'one', key: 'first' });
  first?.update({ kind: 'info', key: 'changed' }); expect(f.count('owner', 'notice')).toBe(1);
  for (let index = 0; index < 14; index++) notices.info({ owner: 'owner', operation: `next-${index}`, key: 'queued' });
  expect(f.count('runtime:overflow', 'notice')).toBe(1);
  notices.dispose(); expect(f.live.size).toBe(0); expect(f.faults).toEqual([]);
  for (const result of vi.mocked(native.notice).mock.results) if (result.type === 'return') expect(result.value).toHaveBeenCalledOnce();
});

it('[LIFECYCLE-OBS-05] rejected asynchronous observer delivery is independently caught without changing owned cleanup', async () => {
  const f = ledger(); const native = sinks();
  const pending = deferred();
  const notices = new NoticeService(native.h, key => key, f.diagnostics, {
    scheduler: { after: () => vi.fn() }, observeLifecycle: () => pending.promise,
  });
  const handle = notices.error({ owner: 'owner', operation: 'persistent', key: 'notice' });
  handle?.dismiss(); expect(native.notices[0]?.dismiss).toHaveBeenCalledOnce();
  pending.reject(new Error('Controlled asynchronous observer rejection')); await Promise.resolve(); await Promise.resolve();
  expect(f.faults.map(({ code, operation }) => ({ code, operation }))).toEqual(Array.from({ length: 2 }, () => ({ code: 'lifecycle.observer', operation: 'lifecycle.observe' })));
  notices.dispose();
});

it('[LIFECYCLE-OBS-06] legacy notification observers catch asynchronous rejection independently of lifecycle delivery', async () => {
  const f = ledger(); const native = sinks(); const pending = deferred();
  const notices = new NoticeService(native.h, key => key, f.diagnostics, {
    scheduler: { after: () => vi.fn() }, observe: () => pending.promise, observeLifecycle: f.observe,
  });
  const handle = notices.error({ owner: 'owner', operation: 'persistent', key: 'notice' }); handle?.dismiss();
  pending.reject(new Error('Controlled legacy observer rejection')); await Promise.resolve(); await Promise.resolve();
  expect(f.live.size).toBe(0);
  expect(f.faults.map(({ code, operation }) => ({ code, operation }))).toEqual(Array.from({ length: 2 }, () => ({ code: 'notice.observer', operation: 'notice.observe' })));
  notices.dispose();
});
