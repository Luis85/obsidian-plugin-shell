import { expect, it, vi } from 'vitest';
import { NoticeService } from '../../src/application/notice-service';
import type { LifecycleObservation } from '../../src/application/ports';
import { host } from './helpers';

for (const resource of ['notice', 'timer', 'action'] as const) {
  it(`[LIFECYCLE-REENTRY-${resource}] observer-triggered disposal releases the actual resource and its receipt`, () => {
    const native = host(); const dismiss = vi.fn(); native.notification = vi.fn(() => ({ update: vi.fn(), dismiss }));
    const cancel = vi.fn(); const events: LifecycleObservation[] = []; const errors = { report: vi.fn() };
    const notices = new NoticeService(native, key => key, errors, {
      scheduler: { after: () => cancel },
      observeLifecycle: event => { events.push(event); if (event.phase === 'acquired' && event.resource === resource) notices.dispose(); },
    });
    if (resource === 'action') notices.registerActions('owner', { recover: { labelKey: 'recover', available: () => true, run: vi.fn() } });
    else notices.info({ owner: 'owner', operation: 'work', key: 'notice' });
    expect(notices.current).toEqual([]);
    expect(events.filter(event => event.resource === resource).map(event => event.phase)).toEqual(['acquired', 'released']);
    if (resource === 'notice' || resource === 'timer') expect(dismiss).toHaveBeenCalledOnce();
    if (resource === 'timer') expect(cancel).toHaveBeenCalledOnce();
    expect(errors.report).not.toHaveBeenCalled(); notices.dispose();
  });
}

it('[LIFECYCLE-REENTRY-replace] reentrant replacement keeps its successor sink and releases only the superseded handle', () => {
  const native = host(); const dismissals: ReturnType<typeof vi.fn>[] = []; const events: LifecycleObservation[] = [];
  native.notification = vi.fn(() => { const dismiss = vi.fn(); dismissals.push(dismiss); return { update: vi.fn(), dismiss }; });
  let replaced = false;
  const notices = new NoticeService(native, key => key, { report: vi.fn() }, {
    scheduler: { after: () => vi.fn() },
    observeLifecycle: event => {
      events.push(event);
      if (!replaced && event.resource === 'notice' && event.phase === 'acquired') {
        replaced = true; notices.error({ owner: 'owner', operation: 'work', key: 'successor' });
      }
    },
  });
  notices.error({ owner: 'owner', operation: 'work', key: 'original' });
  expect(notices.current).toMatchObject([{ key: 'successor' }]);
  expect(dismissals).toHaveLength(2); expect(dismissals[0]).toHaveBeenCalledOnce(); expect(dismissals[1]).not.toHaveBeenCalled();
  notices.dispose(); expect(dismissals[1]).toHaveBeenCalledOnce();
  expect(events.filter(event => event.phase === 'acquired')).toHaveLength(2);
  expect(events.filter(event => event.phase === 'released')).toHaveLength(2);
});

it('[LIFECYCLE-REENTRY-cleanup] failed cleanup after reentrant close stays outstanding with its exact dismiss fault', () => {
  const native = host(); const events: LifecycleObservation[] = []; const errors = { report: vi.fn() };
  const dismiss = vi.fn(() => { throw new Error('Controlled reentrant cleanup failure'); });
  native.notification = vi.fn(() => ({ update: vi.fn(), dismiss }));
  const notices = new NoticeService(native, key => key, errors, {
    scheduler: { after: () => vi.fn() },
    observeLifecycle: event => { events.push(event); if (event.phase === 'acquired') notices.dispose(); },
  });
  notices.error({ owner: 'owner', operation: 'work', key: 'original' });
  expect(notices.current).toEqual([]); expect(dismiss).toHaveBeenCalledOnce();
  expect(events.map(event => event.phase)).toEqual(['acquired']);
  expect(errors.report).toHaveBeenCalledExactlyOnceWith('notice.sink', 'notice.dismiss');
});

it('[LIFECYCLE-REENTRY-overflow] disposal during overflow acquisition releases its actual native summary', () => {
  const native = host(); const events: LifecycleObservation[] = []; const errors = { report: vi.fn() };
  const notices = new NoticeService(native, key => key, errors, {
    scheduler: { after: () => vi.fn() },
    observeLifecycle: event => { events.push(event); if (event.phase === 'acquired' && event.owner === 'runtime:overflow') notices.dispose(); },
  });
  for (let index = 0; index < 14; index++) notices.info({ owner: 'owner', operation: `work-${index}`, key: 'notice' });
  expect(notices.current).toEqual([]);
  expect(events.filter(event => event.owner === 'runtime:overflow').map(event => event.phase)).toEqual(['acquired', 'released']);
  for (const result of vi.mocked(native.notice).mock.results) if (result.type === 'return') expect(result.value).toHaveBeenCalledOnce();
  expect(errors.report).not.toHaveBeenCalled();
});

