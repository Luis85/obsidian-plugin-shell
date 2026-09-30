import { join } from 'node:path';
import { createFilePlan } from '../../scripts/shared/file-plan.mjs';
import { validateProjectSelection } from '../../scripts/compiler/domain/project-starter.ts';
import { readData } from './storage.ts';
/** The same contained-path inspection used for models, including symlink rejection. The sidecar records the
 * chosen starter and its complete selection, so generation never needs the starter definition again. */
export async function savedProjectSelection(root: string) {
  const inspection = await createFilePlan(root, [{ path: 'project.config.json', content: null }]);
  if (inspection.changes[0]!.beforeHash === null) return undefined;
  return validateProjectSelection(await readData(join(root, 'project.config.json')));
}
