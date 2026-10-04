import { defineGAuthoringVaultStore } from '../presentation/stores/authoring-vault.ts';
import type { Pinia } from 'pinia';
import type { Sources } from '../application/sources.ts';
import type { Flow } from '../presentation/context/project.ts';
export function bindFlows(sources: Sources, pinia: Pinia): Flow[] {
  const GAuthoringVault = defineGAuthoringVaultStore(sources["authoring-vault"])(pinia);
  return [{id:"ds-flow-3",card:"node-7",label:"Load requirements",trigger:"on-open",direction:"read",requiresInput:false,get pending(){return GAuthoringVault["list-requirements"].pending;},get error(){return GAuthoringVault["list-requirements"].error;},run: () => GAuthoringVault["list-requirements"].execute(undefined)},
{id:"ds-flow-5",card:"node-13",label:"Load sitemap",trigger:"on-open",direction:"read",requiresInput:false,get pending(){return GAuthoringVault["list-sitemap"].pending;},get error(){return GAuthoringVault["list-sitemap"].error;},run: () => GAuthoringVault["list-sitemap"].execute(undefined)},
{id:"ds-flow-7",card:"node-29",label:"Load components",trigger:"on-open",direction:"read",requiresInput:false,get pending(){return GAuthoringVault["list-components"].pending;},get error(){return GAuthoringVault["list-components"].error;},run: () => GAuthoringVault["list-components"].execute(undefined)}];
}
