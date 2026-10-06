// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import { createServices } from '../../src/bootstrap/services';
import { contextKey } from '../../src/presentation/context/use-services';
import { useShowcase } from '../../src/presentation/stores/showcase';
import { failure, success } from '../../src/domain/outcome';
import { deferred, host, input } from './helpers';
import { memoryStorage } from './memory-storage';
import type { LocalPreferences, TimerScheduler } from '../../src/application/ports';
async function view(local: LocalPreferences = { get: () => null, set: () => undefined }, scheduler?: TimerScheduler) {
  const memory = memoryStorage(); const writer = { ...memory.storage, create: memory.create };
  const observed = vi.fn(); let sequence = 0;
  const services = await createServices({ documents: writer, host: host(), settings: { load: async () => null, save: async () => undefined },
    local, scheduler, newId: () => `id-${++sequence}`, now: () => '2026-09-22T12:00:00.000Z', observeError: observed });
  const pinia = createPinia(); let store!: ReturnType<typeof useShowcase>;
  const wrapper = mount(defineComponent({ setup() { store = useShowcase(); return () => h('div', store.prepared?.path ?? 'draft'); } }),
    { global: { plugins: [pinia], provide: { [contextKey as symbol]: services } } });
  return { store, writer, files: memory.files, services, observed, unmount() { wrapper.unmount(); disposePinia(pinia); }, close() { wrapper.unmount(); disposePinia(pinia); services.dispose(); } };
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
it('[VIEW-03-01] navigation survives denied local storage and persisted valid pages restore', async () => {
  const denied = await view({ get() { throw new Error('denied'); }, set() { throw new Error('denied'); } });
  try {
    expect(denied.store.page).toBe('overview'); denied.store.navigate('events'); expect(denied.store.page).toBe('events');
    expect(denied.observed.mock.calls.map(([entry]) => entry.code)).toEqual(['local.read', 'local.write']);
  } finally { denied.close(); }
  const restored = await view({ get: () => 'settings', set: () => undefined });
  try { expect(restored.store.page).toBe('settings'); } finally { restored.close(); }
});
it('[VIEW-03-02] unexpected commit and opening exceptions preserve effect-aware state and independent diagnostics', async () => {
  const f = await view();
  try {
    await f.store.commit(); await f.store.openCreated(); expect(f.writer.create).not.toHaveBeenCalled();
    f.store.preview(input); vi.spyOn(f.services.documents, 'commit').mockRejectedValueOnce(new Error('unexpected commit'));
    await f.store.commit(); expect(f.store.error?.effect).toBe('uncertain'); expect(f.store.receipt).toBeUndefined();
    expect(f.observed.mock.calls.map(([entry]) => entry.code)).toEqual(['document.unexpected']);
  } finally { f.close(); }
  const opened = await view();
  try {
    opened.store.preview(input); await opened.store.commit(); vi.mocked(opened.services.host.openDocument).mockRejectedValueOnce(new Error('host open'));
    await opened.store.openCreated(); expect(opened.store.error?.effect).toBe('committed'); expect(opened.store.receipt).toBeDefined();
    expect(opened.observed.mock.calls.map(([entry]) => entry.code)).toEqual(['document.open']); expect(opened.writer.create).toHaveBeenCalledOnce();
  } finally { opened.close(); }
});
it('[VIEW-03-03] a closed view never receives late completion or notification while committed effects remain canonical', async () => {
  const f = await view(); const barrier = deferred<ReturnType<typeof success<undefined>>>();
  try {
    f.writer.create.mockImplementationOnce(() => barrier.promise); f.store.preview(input); const work = f.store.commit();
    await f.store.commit(); expect(f.writer.create).toHaveBeenCalledOnce(); f.unmount(); barrier.resolve(success(undefined)); await work;
    expect(f.store.receipt).toBeUndefined(); expect(f.services.notifications.current).toEqual([]); expect(f.observed).not.toHaveBeenCalled();
  } finally { f.services.dispose(); }
});
it('[VIEW-03-04] bounded event history records all canonical event kinds and stops with its view', async () => {
  const f = await view();
  try {
    for (let i = 0; i < 40; i++) f.services.showcase.ping(i);
    f.services.hostEvents.publish({ type: 'host.active-file-changed', payload: { available: true } });
    await f.services.preferences.update({ locale: 'de' }); expect(f.store.eventCount).toBe(42); expect(f.store.stream).toHaveLength(30);
    expect(f.store.stream.slice(0, 2).map(item => item.type)).toEqual(['preferences.changed', 'host.active-file-changed']);
    f.unmount(); f.services.showcase.ping(41); expect(f.store.eventCount).toBe(42);
  } finally { f.services.dispose(); }
});
it('[VIEW-03-05] host observations and repository changes are visible without counting the same committed create twice', async () => {
  const f = await view();
  try {
    f.services.hostEvents.publish({ type: 'host.vault.entry-created', payload: { path: 'Private/secret.md', kind: 'file' } });
    expect(f.store.createdCount).toBe(0);
    const created = await f.services.repositories.task.create({ title: 'secret', status: 'todo', tags: [] }, 'one');
    expect(created.ok).toBe(true); if (!created.ok) throw new Error('Expected created note');
    const updated = await f.services.repositories.task.update(created.value, { ...created.value.values, title: 'renamed' });
    expect(updated.ok).toBe(true); if (!updated.ok) throw new Error('Expected updated note');
    expect((await f.services.repositories.task.delete(updated.value)).ok).toBe(true);
    expect(f.store.createdCount).toBe(1); expect(f.store.stream.map(item => item.type)).toEqual(['documents.deleted', 'documents.updated', 'documents.created', 'host.vault.entry-created']);
    expect(JSON.stringify(f.store.stream)).not.toContain('Private'); expect(JSON.stringify(f.store.stream)).not.toContain('secret');
  } finally { f.close(); }
});
it('[VIEW-03-06] timer failure after persistence cannot relabel the actual committed receipt as uncertain', async () => {
  const f = await view(undefined, { after() { throw new Error('timer unavailable'); } });
  try {
    f.store.preview(input); const plan = f.store.prepared; await f.store.commit();
    expect(f.files.size).toBe(1); expect(f.files.get(plan?.path ?? '')).toBe(plan?.markdown);
    expect(f.store.receipt?.path).toBe(plan?.path); expect(f.store.error).toBeUndefined(); expect(f.store.createdCount).toBe(1);
    expect(f.services.notifications.current[0]).toMatchObject({ kind: 'success', visible: true });
    expect(f.observed.mock.calls.map(([entry]) => [entry.code, entry.operation])).toEqual([['notice.timer', 'notice.schedule']]);
  } finally { f.close(); }
});
it('[VIEW-03-07] opening is single-flight and its old completion cannot poison a new document draft', async () => {
  for (const reject of [false, true]) {
    const f = await view(); const pending = deferred<ReturnType<typeof failure>>();
    try {
      f.store.preview(input); await f.store.commit(); vi.mocked(f.services.host.openDocument).mockImplementation(() => pending.promise);
      const first = f.store.openCreated(); const second = f.store.openCreated(); expect(f.services.host.openDocument).toHaveBeenCalledOnce();
      f.store.reset(); f.store.preview({ ...input, title: 'New draft' }); const draft = f.store.prepared;
      if (reject) pending.reject(new Error('late open failure')); else pending.resolve(failure('storage', 'error.open'));
      await Promise.all([first, second]);
      expect(f.store.prepared).toBe(draft); expect(f.store.receipt).toBeUndefined(); expect(f.store.error).toBeUndefined(); expect(f.store.opening).toBe(false);
      expect(f.files.size).toBe(1); expect(f.observed.mock.calls.map(([entry]) => entry.code)).toEqual(reject ? ['document.open'] : []);
    } finally { f.close(); }
  }
});
it('[VIEW-03-08] unexpected feedback failure is independent from successful document persistence', async () => {
  const f = await view();
  try {
    vi.spyOn(f.services.notifications, 'show').mockImplementationOnce(() => { throw new Error('unexpected presentation failure'); });
    f.store.preview(input); await f.store.commit(); expect(f.files.size).toBe(1); expect(f.store.receipt).toBeDefined(); expect(f.store.error).toBeUndefined();
    expect(f.observed.mock.calls.map(([entry]) => [entry.code, entry.operation])).toEqual([['notice.unexpected', 'notice.show']]);
  } finally { f.close(); }
});
it('[VIEW-03-09] a retained opening action cannot operate after its owning view closes', async () => {
  const f = await view();
  try {
    f.store.preview(input); await f.store.commit(); f.unmount(); await f.store.openCreated();
    expect(f.services.host.openDocument).not.toHaveBeenCalled(); expect(f.files.size).toBe(1); expect(f.observed).not.toHaveBeenCalled();
  } finally { f.services.dispose(); }
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
