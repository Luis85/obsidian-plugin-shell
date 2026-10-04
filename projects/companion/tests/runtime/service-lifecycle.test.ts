import { afterEach, expect, it, vi } from 'vitest';
import { createServices } from '../../src/bootstrap/services';
import { PreferenceService } from '../../src/application/preference-service';
import { PluginDataStore } from '../../src/application/plugin-data-store';
import { DocumentCreationService } from '../../src/application/document-service';
import { memoryStorage } from './memory-storage';
import { host } from './helpers';

const probe = vi.hoisted(() => ({ failRegistration: false }));
vi.mock('../../src/bootstrap/features', async importOriginal => {
  const original = await importOriginal<typeof import('../../src/bootstrap/features')>();
  return { ...original, createFeatures: (...args: Parameters<typeof original.createFeatures>) => {
    if (probe.failRegistration) throw new Error('invalid feature registration');
    return original.createFeatures(...args);
  } };
});
afterEach(() => { probe.failRegistration = false; vi.restoreAllMocks(); });
function adapters() {
  const native = { ...host(), dispose: vi.fn() }; const observe = vi.fn();
  return { native, observe, ports: { documents: memoryStorage().storage, host: native,
    settings: { load: async () => null, save: async () => undefined }, local: { get: () => null, set() {} },
    newId: () => 'lifecycle', now: () => '2026-09-23T00:00:00.000Z', observeError: observe,
    scheduler: { after: () => () => undefined },
  } };
}
it('failed feature registration releases every already acquired runtime capability', async () => {
  const f = adapters(); probe.failRegistration = true;
  const preferences = vi.spyOn(PreferenceService.prototype, 'dispose');
  const data = vi.spyOn(PluginDataStore.prototype, 'dispose');
  const documents = vi.spyOn(DocumentCreationService.prototype, 'dispose');
  await expect(createServices(f.ports)).rejects.toThrow('invalid feature registration');
  expect(preferences).toHaveBeenCalledOnce(); expect(data).toHaveBeenCalledOnce(); expect(documents).toHaveBeenCalledOnce();
  expect(f.native.dispose).toHaveBeenCalledOnce(); expect(f.observe).not.toHaveBeenCalled();
});
it('one failed cleanup cannot skip remaining resources and repeated disposal is a no-op', async () => {
  const f = adapters(); const services = await createServices(f.ports);
  services.events.on('preferences.changed', () => undefined);
  const preferences = vi.spyOn(services.preferences, 'dispose');
  vi.spyOn(services.modals, 'dispose').mockImplementationOnce(() => { throw new Error('cleanup fault'); });
  services.dispose(); services.dispose();
  expect(preferences).toHaveBeenCalledOnce(); expect(services.events.size).toBe(0);
  expect(f.native.dispose).toHaveBeenCalledOnce();
  expect(f.observe.mock.calls.map(([entry]) => entry.code)).toEqual(['runtime.cleanup']);
});
