import { defineGAuthoringVaultStore } from '../presentation/stores/authoring-vault.ts';
import * as GAuthoringVaultContracts from '../application/authoring-vault/contracts.ts';
import type { Pinia } from 'pinia';
import type { Sources } from '../application/sources.ts';
import type { VisualContext } from '../presentation/composables/use-visual.ts';
import { screens } from '../domain/screens.ts';
import { useNavigation } from '../presentation/stores/navigation.ts';
import { handleVisualInteraction } from '../application/visual-interactions.ts';
export function createVisualContext(sources: Sources, pinia: Pinia, openModal: (id: string) => void): VisualContext {
const GAuthoringVault = defineGAuthoringVaultStore(sources["authoring-vault"])(pinia);
const navigation = useNavigation(pinia);
return { ports: [{ sourceId: "ds-source-1", operationId: "ds-operation-2", direction: "read", requiresInput: false,
get data() { return GAuthoringVault["list-requirements"].data; }, get pending() { return GAuthoringVault["list-requirements"].pending; }, get error() { return GAuthoringVault["list-requirements"].error; },
async run(input) { if (!GAuthoringVaultContracts.isGListRequirementsInput(input)) throw new Error('INVALID_INPUT'); return GAuthoringVault["list-requirements"].execute(input); } }], handle: request => handleVisualInteraction(request, sources), navigate(target) {
  const screen = screens.find(s => s.id === target); if (!screen || ['action', 'group'].includes(screen.kind)) throw new Error('SCREEN_NOT_NAVIGABLE');
  if (screen.kind === 'modal') openModal(target); else navigation.open(target);
} };
}
