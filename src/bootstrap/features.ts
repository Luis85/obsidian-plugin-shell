import { createNoteFeatures } from '../application/note-feature';
import { taskFeature } from '../features/tasks/definition';
import { projectFeature } from '../features/projects/definition';
import type { PreferenceService } from '../application/preference-service';

/** Add one explicit registration per feature. Ports are provided once by runtime bootstrap. */
export function createFeatures(services: Parameters<typeof createNoteFeatures>[0], preferences: PreferenceService) {
  return createNoteFeatures(services, register => ({
    task: register(taskFeature, () => preferences.current.taskFolder),
    project: register(projectFeature),
  }));
}
