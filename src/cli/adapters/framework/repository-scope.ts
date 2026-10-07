import { isGeneratedProject } from '#shared/platform/repository-kind.mjs';

export type RepositoryScope = 'generated-project' | 'shell-repository';
/** Generated project or shell repository, by the one definition in src/shared/platform/repository-kind.mjs. */
export const repositoryScope = (root: string): RepositoryScope => isGeneratedProject(root) ? 'generated-project' : 'shell-repository';
/** The shell repository keeps its repository tooling in tooling/; a generated project carries its copy under scripts/. */
export const toolingFolder = (scope: RepositoryScope): string => scope === 'generated-project' ? 'scripts' : 'tooling';
