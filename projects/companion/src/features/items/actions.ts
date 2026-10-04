import type { PluginDataRepository, PluginDataSnapshot } from '../../application/plugin-data-repository';
import type { ModalService } from '../../application/modal-service';
import { failure, success, type Result } from '../../domain/outcome';
import type { ItemInput, ItemValues } from './definition';

/** Repositories own validation, identity, committed facts and the shared writer. */
export function createItemActions(repository: PluginDataRepository<ItemInput, ItemValues>, modals: ModalService, owner: string, active: () => boolean) {
  return {
    create: (label: string) => repository.create({ label }),
    rename: (item: PluginDataSnapshot<ItemValues>, label: string) => repository.update(item, { label }),
    async remove(item: PluginDataSnapshot<ItemValues>): Promise<Result<boolean>> {
      const outcome = await modals.confirm({ owner, titleKey: 'items.deleteTitle', messageKey: 'items.deleteHelp', confirmKey: 'items.confirmDelete' });
      if (outcome.status === 'failed') return { ok: false, error: outcome.error };
      if (outcome.status === 'cancelled') return success(false);
      if (!active()) return failure('disposed', 'error.disposed');
      const result = await repository.delete(item);
      return result.ok ? success(true) : result;
    },
  };
}
