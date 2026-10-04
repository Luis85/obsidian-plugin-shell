import type { GAuthoringVaultService } from './authoring-vault/service.ts';
import type { GTestRecipesService } from './test-recipes/service.ts';
import type { GAuthoringVaultPort } from './authoring-vault/contracts.ts';
import type { GTestRecipesPort } from './test-recipes/contracts.ts';
export interface Sources { "authoring-vault": GAuthoringVaultService;
"test-recipes": GTestRecipesService; }
export interface SourcePorts { "authoring-vault": GAuthoringVaultPort;
"test-recipes": GTestRecipesPort; }
