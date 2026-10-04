// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import { createServices } from '../../src/bootstrap/services';
import { contextKey } from '../../src/presentation/context/use-services';
import { useTaskRepository } from '../../src/presentation/composables/use-task-repository';
import { useSettingsForm } from '../../src/presentation/composables/use-settings-form';
import { useShowcaseActions } from '../../src/presentation/composables/use-showcase-actions';
import { useShowcase } from '../../src/presentation/stores/showcase';
import { browserModalSink } from '../../harness/app/modal-sink';
import { memoryStorage } from './memory-storage';
import { host, deferred } from './helpers';
import { unwrapEntity } from './entity-fixture';

async function composition<T>(create: () => T) {
  const memory = memoryStorage(); const native = host(); let sequence = 0;
  const save = vi.fn(async (_value: unknown): Promise<void> => undefined);
  const services = await createServices({ documents: memory.storage, host: native, modals: browserModalSink(), settings: { load: async () => null, save },
    local: { get: () => null, set: () => undefined }, newId: () => `composable-${++sequence}`, now: () => '2026-09-22T12:00:00.000Z' });
  const pinia = createPinia(); let state: T | undefined;
  const app = createApp({ setup() { state = create(); return () => null; } });
  const root = document.createElement('div'); document.body.append(root);
  app.use(pinia); app.use(services.i18n); app.provide(contextKey, services); app.mount(root);
  if (state === undefined) throw new Error('Missing composable state');
  return { state, services, memory, native, save,
    close() { app.unmount(); disposePinia(pinia); root.remove(); },
    dispose() { app.unmount(); disposePinia(pinia); services.dispose(); root.remove(); },
  };
}
describe('Presentation composables with actual application services', () => {
  it('[PRESENTATION-03-03] repository behavior runs independently of its Vue template', async () => {
    const f = await composition(useTaskRepository);
    try {
      const created = unwrapEntity(await f.services.repositories.task.create({ title: 'Review' }, 'create'));
      await f.state.reload(); expect(f.state.notes.value).toHaveLength(1);
      f.state.edit(created); f.state.draft.title = 'Reviewed'; f.state.draft.status = 'done';
      await f.state.save();
      expect(f.state.selected.value?.values).toMatchObject({ title: 'Reviewed', status: 'done' });
      expect(f.state.message.value).toBe('repo.saved');
      expect(f.memory.files.get(created.path)).toContain('Reviewed');
      f.state.confirming.value = true; await f.state.remove();
      expect(f.memory.files.has(created.path)).toBe(false); expect(f.state.notes.value).toEqual([]);
      expect(f.state.message.value).toBe('repo.deleted'); expect(f.state.error.value).toBeUndefined();
    } finally { f.dispose(); }
  });
  it('[PRESENTATION-03-04] external preference commits merge clean fields without erasing a local draft', async () => {
    const f = await composition(useSettingsForm);
    try {
      f.state.form.taskFolder = 'My/Draft';
      expect((await f.services.preferences.update({ taskFolder: 'External', locale: 'de' })).ok).toBe(true);
      await nextTick();
      expect(f.state.form.taskFolder).toBe('My/Draft'); expect(f.state.form.locale).toBe('de');
      await f.state.save(); expect(f.services.preferences.current.taskFolder).toBe('My/Draft');
      expect(f.services.preferences.current.locale).toBe('de'); expect(f.save).toHaveBeenCalledTimes(2);
      expect(f.state.error.value).toBe(''); expect(f.state.pending.value).toBe(false);
    } finally { f.dispose(); }
  });
  it('[PRESENTATION-03-05] disposed settings consumers do not revive after a real pending commit', async () => {
    const f = await composition(useSettingsForm); const barrier = deferred();
    f.save.mockImplementationOnce(() => barrier.promise);
    f.state.form.taskFolder = 'Pending'; const pending = f.state.save();
    expect(f.state.pending.value).toBe(true); f.close(); barrier.resolve(); await pending;
    expect(f.services.preferences.current.taskFolder).toBe('Pending');
    expect(f.services.notifications.current).toEqual([]);
    f.services.dispose();
  });
  it('[PRESENTATION-03-06] event and feedback actions use real runtime ownership and localization', async () => {
    const f = await composition(() => ({ ...useShowcaseActions(), model: useShowcase() }));
    try {
      f.state.ping(); expect(f.state.model.stream[0]?.type).toBe('showcase.ping');
      f.state.notice(); expect(f.native.notice).toHaveBeenCalledTimes(1);
      f.state.expected(); expect(f.services.notifications.current.some(item => item.owner === `${f.state.model.owner}:showcase-example`)).toBe(true);
      const opened = f.state.modal(); const dialog = document.querySelector('dialog');
      expect(dialog?.textContent).toContain('One view, two environments');
      dialog?.close(); await opened;
    } finally { f.dispose(); }
  });
});
