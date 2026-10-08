/** Project starter types the compiler core consumes. The validating rules are pure shared code
 * (src/shared/companion/starters/project-generator.ts); compiler adapters reach them through ../adapters/project/selection.ts. */
type ProjectTarget = 'plugin' | 'webapp' | 'website' | 'cli';
type ProjectFramework = string;
type ProjectType = ProjectTarget | 'hybrid';
/** The `generator` block of a project starter definition (configs/starters/<id>.json). */
export interface CompilerProjectGenerator {
  kind: 'project'; projectType: ProjectType; framework: ProjectFramework; targets: ProjectTarget[];
  angularPins?: Record<string, string>;
}
interface ProjectStarterIdentity { id: string; version: string; sha256: string }
/** The saved project configuration (configs/<project-id>-config.json): the chosen starter plus everything generation needs without it. */
export interface CompilerProjectSelection {
  schemaVersion: 2; starter: ProjectStarterIdentity; projectType: ProjectType; framework: ProjectFramework;
  targets: ProjectTarget[]; angularPins?: Record<string, string>;
}
