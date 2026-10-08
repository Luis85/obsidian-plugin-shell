import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isGeneratedProject } from '#shared/platform/repository-kind.mjs';

export type RepositoryScope = 'generated-project' | 'shell-repository';
/** Generated project or shell repository, by the one definition in src/shared/platform/repository-kind.mjs. */
export const repositoryScope = (root: string): RepositoryScope => isGeneratedProject(root) ? 'generated-project' : 'shell-repository';
/** Prefer each current driver; older generated consumers may still ship that driver under scripts/. */
export function toolingPath(root: string, driver: string): string {
  const current = `tooling/${driver}`, legacy = `scripts/${driver}`;
  return !existsSync(join(root, current)) && repositoryScope(root) === 'generated-project' && existsSync(join(root, legacy)) ? legacy : current;
}
