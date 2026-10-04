import { createGAuthoringVaultService } from '../application/authoring-vault/service.ts';
import { createGAuthoringVaultAdapter } from '../infrastructure/sources/authoring-vault.ts';
import { createGTestRecipesService } from '../application/test-recipes/service.ts';
import { createGTestRecipesAdapter } from '../infrastructure/sources/test-recipes.ts';
import { createRelationshipIntegrity } from './relationships.ts';
import type { Services } from "../../bootstrap/services.ts";
import type { Sources, SourcePorts } from '../application/sources.ts';
import { validateSourceOverrides } from '../application/source-overrides.ts';
export function createSources(shell: Services, overrides: Partial<SourcePorts> = {}): Sources {
 validateSourceOverrides(overrides,{"authoring-vault":["list-requirements","list-sitemap","list-components"],"test-recipes":["list","create","update","delete"]});
 const integrity=createRelationshipIntegrity(shell);
 return {"authoring-vault": createGAuthoringVaultService(overrides["authoring-vault"] ?? createGAuthoringVaultAdapter(shell, integrity)),
"test-recipes": createGTestRecipesService(overrides["test-recipes"] ?? createGTestRecipesAdapter(shell, integrity))}; }