it('[LIFECYCLE-REENTRY-legacy] disposal while a legacy update acquires its successor dismisses both handles once', () => {
  const native = host(); const events: LifecycleObservation[] = []; const errors = { report: vi.fn() }; let acquired = 0;
  const schedule = vi.fn(() => vi.fn());
  const notices = new NoticeService(native, key => key, errors, {
    scheduler: { after: schedule },
    observeLifecycle: event => {
      events.push(event);
      if (event.resource === 'notice' && event.phase === 'acquired' && ++acquired === 2) notices.dispose();
    },
  });
  const handle = notices.info({ owner: 'owner', operation: 'work', key: 'original' });
  handle?.update({ kind: 'info', key: 'successor' });
  expect(notices.current).toEqual([]);
  expect(events.filter(event => event.resource === 'notice').map(event => event.phase)).toEqual(['acquired', 'released', 'acquired', 'released']);
  expect(schedule).toHaveBeenCalledOnce();
  for (const result of vi.mocked(native.notice).mock.results) if (result.type === 'return') expect(result.value).toHaveBeenCalledOnce();
  expect(errors.report).not.toHaveBeenCalled();
});

it.each(['notice', 'timer'] as const)('[LIFECYCLE-REENTRY-release] disposal during old %s release acquires no successor notice or timer', resource => {
  const native = host(); const errors = { report: vi.fn() }; const schedule = vi.fn(() => vi.fn()); let closed = false;
  const notices = new NoticeService(native, key => key, errors, {
    scheduler: { after: schedule },
    observeLifecycle: event => {
      if (!closed && event.resource === resource && event.phase === 'released') { closed = true; notices.dispose(); }
    },
  });
  const handle = notices.info({ owner: 'owner', operation: 'work', key: 'original' });
  handle?.update({ kind: 'info', key: 'successor' });
  expect(notices.current).toEqual([]); expect(native.notice).toHaveBeenCalledOnce(); expect(schedule).toHaveBeenCalledOnce();
  expect(errors.report).not.toHaveBeenCalled();
});

it.each(['notice', 'timer'] as const)('[LIFECYCLE-REENTRY-update] replacement during old %s release preserves the newer request and its actual handle', resource => {
  const native = host(); const errors = { report: vi.fn() }; const schedule = vi.fn(() => vi.fn()); let replaced = false;
  const notices = new NoticeService(native, key => key, errors, {
    scheduler: { after: schedule },
    observeLifecycle: event => {
      if (!replaced && event.resource === resource && event.phase === 'released') {
        replaced = true; notices.info({ owner: 'owner', operation: 'work', key: 'newer' });
      }
    },
  });
  const handle = notices.info({ owner: 'owner', operation: 'work', key: 'original' });
  expect(handle?.update({ kind: 'info', key: 'superseded' })).toBe(false);
  expect(notices.current).toMatchObject([{ key: 'newer' }]);
  expect(native.notice).toHaveBeenCalledTimes(2); expect(schedule).toHaveBeenCalledTimes(2);
  const successor = vi.mocked(native.notice).mock.results[1];
  if (successor?.type !== 'return') throw new Error('MISSING_SUCCESSOR');
  expect(successor.value).not.toHaveBeenCalled(); notices.dispose(); expect(successor.value).toHaveBeenCalledOnce();
  expect(errors.report).not.toHaveBeenCalled();
});

