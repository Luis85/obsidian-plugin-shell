// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { createApp } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import { createServices, type Services } from '../../src/bootstrap/services';
import { DocumentCreationService } from '../../src/application/document-service';
import { contextKey } from '../../src/presentation/context/use-services';
import { useShowcase } from '../../src/presentation/stores/showcase';
import { failure, success } from '../../src/domain/outcome';
import { deferred, host, input } from './helpers';
import { memoryStorage } from './memory-storage';
import { unwrap } from './repository-helpers';

async function runtime(memory = memoryStorage()) {
  const observe = vi.fn(); let sequence = 0; const native = host();
  const services = await createServices({ documents: memory.storage, host: native,
    settings: { load: async () => null, save: async () => undefined }, local: { get: () => null, set: () => undefined },
    newId: () => `lifecycle-${++sequence}`, now: () => '2026-09-23T12:00:00.000Z', observeError: observe });
  return { ...memory, memory, services, observe, native };
}
function view(services: Services) {
  const pinia = createPinia(); let actions: ReturnType<typeof useShowcase> | undefined;
  const root = document.createElement('div'); document.body.append(root);
  const app = createApp({ setup() { actions = useShowcase(); return () => null; } });
  app.use(pinia); app.provide(contextKey, services); app.mount(root);
  if (!actions) throw new Error('Missing production view actions');
  let closed = false;
  return { actions, close() { if (closed) return; closed = true; app.unmount(); disposePinia(pinia); root.remove(); } };
}

it('[PERSIST-62-01] discarded previews write nothing and in-flight unload preserves the actual host outcome without replay', async () => {
  for (const outcome of ['committed', 'failed', 'uncertain'] as const) {
    const f = await runtime(); const started = deferred(); const release = deferred();
    try {
      const cancelled = unwrap(f.services.documents.prepare('task', input, 'Tasks', 'cancelled'));
      expect(f.services.documents.discard(cancelled)).toBe(true);
      expect(await f.services.documents.commit(cancelled, 'Tasks')).toMatchObject({ ok: false, error: { code: 'stale' } });
      expect(f.create).not.toHaveBeenCalled(); expect([...f.files]).toEqual([]);
      const plan = unwrap(f.services.documents.prepare('task', input, 'Tasks', 'in-flight'));
      const persist = f.create.getMockImplementation(); if (!persist) throw new Error('Missing persistence boundary');
      f.create.mockImplementationOnce(async (path, bytes) => {
        started.resolve(); await release.promise;
        if (outcome === 'failed') return failure('storage', 'error.write');
        const saved = await persist(path, bytes);
        if (outcome === 'uncertain') throw new Error('Private acknowledgment failure');
        return saved;
      });
      const observed = vi.fn(); f.services.events.on('documents.created', observed);
      const work = f.services.documents.commit(plan, 'Tasks'); await started.promise;
      expect(f.services.documents.discard(plan)).toBe(false); expect(observed).not.toHaveBeenCalled();
      expect(f.observe).not.toHaveBeenCalled(); f.services.dispose(); release.resolve();
      const result = await work;
      if (outcome === 'committed') expect(result).toEqual(success({ entity: 'task', id: plan.id, path: plan.path, schemaVersion: 1 }));
      else expect(result).toEqual(failure(outcome === 'failed' ? 'storage' : 'uncertain', outcome === 'failed' ? 'error.write' : 'error.uncertain'));
      expect([...f.files]).toEqual(outcome === 'failed' ? [] : [[plan.path, plan.markdown]]);
      expect(f.create).toHaveBeenCalledExactlyOnceWith(plan.path, plan.markdown);
      expect(await f.services.documents.commit(plan, 'Tasks')).toMatchObject({ ok: false, error: { code: 'disposed' } });
      expect(f.services.documents.prepare('task', input, 'Tasks', 'replacement')).toMatchObject({ ok: false, error: { code: 'disposed' } });
      expect(observed).not.toHaveBeenCalled(); expect(f.observe).not.toHaveBeenCalled();
      const restored = await runtime(f.memory);
      try {
        const rows = unwrap(await restored.services.repositories.task.list());
        expect(rows.map(row => ({ id: row.id, path: row.path }))).toEqual(outcome === 'failed' ? [] : [{ id: plan.id, path: plan.path }]);
        expect(f.create).toHaveBeenCalledOnce(); expect(restored.observe).not.toHaveBeenCalled();
      } finally { restored.services.dispose(); }
    } finally { release.resolve(); f.services.dispose(); }
  }
});

