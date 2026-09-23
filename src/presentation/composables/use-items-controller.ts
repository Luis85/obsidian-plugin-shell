import { onScopeDispose } from 'vue';
import type { EventObserver, ShellEvents } from '../../application/events';
import type { PluginDataSnapshot } from '../../application/plugin-data-repository';
import type { Result, Failure } from '../../domain/outcome';
import type { ItemValues } from '../../features/items/definition';
import { createItemActions } from '../../features/items/actions';
import { createItemsState } from '../stores/items-state';
import { useServices } from '../context/use-services';

export function useItemsController() {
  const services = useServices();
  const repository = services.repositories.items;
  const events: EventObserver<Pick<ShellEvents, 'plugin-data.created' | 'plugin-data.updated' | 'plugin-data.deleted'>> = services.events;
  const owner = `items:${services.newId()}`;
  const state = createItemsState();
  let alive = true;
  const actions = createItemActions(repository, services.modals, owner, () => alive);
  let generation = 0;
  function failed(error: Failure) {
    state.error.value = error;
    if (error.effect === 'uncertain') state.blocked.value = true;
  }
  async function refresh(review = false) {
    if (!alive) return;
    const current = ++generation;
    state.loading.value = true;
    try {
      const result = await repository.list();
      if (!alive || current !== generation) return;
      if (!result.ok) { failed(result.error); return; }
      state.items.value = result.value; state.loaded.value = true;
      if (review) {
        state.error.value = undefined; state.message.value = 'items.reloaded';
        if (state.selected.value) state.selected.value = result.value.find(item => item.id === state.selected.value?.id);
      }
    } catch {
      services.diagnostics.report('items.read', 'items.refresh');
      if (alive && current === generation) failed({ code: 'unexpected', key: 'error.unexpected', effect: 'none' });
    } finally { if (alive && current === generation) state.loading.value = false; }
  }
  // Subscribe before querying. Every newer fact invalidates older query results.
  const stops = (['plugin-data.created', 'plugin-data.updated', 'plugin-data.deleted'] as const).map(type =>
    events.on(type, payload => { if (payload.entity === 'item') void refresh(); }));
  void refresh();
  onScopeDispose(() => { alive = false; generation++; for (const stop of stops) stop(); services.modals.closeOwner(owner); });
  async function run<T>(operation: () => Promise<Result<T>>, committed: (value: T) => void) {
    if (!alive || state.pending.value || state.blocked.value) return;
    state.pending.value = true; state.error.value = undefined; state.message.value = '';
    try {
      const result = await operation();
      if (!alive) return;
      if (result.ok) committed(result.value); else failed(result.error);
    } catch {
      services.diagnostics.report('items.unexpected', 'items.action');
      if (alive) failed({ code: 'unexpected', key: 'error.unexpected', effect: 'uncertain' });
    } finally { if (alive) state.pending.value = false; }
  }
  function edit(item: PluginDataSnapshot<ItemValues>) {
    if (!alive || state.pending.value || state.blocked.value) return;
    state.selected.value = item; state.renameDraft.value = item.values.label;
    state.error.value = undefined; state.message.value = '';
  }
  async function create() {
    if (!state.pending.value) state.errorTarget.value = 'create';
    const draft = state.createDraft.value;
    await run(() => actions.create(draft), () => {
      if (state.createDraft.value === draft) state.createDraft.value = '';
      state.message.value = 'items.created';
    });
  }
  async function rename() {
    if (!state.pending.value) state.errorTarget.value = 'rename';
    const item = state.selected.value; const draft = state.renameDraft.value;
    if (!item) return;
    await run(() => actions.rename(item, draft), saved => {
      state.selected.value = saved;
      if (state.renameDraft.value === draft) state.renameDraft.value = saved.values.label;
      state.message.value = 'items.renamed';
    });
  }
  async function remove() {
    const item = state.selected.value;
    if (!item) return;
    await run(() => actions.remove(item), removed => {
      if (!removed) return;
      state.selected.value = undefined; state.renameDraft.value = ''; state.message.value = 'items.deleted';
    });
  }
  async function reload() { if (!state.pending.value && !state.blocked.value) await refresh(true); }
  return { ...state, edit, create, rename, remove, reload };
}
