import { expect, it, vi } from 'vitest';
import { NoticeService } from '../../src/application/notice-service';
import type { Diagnostic } from '../../src/application/ports';
import { Diagnostics } from '../../src/infrastructure/diagnostics';
import { deferred, host } from './helpers';

it('[FAULT-OBS-01] independent caught-action evidence survives production diagnostic truncation without losing occurrences', async () => {
  const ledger: Diagnostic[] = [];
  // Void callbacks remain compatible with ordinary sinks returning Array.push's count.
  const diagnostics = new Diagnostics(entry => ledger.push(entry));
  const timers = { after: vi.fn(() => vi.fn()) };
  const notices = new NoticeService(host(), key => key, diagnostics, { scheduler: timers });
  const run = vi.fn(() => { throw new Error('Private title and path must never enter evidence'); });
  const unregister = notices.registerActions('owner', { recover: { labelKey: 'recover', available: () => true, run } });
  const handle = notices.error({ owner: 'owner', operation: 'committed-open', key: 'open.failed', actions: ['recover'], native: false });
  if (!handle) throw new Error('MISSING_RECOVERY');
  try {
    for (let count = 0; count < 205; count++) expect(await notices.invoke(handle.id, 'recover')).toBe(false);
    expect(run).toHaveBeenCalledTimes(205);
    expect(ledger).toEqual(Array.from({ length: 205 }, (_, index) => ({ sequence: index + 1, code: 'notice.action', operation: 'notice.action' })));
    expect(ledger.every(Object.isFrozen)).toBe(true);
    expect(diagnostics.current).toEqual(ledger.slice(5));
    expect(notices.current).toMatchObject([{ kind: 'error', operation: 'committed-open', actions: [{ id: 'recover', busy: false }] }]);
    expect(timers.after).not.toHaveBeenCalled();
  } finally { unregister(); notices.dispose(); diagnostics.dispose(); }
  expect(ledger).toHaveLength(205);
  expect(diagnostics.current).toEqual([]);
});

it('[FAULT-OBS-02] independent faults distinguish late availability rejection from a stale successful availability result', async () => {
  const ledger: Diagnostic[] = [];
  const diagnostics = new Diagnostics(entry => { ledger.push(entry); });
  const notices = new NoticeService(host(), key => key, diagnostics, { scheduler: { after: vi.fn(() => vi.fn()) } });
  const successful = deferred<boolean>(); const rejected = deferred<boolean>();
  const run = vi.fn();
  const first = notices.registerActions('first', { recover: { labelKey: 'recover', available: () => successful.promise, run } });
  const second = notices.registerActions('second', { recover: { labelKey: 'recover', available: () => rejected.promise, run } });
  const request = (owner: string) => notices.error({ owner, operation: 'open', key: 'open.failed', actions: ['recover'], native: false });
  const firstHandle = request('first'); const secondHandle = request('second');
  if (!firstHandle || !secondHandle) throw new Error('MISSING_RECOVERY');
  const firstPending = notices.invoke(firstHandle.id, 'recover');
  const secondPending = notices.invoke(secondHandle.id, 'recover');
  first(); second();
  successful.resolve(true); rejected.reject(new Error('Controlled late availability rejection'));
  expect(await firstPending).toBe(false); expect(await secondPending).toBe(false);
  expect(run).not.toHaveBeenCalled(); expect(notices.current).toEqual([]);
  expect(ledger).toEqual([{ sequence: 1, code: 'notice.action', operation: 'notice.action' }]);
  expect(firstHandle.update({ kind: 'success', key: 'late' })).toBe(false);
  expect(secondHandle.update({ kind: 'success', key: 'late' })).toBe(false);
  notices.dispose(); diagnostics.dispose();
});
