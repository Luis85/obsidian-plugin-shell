import { OperationError, requireThat } from '#shared/contracts/errors.ts';

/** Source projects declared in `workbench.sources.json`: pure model, validation, dependency graph and derived tsconfig files. */
export type SourceKind = 'plugin' | 'cli' | 'companion' | 'library';
export type SourcePlatform = 'node' | 'browser';
export interface SourceProject { name: string; kind: SourceKind; path: string; references: string[]; platform?: SourcePlatform }
export interface SourceManifest { schemaVersion: 1; projects: SourceProject[] }
export type SourceFindingCode = 'SOURCE_MANIFEST_MISSING' | 'SOURCE_MANIFEST_INVALID' | 'SOURCE_CYCLE' | 'SOURCE_UNKNOWN_REFERENCE'
  | 'SOURCE_PATH_MISSING' | 'SOURCE_TSCONFIG_DRIFT' | 'SOURCE_IMPORTS_DRIFT' | 'SOURCE_UNREFERENCED_IMPORT' | 'SOURCE_GATE_UNCOVERED';
export interface SourceFinding { code: SourceFindingCode; project?: string; message: string; fix?: 'check --fix' | 'source link' | 'manual' }

const KINDS: readonly SourceKind[] = ['plugin', 'cli', 'companion', 'library'];
const PLATFORMS: readonly SourcePlatform[] = ['node', 'browser'];
const NAME = /^[a-z][a-z0-9-]*$/;
const PROJECT_PATH = /^src(?:\/[a-z][a-z0-9-]*)?$/;
const invalid = (message: string): OperationError => new OperationError('INVALID_DATA', message);

function record(value: unknown, what: string, keys: readonly string[]): Record<string, unknown> {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), 'INVALID_DATA', `Expected ${what} to be an object.`);
  const input = value as Record<string, unknown>;
  const extra = Object.keys(input).find(key => !keys.includes(key));
  if (extra !== undefined) throw invalid(`Expected only known fields in ${what}; found "${extra}".`);
  return input;
}
function parseProject(value: unknown, index: number): SourceProject {
  const what = `project ${index + 1}`;
  const input = record(value, what, ['name', 'kind', 'path', 'references', 'platform']);
  const { name, kind, path, references, platform } = input;
  requireThat(typeof name === 'string' && NAME.test(name), 'INVALID_DATA', `Expected ${what} name to match ^[a-z][a-z0-9-]*$.`);
  requireThat(typeof kind === 'string' && KINDS.includes(kind as SourceKind), 'INVALID_DATA', `Expected ${what} kind to be one of ${KINDS.join(', ')}.`);
  requireThat(typeof path === 'string' && PROJECT_PATH.test(path), 'INVALID_DATA', `Expected ${what} path to be "src" or "src/<name>".`);
  requireThat(Array.isArray(references) && references.every(item => typeof item === 'string') && new Set(references).size === references.length,
    'INVALID_DATA', `Expected ${what} references to be a list of unique project names.`);
  if (platform !== undefined) {
    requireThat(kind === 'library', 'INVALID_DATA', `Expected platform only on library projects (${what}).`);
    requireThat(typeof platform === 'string' && PLATFORMS.includes(platform as SourcePlatform), 'INVALID_DATA', `Expected ${what} platform to be node or browser.`);
  }
  return { name, kind: kind as SourceKind, path, references: [...references as string[]], ...(platform === undefined ? {} : { platform: platform as SourcePlatform }) };
}

/** Structural validation only; unknown references and cycles are separate findings (see `unknownReferences`, `findCycle`). */
export function parseSourceManifest(value: unknown): SourceManifest {
  const input = record(value, 'the source manifest', ['schemaVersion', 'projects']);
  requireThat(input.schemaVersion === 1, 'INVALID_DATA', 'Expected source manifest schemaVersion 1.');
  requireThat(Array.isArray(input.projects), 'INVALID_DATA', 'Expected source manifest projects to be a list.');
  const projects = input.projects.map(parseProject);
  for (const key of ['name', 'path'] as const) {
    const values = projects.map(project => project[key]);
    const repeated = values.find((item, index) => values.indexOf(item) !== index);
    if (repeated !== undefined) throw invalid(`Expected unique project ${key} values; "${repeated}" is repeated.`);
  }
  return { schemaVersion: 1, projects };
}

/** Manifest for a repository without `workbench.sources.json`: one plugin project, either under `src/plugin` or flat in `src`. */
export function implicitSourceManifest(hasPluginDir: boolean, hasFlatMain: boolean): SourceManifest {
  const path = hasPluginDir ? 'src/plugin' : hasFlatMain ? 'src' : undefined;
  return { schemaVersion: 1, projects: path === undefined ? [] : [{ name: 'plugin', kind: 'plugin', path, references: [] }] };
}

export function unknownReferences(manifest: SourceManifest): Array<{ project: string; reference: string }> {
  const names = new Set(manifest.projects.map(project => project.name));
  return manifest.projects.flatMap(project => project.references.filter(reference => !names.has(reference)).map(reference => ({ project: project.name, reference })));
}

