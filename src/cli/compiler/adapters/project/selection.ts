/** The shared project starter rules, reported as compiler diagnostics (COMPILER_SCHEMA_INVALID, lower phase). */
import * as rules from '#shared/companion/starters/project-generator.ts';
import { CompilerError, diagnostic } from '../../domain/diagnostics.ts';
import { projectConfigPattern } from '../../domain/project-config.ts';
import type { ProjectGenerator, ProjectSelection } from '../../domain/project-starter.ts';
export { angularPackages } from '#shared/companion/starters/project-generator.ts';
function compilerRule<T>(read: () => T): T {
  try { return read(); } catch (error) {
    if (error instanceof rules.ProjectStarterError) throw new CompilerError(diagnostic('COMPILER_SCHEMA_INVALID', 'lower', error.message));
    throw error;
  }
}
export function readProjectGenerator(value: unknown): ProjectGenerator {
  return compilerRule(() => rules.readProjectGenerator(value));
}
/** Records the selected starter and its complete generator data; generation never needs the starter file again. */
export function projectSelection(starter: { id: string; version: string; sha256: string }, generator: ProjectGenerator): ProjectSelection {
  return compilerRule(() => rules.projectSelection(starter, generator));
}
/** Revalidate saved sidecars and direct compiler callers; never trust a TypeScript assertion at runtime. */
export function validateProjectSelection(value: unknown): ProjectSelection {
  return compilerRule(() => rules.validateProjectSelection(value, projectConfigPattern));
}
