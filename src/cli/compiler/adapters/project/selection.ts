/** The shared project starter rules, reported as compiler diagnostics (COMPILER_SCHEMA_INVALID, lower phase). */
import * as rules from '#shared/companion/starters/project-generator.ts';
import { CompilerError, diagnostic } from '../../domain/diagnostics.ts';
import { projectConfigPattern } from '../../domain/project-config.ts';
import type { ProjectGenerator, ProjectSelection } from '../../domain/project-starter.ts';
export { angularPackages } from '#shared/companion/starters/project-generator.ts';
/** The compiler core declares its own starter types. `Agreed` is the domain type only while it and the shared rule type
 * are assignable in both directions; any drift turns it into `never` and the wrappers below fail to compile. */
type Agreed<Domain, Shared> = [Domain] extends [Shared] ? ([Shared] extends [Domain] ? Domain : never) : never;
type Generator = Agreed<ProjectGenerator, rules.ProjectGenerator>;
type Selection = Agreed<ProjectSelection, rules.ProjectSelection>;
function compilerRule<T>(read: () => T): T {
  try { return read(); } catch (error) {
    if (error instanceof rules.ProjectStarterError) throw new CompilerError(diagnostic('COMPILER_SCHEMA_INVALID', 'lower', error.message));
    throw error;
  }
}
export function readProjectGenerator(value: unknown): Generator {
  return compilerRule(() => rules.readProjectGenerator(value));
}
/** Records the selected starter and its complete generator data; generation never needs the starter file again. */
export function projectSelection(starter: { id: string; version: string; sha256: string }, generator: Generator): Selection {
  return compilerRule(() => rules.projectSelection(starter, generator));
}
/** Revalidate saved sidecars and direct compiler callers; never trust a TypeScript assertion at runtime. */
export function validateProjectSelection(value: unknown): Selection {
  return compilerRule(() => rules.validateProjectSelection(value, projectConfigPattern));
}
