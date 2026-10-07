import { join } from 'node:path';
import { exists } from './files.ts';
import { projectConfigPath } from '#shared/platform/project-configs.mjs';

export type RepositoryScope = 'generated-project' | 'shell-repository';
/** A generated project carries its ownership receipt and a project-scoped TypeScript config; anything else is the shell. */
export async function repositoryScope(root: string, existsPath: typeof exists = exists): Promise<RepositoryScope> {
  return await existsPath(join(root, '.companion/generation.json')) && projectConfigPath(root, 'typescript') ? 'generated-project' : 'shell-repository';
}
/** The shell repository keeps its repository tooling in tooling/; a generated project carries its copy under scripts/. */
export const toolingFolder = (scope: RepositoryScope): string => scope === 'generated-project' ? 'scripts' : 'tooling';
