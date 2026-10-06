import type { GTestRecipesPort } from '../../application/test-recipes/contracts.ts';
import type { Services } from "../../../bootstrap/services.ts";

import { noteOperations } from '../../application/note-operations.ts';
import type { RelationshipSession } from '../../application/relationship-session.ts';
import { protectNoteRelationships } from '../../application/relationship-session.ts';

import { entity as GTestRecipeEntity } from '../../application/documents/test-recipe.ts';
/** Native mappings use the shell's canonical repositories; other adapters remain explicit. */
export const createGTestRecipesAdapter: (shell: Services, integrity: RelationshipSession) => GTestRecipesPort = (_shell, integrity) => {
  const GTestRecipeNotes = noteOperations(protectNoteRelationships(_shell.repositories.GTestRecipe, integrity),"test-recipe",input => { const result=GTestRecipeEntity.decode(input); if(!result.ok) throw new Error('NOTE_VALUES_INVALID'); return result.value; });

  return {
    "list": GTestRecipeNotes.list,
    "create": GTestRecipeNotes.create,
    "update": GTestRecipeNotes.update,
    "delete": GTestRecipeNotes.delete,
  };
};