it('[LIFECYCLE-REENTRY-registry] releasing an old registry cannot erase a reentrantly registered successor', async () => {
  const native = host(); const events: LifecycleObservation[] = []; const errors = { report: vi.fn() }; const run = vi.fn();
  let replaced = false;
  const notices = new NoticeService(native, key => key, errors, {
    scheduler: { after: () => vi.fn() },
    observeLifecycle: event => {
      events.push(event);
      if (!replaced && event.resource === 'action' && event.phase === 'released') {
        replaced = true;
        notices.registerActions('owner', { recover: { labelKey: 'recover', available: () => true, run } });
        notices.error({ owner: 'owner', operation: 'successor', key: 'ready', actions: ['recover'] });
      }
    },
  });
  const stop = notices.registerActions('owner', { recover: { labelKey: 'recover', available: () => true, run: vi.fn() } });
  stop(); expect(notices.current).toHaveLength(1);
  const successor = notices.current[0]; if (!successor) throw new Error('MISSING_SUCCESSOR');
  expect(await notices.invoke(successor.id, 'recover')).toBe(true); expect(run).toHaveBeenCalledOnce();
  stop(); expect(notices.current).toHaveLength(1); notices.dispose();
  expect(events.filter(event => event.resource === 'action').map(event => event.phase)).toEqual(['acquired', 'released', 'acquired', 'released']);
  expect(errors.report).not.toHaveBeenCalled();
});

it('[LIFECYCLE-REENTRY-availability] reentrant owner disposal before availability starts does not acquire the stale action', async () => {
  const native = host(); const events: LifecycleObservation[] = []; const available = vi.fn(() => true); const run = vi.fn();
  const notices = new NoticeService(native, key => key, { report: vi.fn() }, {
    scheduler: { after: () => vi.fn() },
    observeLifecycle: event => { events.push(event); if (event.resource === 'availability' && event.phase === 'acquired') notices.dispose(); },
  });
  notices.registerActions('owner', { recover: { labelKey: 'recover', available, run } });
  const handle = notices.error({ owner: 'owner', operation: 'work', key: 'ready', actions: ['recover'] });
  if (!handle) throw new Error('MISSING_RECOVERY');
  expect(await notices.invoke(handle.id, 'recover')).toBe(false);
  expect(available).not.toHaveBeenCalled(); expect(run).not.toHaveBeenCalled();
  expect(events.filter(event => event.resource === 'availability').map(event => event.phase)).toEqual(['acquired', 'released']);
});

it('[LIFECYCLE-REENTRY-surface] changing delivery cannot erase a native successor installed during old handle release', () => {
  const native = host(); const dismissals: ReturnType<typeof vi.fn>[] = []; let replaced = false;
  native.notification = vi.fn(() => { const dismiss = vi.fn(); dismissals.push(dismiss); return { update: vi.fn(), dismiss }; });
  const notices = new NoticeService(native, key => key, { report: vi.fn() }, {
    scheduler: { after: () => vi.fn() },
    observeLifecycle: event => {
      if (!replaced && event.resource === 'notice' && event.phase === 'released') {
        replaced = true; notices.error({ owner: 'owner', operation: 'work', key: 'newer' });
      }
    },
  });
  const handle = notices.error({ owner: 'owner', operation: 'work', key: 'original' });
  expect(handle?.update({ kind: 'error', key: 'inline', native: false })).toBe(false);
  expect(notices.current).toMatchObject([{ key: 'newer', native: true }]); expect(dismissals).toHaveLength(2);
  expect(dismissals[0]).toHaveBeenCalledOnce(); expect(dismissals[1]).not.toHaveBeenCalled();
  notices.dispose(); expect(dismissals[1]).toHaveBeenCalledOnce();
});

it.each(['acquired', 'released'] as const)('[LIFECYCLE-REENTRY-summary] preserves a successor summary created during old overflow %s', phase => {
  const native = host(); const events: LifecycleObservation[] = []; const errors = { report: vi.fn() }; let replaced = false;
  const notices = new NoticeService(native, key => key, errors, {
    scheduler: { after: () => vi.fn() },
    observeLifecycle: event => {
      events.push(event);
      if (!replaced && event.owner === 'runtime:overflow' && event.phase === phase) {
        replaced = true;
        for (let index = 0; index < 14; index++) notices.info({ owner: 'successor', operation: `next-${index}`, key: 'next' });
      }
    },
  });
  for (let index = 0; index < 14; index++) notices.info({ owner: 'first', operation: `work-${index}`, key: 'notice' });
  if (phase === 'released') notices.dismissOwner('first');
  expect(replaced).toBe(true); notices.dispose();
  const summaries = events.filter(event => event.owner === 'runtime:overflow');
  expect(summaries.filter(event => event.phase === 'acquired')).toHaveLength(2);
  expect(summaries.filter(event => event.phase === 'released')).toHaveLength(2);
  for (const result of vi.mocked(native.notice).mock.results) if (result.type === 'return') expect(result.value).toHaveBeenCalledOnce();
  expect(errors.report).not.toHaveBeenCalled();
});
