import { CompilerError, diagnostic } from './diagnostics.ts';
type ProjectTarget = 'plugin' | 'webapp' | 'website' | 'cli';
type ProjectFramework = 'nuxtui' | 'vanilla' | 'angular' | 'none';
type ProjectType = ProjectTarget | 'hybrid';
/** The `generator` block of a project starter definition (configs/starters/<id>.json). */
export interface ProjectGenerator {
  kind: 'project'; projectType: ProjectType; framework: ProjectFramework; targets: ProjectTarget[];
  angularPins?: Record<string, string>;
}
interface ProjectStarterIdentity { id: string; version: string; sha256: string }
/** The saved project.config.json sidecar: the chosen starter plus everything generation needs without it. */
export interface ProjectSelection {
  schemaVersion: 2; starter: ProjectStarterIdentity; projectType: ProjectType; framework: ProjectFramework;
  targets: ProjectTarget[]; angularPins?: Record<string, string>;
}
const targetOrder: readonly ProjectTarget[] = ['plugin', 'webapp', 'website', 'cli'];
const frameworks: readonly ProjectFramework[] = ['nuxtui', 'vanilla', 'angular', 'none'];
export const angularPackages = ['@angular/core', '@angular/common', '@angular/compiler', '@angular/platform-browser', '@angular/compiler-cli', 'rxjs', 'tslib'] as const;
/** Human labels for guide context; data about the adapters the compiler implements, not a starter catalog. */
export const frameworkLabels: Readonly<Record<ProjectFramework, string>> = {
  nuxtui: 'Vue 3 + Nuxt UI — Vue single-file components, Pinia and Nuxt UI; not the Nuxt application framework.',
  vanilla: 'Vanilla, no frontend framework — TypeScript and DOM APIs; native Obsidian integration for plugin targets.',
  angular: 'Angular — standalone Angular components, AOT compilation and zoneless, per-view lifecycle.',
  none: 'No frontend, command-line application — Node.js commands, structured output and explicit exit codes.',
};
function check(value: unknown, message: string): asserts value {
  if (!value) throw new CompilerError(diagnostic('COMPILER_SCHEMA_INVALID', 'lower', message));
}
function record(value: unknown): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), 'A project starter generator/selection must be an object.');
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, allowed: readonly string[]): void {
  check(Object.keys(value).every(key => allowed.includes(key)), 'Unknown project starter generator/selection field.');
}
function readPins(value: unknown): Record<string, string> {
  const pins = record(value); exact(pins, angularPackages);
  check(angularPackages.every(name => typeof pins[name] === 'string' && /^\d+\.\d+\.\d+$/.test(String(pins[name]))), 'Angular dependencies need exact version pins for every required package.');
  check(new Set(angularPackages.filter(name => name.startsWith('@angular/')).map(name => pins[name])).size === 1, 'Angular packages must use one version.');
  return Object.fromEntries(angularPackages.map(name => [name, String(pins[name])]));
}
function readTargets(projectType: ProjectType, value: unknown): ProjectTarget[] {
  check(Array.isArray(value) && value.length > 0 && value.length <= targetOrder.length, 'List one to four project targets.');
  const targets = value as unknown[];
  check(targets.every(item => targetOrder.includes(item as ProjectTarget)), 'Unknown project target.');
  check(JSON.stringify(targets) === JSON.stringify(targetOrder.filter(item => targets.includes(item))), 'List each target once, in plugin, webapp, website, cli order.');
  check(projectType === 'hybrid' ? targets.length >= 2 : targets.length === 1 && targets[0] === projectType,
    'Hybrid requires at least two distinct targets; other project types list exactly their own target.');
  return [...targets] as ProjectTarget[];
}
/** Strict shared rules for the generator block. Unknown fields and incompatible combinations fail. */
function readSelectionFields(data: Record<string, unknown>): Omit<ProjectGenerator, 'kind'> {
  check([...targetOrder, 'hybrid'].includes(String(data.projectType)), 'Unknown project type.');
  const projectType = data.projectType as ProjectType;
  check(frameworks.includes(data.framework as ProjectFramework), 'Unknown frontend framework.');
  const framework = data.framework as ProjectFramework, targets = readTargets(projectType, data.targets);
  const visual = targets.some(target => target !== 'cli');
  check(visual ? framework !== 'none' : framework === 'none', 'A CLI-only project requires framework none; visual targets require a frontend framework.');
  check((framework === 'angular') === (data.angularPins !== undefined), 'Angular projects require angularPins; other frameworks must omit them.');
  return { projectType, framework, targets, ...(framework === 'angular' ? { angularPins: readPins(data.angularPins) } : {}) };
}
export function readProjectGenerator(value: unknown): ProjectGenerator {
  const data = record(value); exact(data, ['kind', 'projectType', 'framework', 'targets', 'angularPins']);
  check(data.kind === 'project', 'Expected generator kind project.');
  return { kind: 'project', ...readSelectionFields(data) };
}
function readIdentity(value: unknown): ProjectStarterIdentity {
  const data = record(value); exact(data, ['id', 'version', 'sha256']);
  check(typeof data.id === 'string' && data.id.length <= 60 && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(data.id), 'Invalid starter ID.');
  check(typeof data.version === 'string' && /^\d+\.\d+\.\d+$/.test(data.version), 'Invalid starter version.');
  check(typeof data.sha256 === 'string' && /^[a-f0-9]{64}$/.test(data.sha256), 'Invalid starter SHA-256.');
  return { id: data.id, version: data.version, sha256: data.sha256 };
}
/** Records the selected starter and its complete generator data; generation never needs the starter file again. */
export function projectSelection(starter: ProjectStarterIdentity, generator: ProjectGenerator): ProjectSelection {
  const { projectType, framework, targets, angularPins } = readProjectGenerator(generator);
  return { schemaVersion: 2, starter: readIdentity(starter), projectType, framework, targets, ...(angularPins ? { angularPins } : {}) };
}
/** Revalidate saved sidecars and direct compiler callers; never trust a TypeScript assertion at runtime. */
export function validateProjectSelection(value: unknown): ProjectSelection {
  const data = record(value); exact(data, ['schemaVersion', 'starter', 'projectType', 'framework', 'targets', 'angularPins']);
  check(data.schemaVersion === 2, 'Unsupported project.config.json; create the project again from a project starter.');
  return { schemaVersion: 2, starter: readIdentity(data.starter), ...readSelectionFields(data) };
}