/** First cycle in manifest order as a path that starts and ends at the same project; unknown references are ignored. */
export function findCycle(manifest: SourceManifest): string[] | null {
  const byName = new Map(manifest.projects.map(project => [project.name, project]));
  const finished = new Set<string>(), stack: string[] = [];
  const visit = (name: string): string[] | null => {
    const at = stack.indexOf(name);
    if (at >= 0) return [...stack.slice(at), name];
    if (finished.has(name)) return null;
    stack.push(name);
    for (const reference of byName.get(name)?.references ?? []) {
      if (!byName.has(reference)) continue;
      const cycle = visit(reference);
      if (cycle) return cycle;
    }
    stack.pop(); finished.add(name);
    return null;
  };
  for (const project of manifest.projects) { const cycle = visit(project.name); if (cycle) return cycle; }
  return null;
}

/** Dependencies first; ties keep manifest order. */
export function topologicalOrder(manifest: SourceManifest): string[] {
  const cycle = findCycle(manifest);
  if (cycle) throw new OperationError('SOURCE_CYCLE', `Source projects form a cycle: ${cycle.join(' -> ')}.`, 'Remove one reference with `source unlink`.');
  const byName = new Map(manifest.projects.map(project => [project.name, project]));
  const order: string[] = [], seen = new Set<string>();
  const visit = (name: string): void => {
    if (seen.has(name) || !byName.has(name)) return;
    seen.add(name);
    byName.get(name)!.references.forEach(visit);
    order.push(name);
  };
  manifest.projects.forEach(project => visit(project.name));
  return order;
}

/** `package.json` `imports` entries for library projects: `#name/*` to `./path/*`. */
export function importAliases(manifest: SourceManifest): Record<string, string> {
  return Object.fromEntries(manifest.projects.filter(project => project.kind === 'library').map(project => [`#${project.name}/*`, `./${project.path}/*`]));
}

/** The only project of a kind, or the named one. */
export function resolveSourceProject(manifest: SourceManifest, kind: SourceKind, name?: string): SourceProject {
  const candidates = manifest.projects.filter(project => project.kind === kind);
  const listing = candidates.map(project => project.name).join(', ');
  if (name !== undefined) {
    const found = candidates.find(project => project.name === name);
    if (found) return found;
    throw new OperationError('SOURCE_NOT_FOUND', `No ${kind} project named "${name}" exists${listing ? `; ${kind} projects: ${listing}` : ''}.`, 'Run `source list` to see the declared projects.');
  }
  if (candidates.length === 0) throw new OperationError('SOURCE_NOT_FOUND', `No ${kind} project exists in the source manifest.`, 'Create one with `source add`.');
  if (candidates.length > 1) throw new OperationError('SOURCE_AMBIGUOUS', `Several ${kind} projects exist (${listing}); name one.`, 'Pass the project name.');
  return candidates[0]!;
}

/** Relative POSIX path between two project paths (`src` or `src/<name>`). */
function relativeProjectPath(from: string, to: string): string {
  const a = from.split('/'), b = to.split('/');
  let shared = 0;
  while (shared < a.length && shared < b.length && a[shared] === b[shared]) shared++;
  const parts = [...a.slice(shared).map(() => '..'), ...b.slice(shared)];
  return parts.length === 0 ? '.' : parts.join('/');
}

export function projectPlatform(project: SourceProject): SourcePlatform {
  if (project.kind === 'plugin' || project.kind === 'companion') return 'browser';
  return project.kind === 'cli' ? 'node' : project.platform ?? 'node';
}

/** `tsconfig.json` content derived from the manifest for one project. */
export function projectTsconfig(project: SourceProject, manifest: SourceManifest): object {
  const up = project.path.split('/').map(() => '..').join('/');
  const cache = `${up}/.cache/tsbuild/${project.name}`;
  const references = project.references.map(name => {
    const target = manifest.projects.find(item => item.name === name);
    if (!target) throw invalid(`Expected project "${project.name}" to reference a declared project; "${name}" is unknown.`);
    return { path: relativeProjectPath(project.path, target.path) };
  });
  const include = ['**/*.ts', ...(project.kind === 'plugin' || project.kind === 'companion' ? ['**/*.vue'] : []),
    ...(project.kind === 'library' ? ['**/*.mjs', '**/*.d.mts'] : [])];
  return {
    extends: `${up}/configs/types/tsconfig.${projectPlatform(project)}.json`,
    compilerOptions: { rootDir: '.', declarationDir: cache, tsBuildInfoFile: `${cache}.tsbuildinfo` },
    include,
    exclude: ['tests/**'],
    references,
  };
}

/** Root solution `tsconfig.json`: every project in dependency order. */
export function solutionTsconfig(manifest: SourceManifest): object {
  const byName = new Map(manifest.projects.map(project => [project.name, project]));
  return { files: [], references: topologicalOrder(manifest).map(name => ({ path: `./${byName.get(name)!.path}` })) };
}
