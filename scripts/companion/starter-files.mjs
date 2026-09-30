/** Maintainer/Companion projection of the same standalone JSON definitions used by the CLI. */
import { loadDefinitions, companionCatalog } from '../starters/repository.ts';
import { validateStarterCatalog } from './starter-contract.mjs';
export async function loadStarterCatalog(root) {
  return validateStarterCatalog(companionCatalog(await loadDefinitions(root)));
}