it('[PERSIST-62-02] request retention is bounded and exported diagnostics exclude private plans after committed listener failures', async () => {
  const f = await runtime();
  try {
    for (let index = 0; index < 150; index++) {
      const preview = unwrap(f.services.documents.prepare('task', input, 'Tasks', `discard-${index}`));
      expect(f.services.documents.discard(preview)).toBe(true);
    }
    const plans = Array.from({ length: 100 }, (_, index) => unwrap(f.services.documents.prepare('task',
      { ...input, title: `Private title ${index}`, tags: 'secret-property' }, 'Private-folder', `retained-${index}`)));
    expect(f.services.documents.prepare('task', input, 'Tasks', 'too-many')).toEqual(failure('validation', 'error.sessionLimit'));
    expect(f.create).not.toHaveBeenCalled(); const plan = plans[0]; if (!plan) throw new Error('Missing bounded plan');
    f.services.events.on('documents.created', () => { throw new Error(`${plan.path}\n${plan.markdown}`); });
    expect(await f.services.documents.commit(plan, 'Private-folder')).toEqual(success({ entity: 'task', id: plan.id, path: plan.path, schemaVersion: 1 }));
    expect(f.services.documents.discard(plan)).toBe(false);
    expect(f.services.documents.prepare('task', input, 'Tasks', 'still-full')).toEqual(failure('validation', 'error.sessionLimit'));
    expect(await f.services.documents.commit(plan, 'Private-folder')).toEqual(success({ entity: 'task', id: plan.id, path: plan.path, schemaVersion: 1 }));
    expect(f.create).toHaveBeenCalledExactlyOnceWith(plan.path, plan.markdown); expect([...f.files]).toEqual([[plan.path, plan.markdown]]);
    expect(f.observe.mock.calls).toEqual([[{ sequence: 1, code: 'event.listener', operation: 'event.dispatch' }]]);
    expect(f.services.diagnostics.current).toEqual([{ sequence: 1, code: 'event.listener', operation: 'event.dispatch' }]);
    const exported = f.services.debugging.exportJSON();
    for (const privateValue of [plan.path, plan.markdown, 'Private title', 'secret-property', 'retained-0']) expect(exported).not.toContain(privateValue);
    expect(f.services.debugging.snapshot().diagnostics).toEqual({ retained: 1, observed: 1 });
    const unused = plans[1]; if (!unused) throw new Error('Missing unused plan');
    expect(f.services.documents.discard(unused)).toBe(true);
    expect(f.services.documents.prepare('task', input, 'Tasks', 'reviewed-new-preview').ok).toBe(true);
    const oversized = new DocumentCreationService({ large: { project: () => success({ title: 'Private large body', properties: {}, body: 'x'.repeat(1_000_001) }) } },
      f.memory.storage, { publish: () => undefined }, () => '', () => 'large-id', () => '2026-09-23', f.services.diagnostics);
    try { expect(oversized.prepare('large', undefined, 'Tasks', 'large')).toEqual(failure('validation', 'error.entity')); }
    finally { oversized.dispose(); }
    expect(f.create).toHaveBeenCalledOnce(); expect(f.observe).toHaveBeenCalledOnce();
  } finally { f.services.dispose(); }
});

it('[PERSIST-66-01] retained disposed view actions cannot prepare, create, reset or reopen committed documents', async () => {
  const f = await runtime(); const owner = view(f.services); const sibling = view(f.services);
  const commit = vi.spyOn(f.services.documents, 'commit');
  const localWrite = vi.spyOn(f.services.local, 'set');
  try {
    owner.actions.preview(input); await owner.actions.commit();
    const receipt = owner.actions.receipt; const prepared = owner.actions.prepared;
    expect(receipt).toBeDefined(); owner.close();
    const bytes = [...f.files]; const count = sibling.actions.createdCount;
    const state = { busy: owner.actions.busy, error: owner.actions.error, opening: owner.actions.opening, page: owner.actions.page };
    owner.actions.reset(); owner.actions.preview({ ...input, title: 'Late resurrection' });
    owner.actions.navigate('events');
    await owner.actions.commit(); await owner.actions.openCreated();
    expect(owner.actions.receipt).toBe(receipt); expect(owner.actions.prepared).toBe(prepared);
    expect({ busy: owner.actions.busy, error: owner.actions.error, opening: owner.actions.opening, page: owner.actions.page }).toEqual(state);
    expect(commit).toHaveBeenCalledOnce();
    expect(localWrite).not.toHaveBeenCalled();
    expect([...f.files]).toEqual(bytes); expect(f.create).toHaveBeenCalledOnce();
    expect(f.native.openDocument).not.toHaveBeenCalled(); expect(sibling.actions.createdCount).toBe(count);
    sibling.actions.preview({ ...input, title: 'Surviving sibling' }); await sibling.actions.commit();
    expect(f.create).toHaveBeenCalledTimes(2); expect(sibling.actions.receipt?.path).toBe('Tasks/Surviving sibling.md');
    expect(f.observe).not.toHaveBeenCalled();
  } finally { commit.mockRestore(); localWrite.mockRestore(); owner.close(); sibling.close(); f.services.dispose(); }
});
