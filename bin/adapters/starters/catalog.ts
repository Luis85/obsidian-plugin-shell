/** Maintainer/Companion projection of the same standalone JSON definitions used by the CLI. */
import { loadDefinitions, companionCatalog } from './repository.ts';
import { validateStarterCatalog } from '../../../scripts/companion/starter-contract.mjs';
export async function loadStarterCatalog(root: string) {
  return validateStarterCatalog(companionCatalog(await loadDefinitions(root)));
}
