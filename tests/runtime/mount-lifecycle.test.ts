// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from 'vitest';
import { createServices } from '../../src/bootstrap/services';
import { mountShowcase } from '../../src/bootstrap/mount-ui';
import { host } from './helpers';
import { memoryStorage } from './memory-storage';
const probe = vi.hoisted(() => ({ mounted: 0, active: 0 }));
vi.mock('../../src/presentation/components/ShowcaseApp.vue', async () => {
  const { defineComponent, h, Teleport, onMounted, onScopeDispose } = await import('vue');
  const { useServices } = await import('../../src/presentation/context/use-services');
  return { default: defineComponent({ props: { portalRoot: { type: HTMLElement, required: true } }, setup(props) {
    const services = useServices(); probe.active++;
    const stop = services.events.on('showcase.ping', () => undefined);
    onMounted(() => { probe.mounted++; }); onScopeDispose(() => { probe.active--; stop(); });
    return () => h('section', [h(Teleport, { to: props.portalRoot }, h('button', { 'data-owned-portal': '' }, 'Owned portal'))]);
  } }) };
});
let warnings: string[]; let warn: MockInstance;
beforeEach(() => { probe.mounted = 0; probe.active = 0; warnings = []; warn = vi.spyOn(console, 'warn').mockImplementation(message => { warnings.push(String(message)); }); });
afterEach(() => { warn.mockRestore(); vi.restoreAllMocks(); document.body.replaceChildren(); expect(warnings).toEqual([]); });
async function fixture() {
  const errors = vi.fn(); let id = 0;
  const services = await createServices({ documents: memoryStorage().storage, host: host(), settings: { load: async () => null, save: async () => undefined },
    local: { get: () => null, set() {} }, newId: () => `mount-${++id}`, now: () => '2026-09-22T12:00:00.000Z', observeError: errors });
  const root = document.createElement('div'); root.className = 'user-owned dark'; document.body.append(root);
  return { root, services, errors };
}
it('[MOUNT-01] initial teleports stay in the staging surface and failed host attachment releases mounted Vue scopes', async () => {
  const f = await fixture(); const runtimeDispose = vi.spyOn(f.services.i18n, 'dispose');
  const insert = vi.spyOn(f.root, 'insertBefore').mockImplementation(surface => {
    expect(probe.mounted).toBe(1); expect(probe.active).toBe(1); expect(f.services.events.size).toBe(1);
    expect(surface instanceof HTMLElement && surface.querySelector('[data-owned-portal]')).toBeTruthy();
    expect(f.root.children).toHaveLength(0); throw new Error('host attachment failed');
  });
  try {
    expect(() => mountShowcase(f.root, f.services)).toThrow('host attachment failed');
    expect(probe.active).toBe(0); expect(f.services.events.size).toBe(0); expect(f.root.children).toHaveLength(0);
    expect(runtimeDispose).not.toHaveBeenCalled(); expect(f.root.classList.contains('dark')).toBe(true); expect(f.errors).not.toHaveBeenCalled();
  } finally { insert.mockRestore(); f.services.dispose(); }
});
it('[MOUNT-02] initialization failure releases previously acquired theme resources without attempting Vue unmount', async () => {
  const f = await fixture(); const unsubscribeOwner = vi.fn();
  const subscribe = vi.spyOn(f.services.preferences, 'subscribe').mockImplementationOnce(() => { throw new Error('preference subscription failed'); });
  try {
    expect(() => mountShowcase(f.root, f.services, undefined, () => unsubscribeOwner)).toThrow('preference subscription failed');
    expect(unsubscribeOwner).toHaveBeenCalledOnce(); expect(f.root.classList.contains('dark')).toBe(true); expect(f.root.classList.contains('light')).toBe(false);
    expect(f.root.children).toHaveLength(0); expect(f.services.events.size).toBe(0); expect(probe.active).toBe(0); expect(f.errors).not.toHaveBeenCalled();
  } finally { subscribe.mockRestore(); f.services.dispose(); }
});
it('[MOUNT-03] cleanup faults cannot skip other releases or replace the original attachment error', async () => {
  const f = await fixture(); const unsubscribeOwner = vi.fn(() => { throw new Error('owner unsubscribe failed'); });
  const insert = vi.spyOn(f.root, 'insertBefore').mockImplementation(() => { throw new Error('original attachment error'); });
  try {
    expect(() => mountShowcase(f.root, f.services, undefined, () => unsubscribeOwner)).toThrow('original attachment error');
    expect(unsubscribeOwner).toHaveBeenCalledOnce(); expect(probe.active).toBe(0); expect(f.services.events.size).toBe(0); expect(f.root.children).toHaveLength(0);
    expect(f.root.classList.contains('dark')).toBe(true); expect(f.root.classList.contains('light')).toBe(false);
    expect(f.errors.mock.calls.map(([entry]) => [entry.code, entry.operation])).toEqual([['view.cleanup', 'view.close']]);
  } finally { insert.mockRestore(); f.services.dispose(); }
});
