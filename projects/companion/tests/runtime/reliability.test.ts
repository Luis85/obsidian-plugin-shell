import { describe, expect, it, vi } from 'vitest';
import { TypedEventBus } from '../../src/infrastructure/events/typed-event-bus';
import { Diagnostics } from '../../src/infrastructure/diagnostics';
import { NotificationService } from '../../src/application/notification-service';
import { PreferenceService } from '../../src/application/preference-service';
import { fixture, host } from './helpers';
describe('Iteration 02 failure isolation', () => {
  it('[REL-02-05] rejected feedback listeners are observed and do not undo success', async () => {
    const f = fixture(); const notifications = new NotificationService(host(), key => key, f.errors);
    notifications.subscribe(async () => { throw new Error('private'); });
    notifications.show('owner', 'success', 'feedback.saved'); await Promise.resolve();
    expect(notifications.current[0]?.kind).toBe('success');
    expect(f.errors.report).toHaveBeenCalledExactlyOnceWith('notice.listener', 'notice.notify');
    notifications.dispose();
  });
  it('[REL-02-01] uncloneable event data is contained and the next event still dispatches', () => {
    const errors = { report: vi.fn() }; const bus = new TypedEventBus<{ unsafe: { callback?: () => void } }>(errors);
    const subscriber = vi.fn(); bus.on('unsafe', subscriber);
    expect(() => bus.publish({ type: 'unsafe', payload: { callback() {} } })).not.toThrow();
    expect(subscriber).not.toHaveBeenCalled(); expect(errors.report).toHaveBeenCalledExactlyOnceWith('event.payload', 'event.dispatch');
    bus.publish({ type: 'unsafe', payload: {} }); expect(subscriber).toHaveBeenCalledTimes(1);
  });
  it('[REL-02-02] rejected settings subscribers are observed without relabeling persistence', async () => {
    const f = fixture(); const service = new PreferenceService({ load: async () => null, save: async () => undefined }, f.bus, f.errors);
    service.subscribe(async () => { throw new Error('private path must not leak'); });
    expect((await service.update({ taskFolder: 'Tasks/New' })).ok).toBe(true);
    await Promise.resolve(); expect(f.errors.report).toHaveBeenCalledExactlyOnceWith('settings.listener', 'settings.notify');
  });
  it('[REL-02-03] failed native feedback has one localized inline fallback, not false mutation failure', () => {
    const f = fixture(); const h = host(); vi.mocked(h.notice).mockImplementation(() => { throw new Error('sink'); });
    const notifications = new NotificationService(h, key => `translated:${key}`, f.errors);
    notifications.show('operation', 'success', 'feedback.saved', true);
    expect(notifications.current).toEqual([{ id: 1, owner: 'operation', kind: 'success', key: 'feedback.saved', native: false }]);
    expect(h.notice).toHaveBeenCalledExactlyOnceWith('translated:feedback.saved', 4000);
  });
  it('[REL-02-04] diagnostic subscriber errors reach independent observation without recursion or revival', async () => {
    const observe = vi.fn(); const log = new Diagnostics(observe);
    log.subscribe(() => { throw new Error('sync'); }); log.subscribe(async () => { throw new Error('async'); });
    log.report('application.failure', 'test.operation'); await Promise.resolve();
    expect(observe.mock.calls.map(call => call[0].code)).toEqual(['application.failure', 'diagnostic.listener', 'diagnostic.listener']);
    log.dispose(); log.report('late.failure', 'test.operation'); const listener = vi.fn(); log.subscribe(listener);
    expect(log.current).toEqual([]); expect(observe).toHaveBeenCalledTimes(3); expect(listener).not.toHaveBeenCalled();
  });
});
