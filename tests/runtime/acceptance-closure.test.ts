// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { createApp } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import { createServices } from '../../src/bootstrap/services';
import { contextKey } from '../../src/presentation/context/use-services';
import { useShowcase } from '../../src/presentation/stores/showcase';
import { failure, success } from '../../src/domain/outcome';
import { deferred, host, input } from './helpers';
import { memoryStorage } from './memory-storage';

async function documentActions() {
  const memory = memoryStorage(); const native = host(); const observe = vi.fn(); let sequence = 0;
  const services = await createServices({ documents: memory.storage, host: native,
    settings: { load: async () => null, save: async () => undefined }, local: { get: () => null, set: () => undefined },
    newId: () => `closure-${++sequence}`, now: () => '2026-09-23T12:00:00.000Z', observeError: observe });
  const pinia = createPinia(); let actions: ReturnType<typeof useShowcase> | undefined;
  const root = document.createElement('div'); document.body.append(root);
  const app = createApp({ setup() { actions = useShowcase(); return () => null; } });
  app.use(pinia); app.provide(contextKey, services); app.mount(root);
  if (!actions) throw new Error('Missing real document actions');
  return { ...memory, actions, services, native, observe,
    dispose() { app.unmount(); disposePinia(pinia); services.dispose(); root.remove(); },
  };
}

it('[AC-CLOSE-05] failed note persistence preserves existing bytes and permits deliberate recovery without false success', async () => {
  const f = await documentActions();
  const existing = ['Tasks/Handwritten.md', '---\ncustom: keep\n---\n\nHandwritten body.\n'] as const;
  f.files.set(...existing);
  const created = vi.fn(); const stop = f.services.events.on('documents.created', created);
  try {
    f.actions.preview(input); const rejected = f.actions.prepared;
    if (!rejected) throw new Error('Missing prepared note');
    f.create.mockResolvedValueOnce(failure('storage', 'error.write'));
    await f.actions.commit();
    expect([...f.files]).toEqual([existing]);
    expect(f.actions.error).toEqual({ code: 'storage', key: 'error.write', effect: 'none' });
    expect(f.actions.receipt).toBeUndefined(); expect(f.services.notifications.current).toEqual([]);
    expect(created).not.toHaveBeenCalled(); expect(f.actions.prepared).toBe(rejected);
    await f.actions.commit(); expect(f.create).toHaveBeenCalledExactlyOnceWith(rejected.path, rejected.markdown);
    f.actions.reset(); f.actions.preview(input); const recovery = f.actions.prepared;
    if (!recovery) throw new Error('Missing deliberate recovery');
    await f.actions.commit();
    expect([...f.files]).toEqual([existing, [recovery.path, recovery.markdown]]);
    expect(f.create).toHaveBeenCalledTimes(2); expect(f.actions.receipt?.id).toBe(recovery.id);
    expect(created).toHaveBeenCalledOnce(); expect(f.actions.error).toBeUndefined();
    expect(f.services.notifications.current).toHaveLength(1);
    expect(f.services.notifications.current[0]?.kind).toBe('success'); expect(f.observe).not.toHaveBeenCalled();
  } finally { stop(); f.dispose(); }
});

it('[AC-CLOSE-66] uncertain create preserves written bytes and blocks retries while open recovery never recreates', async () => {
  const uncertain = await documentActions();
  try {
    const persist = uncertain.create.getMockImplementation(); if (!persist) throw new Error('Missing persistence');
    uncertain.create.mockImplementationOnce(async (path, markdown) => { await persist(path, markdown); throw new Error('Acknowledgment lost'); });
    uncertain.actions.preview(input); const plan = uncertain.actions.prepared;
    if (!plan) throw new Error('Missing preview');
    await uncertain.actions.commit();
    expect(uncertain.actions.error).toMatchObject({ code: 'uncertain', effect: 'uncertain' });
    expect([...uncertain.files]).toEqual([[plan.path, plan.markdown]]);
    expect(uncertain.actions.receipt).toBeUndefined(); expect(uncertain.actions.createdCount).toBe(0);
    expect(uncertain.services.notifications.current).toEqual([]);
    uncertain.actions.reset(); uncertain.actions.preview({ ...input, title: 'Unsafe replacement' });
    await uncertain.actions.commit(); await uncertain.actions.openCreated();
    expect(uncertain.actions.prepared).toBe(plan); expect(uncertain.create).toHaveBeenCalledExactlyOnceWith(plan.path, plan.markdown);
    expect(uncertain.native.openDocument).not.toHaveBeenCalled(); expect(uncertain.observe).not.toHaveBeenCalled();
  } finally { uncertain.dispose(); }
  const committed = await documentActions();
  try {
    committed.actions.preview(input); const plan = committed.actions.prepared;
    if (!plan) throw new Error('Missing preview');
    await committed.actions.commit();
    vi.mocked(committed.native.openDocument).mockResolvedValueOnce(failure('storage', 'error.open'));
    await committed.actions.openCreated();
    expect(committed.actions.error).toMatchObject({ key: 'error.open', effect: 'committed' });
    expect(committed.actions.receipt?.id).toBe(plan.id); expect(committed.actions.createdCount).toBe(1);
    const opened = deferred<ReturnType<typeof success<void>>>();
    vi.mocked(committed.native.openDocument).mockReturnValueOnce(opened.promise);
    const retry = committed.actions.openCreated(); await committed.actions.openCreated();
    expect(committed.native.openDocument).toHaveBeenCalledTimes(2); expect(committed.actions.opening).toBe(true);
    opened.resolve(success(undefined)); await retry;
    expect(committed.actions.error).toBeUndefined(); expect(committed.actions.opening).toBe(false);
    expect(committed.native.openDocument).toHaveBeenNthCalledWith(2, plan.path);
    expect([...committed.files]).toEqual([[plan.path, plan.markdown]]);
    expect(committed.create).toHaveBeenCalledExactlyOnceWith(plan.path, plan.markdown);
    expect(committed.observe).not.toHaveBeenCalled();
  } finally { committed.dispose(); }
});
