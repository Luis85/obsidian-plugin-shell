import { ref, shallowRef } from 'vue';
import type { PluginDataSnapshot } from '../../application/plugin-data-repository';
import type { ItemValues } from '../../features/items/definition';
import type { Failure } from '../../domain/outcome';

/** A view projection and drafts, never an independent canonical collection. */
export function createItemsState() {
  return {
    items: shallowRef<readonly PluginDataSnapshot<ItemValues>[]>([]),
    selected: shallowRef<PluginDataSnapshot<ItemValues>>(),
    createDraft: ref(''), renameDraft: ref(''),
    error: shallowRef<Failure>(), message: ref(''),
    errorTarget: ref<'create' | 'rename'>('create'),
    pending: ref(false), loading: ref(false), loaded: ref(false), blocked: ref(false),
  };
}
