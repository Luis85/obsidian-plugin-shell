import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { projectConfigPath } from './project-configs.mjs';

/** A generated project carries its ownership receipt and a project-scoped TypeScript config; anything else is the shell repository. */
export function isGeneratedProject(root) {
  return existsSync(join(root, '.companion/generation.json')) && projectConfigPath(root, 'typescript') !== null;
}
/** The one definition of "shell repository" shared by `check`, `verify` and the lint scope. */
export const isShellRepository = root => !isGeneratedProject(root);
