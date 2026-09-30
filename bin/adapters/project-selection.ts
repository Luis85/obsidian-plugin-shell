import { join } from 'node:path';
import { createFilePlan } from '../../scripts/shared/file-plan.ts';
import { validateProjectSelection } from '../../scripts/compiler/domain/project-presets.ts';
import { readData } from './storage.ts';
import { loadProjectCatalog } from './projects.ts';
/** The same contained-path inspection used for models, including symlink rejection. */
export async function savedProjectSelection(root: string) {
  const inspection = await createFilePlan(root, [{ path: 'project.config.json', content: null }]);
  if (inspection.changes[0]!.beforeHash === null) return undefined;
  return validateProjectSelection(await loadProjectCatalog(), await readData(join(root, 'project.config.json')));
}
