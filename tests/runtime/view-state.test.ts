// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import { createServices } from '../../src/bootstrap/services';
import { contextKey } from '../../src/presentation/context';
import { useShowcase } from '../../src/presentation/stores/showcase';
import { failure, success } from '../../src/domain/outcome';
import { deferred, host, input } from './helpers';
async function view() {
  const writer = { create: vi.fn(async (_path: string, _text: string) => success(undefined)) };
  const observed = vi.fn(); let sequence = 0;
  const services = await createServices({ documents: writer, host: host(), settings: { load: async () => null, save: async () => undefined },
    local: { get: () => null, set: () => undefined }, newId: () => `id-${++sequence}`, now: () => '2026-09-22T12:00:00.000Z', observeError: observed });
  const pinia = createPinia(); let store!: ReturnType<typeof useShowcase>;
  const wrapper = mount(defineComponent({ setup() { store = useShowcase(); return () => h('div', store.prepared?.path ?? 'draft'); } }),
    { global: { plugins: [pinia], provide: { [contextKey as symbol]: services } } });
  return { store, writer, services, observed, close() { wrapper.unmount(); disposePinia(pinia); services.dispose(); } };
}
it('[VIEW-02-01] more than one hundred abandoned previews never exhaust the session or write', async () => {
  const f = await view();
  try {
    for (let i = 0; i < 150; i++) { f.store.preview({ ...input, title: `Task ${i}` }); expect(f.store.error).toBeUndefined(); }
    expect(f.writer.create).not.toHaveBeenCalled(); const plan = f.store.prepared; expect(plan).toBeDefined();
    await f.store.commit(); expect(f.writer.create).toHaveBeenCalledExactlyOnceWith(plan?.path, plan?.markdown);
    expect(f.store.receipt?.path).toBe(plan?.path); expect(f.observed).not.toHaveBeenCalled();
  } finally { f.close(); }
});
it('[VIEW-02-02] in-flight and uncertain writes cannot be reset or replaced by a second preview', async () => {
  const f = await view(); const barrier = deferred<ReturnType<typeof success<undefined>>>();
  try {
    f.writer.create.mockImplementationOnce(() => barrier.promise);
    f.store.preview(input); const plan = f.store.prepared; const work = f.store.commit();
    f.store.reset(); f.store.preview({ ...input, title: 'Replacement' }); expect(f.store.prepared).toBe(plan);
    barrier.reject(new Error('uncertain filesystem result')); await work;
    expect(f.store.error?.effect).toBe('uncertain');
    f.store.reset(); f.store.preview({ ...input, title: 'Replacement' }); expect(f.store.prepared).toBe(plan);
    await f.store.commit(); expect(f.writer.create).toHaveBeenCalledTimes(1);
    expect(f.store.receipt).toBeUndefined(); expect(f.services.notifications.current).toEqual([]);
  } finally { f.close(); }
});
it('[VIEW-02-03] opening failure cannot turn committed Markdown into another create', async () => {
  const f = await view();
  try {
    vi.mocked(f.services.host.openDocument).mockResolvedValue(failure('storage', 'error.open'));
    f.store.preview(input); await f.store.commit(); await f.store.openCreated(); await f.store.openCreated();
    expect(f.store.error?.effect).toBe('committed'); expect(f.store.receipt).toBeDefined();
    expect(f.writer.create).toHaveBeenCalledTimes(1); expect(f.store.createdCount).toBe(1);
  } finally { f.close(); }
});
