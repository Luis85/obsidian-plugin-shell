import { createFilePlan } from '#shared/platform/file-plan.ts';
import { parseJsonData } from '#shared/contracts/json-data.ts';
import { projectConfigPath, retiredProjectConfigPath } from '../compiler/domain/project-config.ts';
import { validateProjectSelection } from '../compiler/adapters/project/selection.ts';
import { openDocument } from '../domain/document.ts';
import { requireSketch } from '#shared/contracts/sketch-errors.ts';
import { prepared, type Prepared } from './storage.ts';
import { guardedText } from './user-settings.ts';
import { projectConfigFiles } from './project-selection.ts';
/** The reviewed, hash-guarded move of the retired root project.config.json to configs/<project-id>-config.json.
 * Bytes move unchanged; the shared writer rolls back on failure, and the reverse move restores the previous layout. */
export async function retiredProjectConfigPlan(root: string, projectPath: string): Promise<Prepared | null> {
  const retired = await guardedText(root, retiredProjectConfigPath);
  if (retired.content === null) return null;
  const existing = await projectConfigFiles(root);
  requireSketch(!existing.length, 'MIGRATION_CONFLICT', `${existing.join(', ')} already exists; review it and remove the retired ${retiredProjectConfigPath} yourself. Nothing was changed.`);
  validateProjectSelection(parseJsonData(retired.content));
  const project = await guardedText(root, projectPath);
  requireSketch(project.content !== null, 'MIGRATION_PROJECT_ID', `Moving ${retiredProjectConfigPath} needs the saved project ${projectPath} to name the project ID.`);
  const target = projectConfigPath(openDocument(parseJsonData(project.content)).project.id);
  const plan = await createFilePlan(root, [{ path: target, content: retired.content }, { path: retiredProjectConfigPath, content: null }]);
  requireSketch(plan.changes[0]!.beforeHash === null, 'MIGRATION_CONFLICT', `${target} already exists; nothing was overwritten.`);
  requireSketch(plan.changes[1]!.beforeHash === retired.beforeHash, 'MAKER_STALE', `${retiredProjectConfigPath} changed while planning migration.`);
  const checked = prepared(plan, { moves: [{ key: 'projectConfig', from: retiredProjectConfigPath, to: target, folder: false }], retained: [],
    next: `The project configuration now lives in ${target}. Commands read it from there; ${retiredProjectConfigPath} is no longer read.` });
  return { ...checked, validate: async () => {
    requireSketch((await guardedText(root, retiredProjectConfigPath)).beforeHash === retired.beforeHash, 'MAKER_STALE', `${retiredProjectConfigPath} changed after migration review.`);
    requireSketch((await guardedText(root, projectPath)).beforeHash === project.beforeHash, 'MAKER_STALE', 'Project changed after migration review.');
    requireSketch(!(await projectConfigFiles(root)).length, 'MIGRATION_CONFLICT', 'A project configuration appeared after migration review.');
  } };
}
