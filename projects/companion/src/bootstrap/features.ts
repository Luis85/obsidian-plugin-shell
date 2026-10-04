import { feature as GRequirement } from "../generated/application/documents/requirement.ts";
import { feature as GScreen } from "../generated/application/documents/screen.ts";
import { feature as GComponent } from "../generated/application/documents/component.ts";
import { feature as GTestRecipe } from "../generated/application/documents/test-recipe.ts";
import { feature as GPluginProject } from "../generated/application/documents/plugin-project.ts";
import { feature as GDataSource } from "../generated/application/documents/data-source.ts";
import { feature as GSourceOperation } from "../generated/application/documents/source-operation.ts";
import { feature as GDesignToken } from "../generated/application/documents/design-token.ts";
import { createNoteFeatures } from '../application/note-feature';
import { taskFeature } from '../features/tasks/definition';
import { projectFeature } from '../features/projects/definition';
import { itemFeature } from '../features/items/definition';
import type { PreferenceService } from '../application/preference-service';

/** Add one explicit registration per feature. Ports are provided once by runtime bootstrap. */
export function createFeatures(services: Parameters<typeof createNoteFeatures>[0], preferences: PreferenceService) {
  return createNoteFeatures(services, register => ({
    task: register(taskFeature, () => preferences.current.taskFolder),
    project: register(projectFeature),
    items: register(itemFeature),
    GRequirement: register(GRequirement),
    GScreen: register(GScreen),
    GComponent: register(GComponent),
    GTestRecipe: register(GTestRecipe),
    GPluginProject: register(GPluginProject),
    GDataSource: register(GDataSource),
    GSourceOperation: register(GSourceOperation),
    GDesignToken: register(GDesignToken),
  }));
}
