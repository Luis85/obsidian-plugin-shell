import { expect, it, vi } from 'vitest';
import { NotificationPolicy } from '../../src/application/notification-policy';
import { host } from './helpers';
import type { TimerScheduler } from '../../src/application/ports';
function fixture(timers: TimerScheduler) {
  const native = host(); const errors = { report: vi.fn() }; const observe = vi.fn();
  const policy = new NotificationPolicy(native, key => key, errors, timers, vi.fn(), undefined, observe);
  return { policy, native, errors, observe };
}
it('[NTF-SAFE-01] scheduling failures retain visible progress/success and never escape a committed operation', () => {
  const scheduled: (() => void)[] = [];
  const f = fixture({ after(_ms, callback) { scheduled.push(callback); throw new Error('timer creation failed'); } });
  try {
    expect(() => f.policy.notify({ owner: 'owner', operation: 'work', kind: 'progress', key: 'progress', native: true })).not.toThrow();
    expect(f.policy.current[0]).toMatchObject({ visible: true, kind: 'progress' }); expect(f.native.notice).toHaveBeenCalledOnce();
    const saved = f.policy.notify({ owner: 'owner', operation: 'saved', kind: 'success', key: 'saved', native: true });
    expect(saved).toBeDefined(); expect(f.policy.current[1]).toMatchObject({ visible: true, kind: 'success' });
    expect(saved?.update({ kind: 'success', key: 'updated' })).toBe(true);
    const snapshot = f.policy.current; for (const callback of scheduled) callback(); expect(f.policy.current).toEqual(snapshot);
    expect(f.errors.report.mock.calls).toEqual(Array.from({ length: 3 }, () => ['notice.timer', 'notice.schedule']));
  } finally { f.policy.dispose(); }
});
it('[NTF-SAFE-02] failed cancellation invalidates old callbacks and disposal still clears all entries and native handles', () => {
  const scheduled: (() => void)[] = []; const cancel = vi.fn(() => { throw new Error('timer cancellation failed'); });
  const f = fixture({ after(_ms, callback) { scheduled.push(callback); return cancel; } });
  const first = f.policy.notify({ owner: 'owner', operation: 'one', kind: 'info', key: 'one', native: true });
  f.policy.notify({ owner: 'owner', operation: 'two', kind: 'progress', key: 'two' });
  expect(first?.update({ kind: 'success', key: 'updated', native: true })).toBe(true);
  scheduled[0]?.(); expect(f.policy.current).toHaveLength(2);
  expect(() => f.policy.dispose()).not.toThrow(); f.policy.dispose();
  expect(f.policy.current).toEqual([]); expect(cancel).toHaveBeenCalledTimes(3);
  for (const callback of scheduled) callback(); expect(f.policy.current).toEqual([]);
  expect(f.errors.report.mock.calls).toEqual(Array.from({ length: 3 }, () => ['notice.timer', 'notice.cancel']));
  for (const result of vi.mocked(f.native.notice).mock.results) if (result.type === 'return') expect(result.value).toHaveBeenCalledOnce();
});
it('[NTF-SAFE-03] essential recovery evicts optional delayed progress at capacity and remains visible', () => {
  vi.useFakeTimers(); const f = fixture({ after(ms, callback) { const id = setTimeout(callback, ms); return () => clearTimeout(id); } });
  try {
    for (let i = 0; i < 128; i++) f.policy.notify({ owner: 'owner', operation: `pending-${i}`, kind: 'progress', key: 'progress', native: true });
    expect(f.native.notice).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(128);
    const recovery = f.policy.notify({ owner: 'runtime', operation: 'failed-write', kind: 'error', key: 'failed', native: true });
    expect(recovery).toBeDefined(); expect(f.policy.current).toHaveLength(128);
    expect(f.policy.current.at(-1)).toMatchObject({ id: recovery?.id, visible: true, native: true, kind: 'error' });
    expect(f.native.notice).toHaveBeenCalledExactlyOnceWith('failed', 0); expect(vi.getTimerCount()).toBe(127);
    expect(f.observe.mock.calls.filter(([entry]) => entry.phase === 'drop')).toHaveLength(1); expect(f.errors.report).not.toHaveBeenCalled();
  } finally { f.policy.dispose(); expect(vi.getTimerCount()).toBe(0); vi.useRealTimers(); }
});
it('[NTF-SAFE-04] all-essential capacity retains existing recovery and shows one bounded overflow summary', () => {
  const f = fixture({ after: () => () => undefined });
  try {
    for (let i = 0; i < 128; i++) f.policy.notify({ owner: 'owner', operation: `error-${i}`, kind: 'error', key: 'failed' });
    for (let i = 0; i < 3; i++) expect(f.policy.notify({ owner: 'owner', operation: `overflow-${i}`, kind: 'error', key: 'failed' })).toBeUndefined();
    expect(f.policy.current).toHaveLength(128); expect(f.native.notice).toHaveBeenCalledExactlyOnceWith('notification.overflow', 0);
    expect(f.errors.report).toHaveBeenCalledTimes(3); f.policy.dismiss(f.policy.current[0]?.id ?? -1);
    const returned = vi.mocked(f.native.notice).mock.results[0]; if (returned?.type === 'return') expect(returned.value).toHaveBeenCalledOnce();
  } finally { f.policy.dispose(); }
});
