import { expect, it, vi } from 'vitest';
import { PreferenceService } from '../../src/application/preference-service';
import { NotificationService } from '../../src/application/notification-service';
import { Diagnostics } from '../../src/infrastructure/diagnostics';
import { defaults } from '../../src/domain/preferences';
import { deferred, fixture, host } from './helpers';
it('[OWN-03-01] late settings loads and disposed subscriptions cannot revive owned state', async () => {
  const f = fixture(); const barrier = deferred<unknown>();
  const service = new PreferenceService({ load: () => barrier.promise, save: vi.fn() }, f.bus, f.errors);
  const load = service.load(); service.dispose(); barrier.resolve({ schemaVersion: 1, preferences: { ...defaults, locale: 'de' } }); await load;
  expect(service.current).toEqual(defaults); const listener = vi.fn(); service.subscribe(listener)();
  expect((await service.update({ locale: 'de' })).ok).toBe(false); expect(listener).not.toHaveBeenCalled();
});
it('[OWN-03-02] settings subscriber removal and synchronous failure cannot undo the persisted preference', async () => {
  const f = fixture(); const save = vi.fn(async () => undefined);
  const service = new PreferenceService({ load: async () => null, save }, f.bus, f.errors);
  let stop: () => void = () => undefined; const removed = vi.fn();
  service.subscribe(() => { stop(); throw new Error('listener'); }); stop = service.subscribe(removed);
  expect((await service.update({ locale: 'de' })).ok).toBe(true); expect(service.current.locale).toBe('de');
  expect(save).toHaveBeenCalledOnce(); expect(removed).not.toHaveBeenCalled();
  expect(f.errors.report).toHaveBeenCalledExactlyOnceWith('settings.listener', 'settings.notify'); service.dispose();
});
it('[OWN-03-03] notification dismiss and synchronous listeners report independent faults and skip removed subscribers', () => {
  const f = fixture(); const h = host(); vi.mocked(h.notice).mockReturnValue(() => { throw new Error('hide failed'); });
  const service = new NotificationService(h, key => key, f.errors); let stop: () => void = () => undefined; const removed = vi.fn();
  service.subscribe(() => { stop(); throw new Error('listener'); }); stop = service.subscribe(removed);
  const id = service.show('owner', 'info', 'key', true); service.dismiss(id);
  expect(service.current).toEqual([]); expect(removed).not.toHaveBeenCalled();
  expect(f.errors.report.mock.calls).toEqual([['notice.listener', 'notice.notify'], ['notice.sink', 'notice.dismiss'], ['notice.listener', 'notice.notify']]);
  service.dispose(); service.subscribe(removed)();
});
it('[OWN-03-04] diagnostics contain broken observers, removed listeners and late rejection after disposal', async () => {
  const observer = vi.fn(() => { throw new Error('independent observer'); }); const log = new Diagnostics(observer);
  let stop: () => void = () => undefined; const removed = vi.fn(); const barrier = deferred();
  log.subscribe(() => { stop(); return barrier.promise; }); stop = log.subscribe(removed);
  log.report('fixture.error', 'fixture.operation'); expect(observer).toHaveBeenCalledOnce(); expect(removed).not.toHaveBeenCalled();
  log.dispose(); barrier.reject(new Error('late listener')); await Promise.resolve(); await Promise.resolve();
  expect(log.current).toEqual([]); expect(observer).toHaveBeenCalledOnce(); log.subscribe(removed)(); log.report('late', 'late');
});
