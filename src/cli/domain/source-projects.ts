import { SketchError, requireSketch } from '#shared/contracts/sketch-errors.ts';

/** Source projects declared in `workbench.sources.json`: pure model, validation, dependency graph and derived tsconfig files. */
export type SourceKind = 'plugin' | 'cli' | 'companion' | 'library';
export type SourcePlatform = 'node' | 'browser';
/** Repository gates whose scope must reach every source project, unless the manifest records why it does not. */
export type SourceGate = 'lint' | 'lineLimit' | 'coverage' | 'analyzer';
export interface SourceProject {
  name: string; kind: SourceKind; path: string; references: string[]; platform?: SourcePlatform;
  /** Replaces the kind's default tsconfig `include` globs. */
  include?: string[];
  /** Extra tsconfig compiler options after the derived `rootDir`, `declarationDir` and `tsBuildInfoFile`. */
  compilerOptions?: Record<string, unknown>;
  /** Repository-relative tsconfig files referenced after the project references (crossings outside `src`). */
  extraReferences?: string[];
  /** Gates that deliberately do not cover this project, each with the recorded reason. */
  gateExemptions?: Partial<Record<SourceGate, string>>;
}
export interface SourceManifest { schemaVersion: 1; projects: SourceProject[] }
export type SourceFindingCode = 'SOURCE_MANIFEST_MISSING' | 'SOURCE_MANIFEST_INVALID' | 'SOURCE_CYCLE' | 'SOURCE_UNKNOWN_REFERENCE'
  | 'SOURCE_PATH_MISSING' | 'SOURCE_TSCONFIG_DRIFT' | 'SOURCE_IMPORTS_DRIFT' | 'SOURCE_UNREFERENCED_IMPORT' | 'SOURCE_GATE_UNCOVERED';
export interface SourceFinding { code: SourceFindingCode; project?: string; message: string; fix?: 'check --fix' | 'source link' | 'manual'; next?: string }

export const SOURCE_KINDS: readonly SourceKind[] = ['plugin', 'cli', 'companion', 'library'];
const SOURCE_GATES: readonly SourceGate[] = ['lint', 'lineLimit', 'coverage', 'analyzer'];
const PLATFORMS: readonly SourcePlatform[] = ['node', 'browser'];
const NAME = /^[a-z][a-z0-9-]*$/;
const PROJECT_PATH = /^src(?:\/[a-z][a-z0-9-]*)?$/;
/** Relative, forward-slash, no `..` segment, no leading slash or drive. */
const RELATIVE = /^(?![/\\])(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)(?![A-Za-z]:)[^\0]+$/;
const DERIVED_OPTIONS = ['rootDir', 'declarationDir', 'tsBuildInfoFile', 'composite'];
const invalid = (message: string): SketchError => new SketchError('INVALID_DATA', message);

function record(value: unknown, what: string, keys: readonly string[] | null): Record<string, unknown> {
  requireSketch(value !== null && typeof value === 'object' && !Array.isArray(value), 'INVALID_DATA', `Expected ${what} to be an object.`);
  const input = value as Record<string, unknown>;
  const extra = keys === null ? undefined : Object.keys(input).find(key => !keys.includes(key));
  if (extra !== undefined) throw invalid(`Expected only known fields in ${what}; found "${extra}".`);
  return input;
}
function uniqueStrings(value: unknown, what: string): string[] {
  requireSketch(Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string' && item.length <= 512 && RELATIVE.test(item))
    && new Set(value).size === value.length, 'INVALID_DATA', `Expected ${what} to be a non-empty list of unique relative paths.`);
  return [...value as string[]];
}
function jsonValue(value: unknown, depth = 0): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (depth > 8 || typeof value !== 'object') return false;
  return Object.values(value).every(item => jsonValue(item, depth + 1));
}
function compilerOptions(value: unknown, what: string): Record<string, unknown> {
  const input = record(value, `${what} compilerOptions`, null);
  const derived = Object.keys(input).find(key => DERIVED_OPTIONS.includes(key));
  if (derived !== undefined) throw invalid(`Expected ${what} compilerOptions to leave the derived "${derived}" to the manifest.`);
  requireSketch(jsonValue(input), 'INVALID_DATA', `Expected ${what} compilerOptions to be plain JSON.`);
  return structuredClone(input);
}
function gateExemptions(value: unknown, what: string): Partial<Record<SourceGate, string>> {
  const input = record(value, `${what} gateExemptions`, SOURCE_GATES);
  for (const reason of Object.values(input)) requireSketch(typeof reason === 'string' && reason.trim().length > 0 && reason.length <= 500,
    'INVALID_DATA', `Expected every ${what} gate exemption to state its reason (1..500 characters).`);
  return { ...input } as Partial<Record<SourceGate, string>>;
}
function optionalFields(input: Record<string, unknown>, what: string): Partial<SourceProject> {
  const fields: Partial<SourceProject> = {};
  if (input.include !== undefined) fields.include = uniqueStrings(input.include, `${what} include`);
  if (input.compilerOptions !== undefined) fields.compilerOptions = compilerOptions(input.compilerOptions, what);
  if (input.extraReferences !== undefined) fields.extraReferences = uniqueStrings(input.extraReferences, `${what} extraReferences`);
  if (input.gateExemptions !== undefined) fields.gateExemptions = gateExemptions(input.gateExemptions, what);
  return fields;
}
function parseProject(value: unknown, index: number): SourceProject {
  const what = `project ${index + 1}`;
  const input = record(value, what, ['name', 'kind', 'path', 'references', 'platform', 'include', 'compilerOptions', 'extraReferences', 'gateExemptions']);
  const { name, kind, path, references, platform } = input;
  requireSketch(typeof name === 'string' && NAME.test(name), 'INVALID_DATA', `Expected ${what} name to match ^[a-z][a-z0-9-]*$.`);
  requireSketch(typeof kind === 'string' && SOURCE_KINDS.includes(kind as SourceKind), 'INVALID_DATA', `Expected ${what} kind to be one of ${SOURCE_KINDS.join(', ')}.`);
  requireSketch(typeof path === 'string' && PROJECT_PATH.test(path), 'INVALID_DATA', `Expected ${what} path to be "src" or "src/<name>".`);
  requireSketch(Array.isArray(references) && references.every(item => typeof item === 'string') && new Set(references).size === references.length,
    'INVALID_DATA', `Expected ${what} references to be a list of unique project names.`);
  if (platform !== undefined) {
    requireSketch(kind === 'library', 'INVALID_DATA', `Expected platform only on library projects (${what}).`);
    requireSketch(typeof platform === 'string' && PLATFORMS.includes(platform as SourcePlatform), 'INVALID_DATA', `Expected ${what} platform to be node or browser.`);
  }
  return { name, kind: kind as SourceKind, path, references: [...references as string[]], ...(platform === undefined ? {} : { platform: platform as SourcePlatform }),
    ...optionalFields(input, what) };
}

/** Structural validation only; unknown references and cycles are separate findings (see `unknownReferences`, `findCycle`). */
export function parseSourceManifest(value: unknown): SourceManifest {
  const input = record(value, 'the source manifest', ['schemaVersion', 'projects']);
  requireSketch(input.schemaVersion === 1, 'INVALID_DATA', 'Expected source manifest schemaVersion 1.');
  requireSketch(Array.isArray(input.projects), 'INVALID_DATA', 'Expected source manifest projects to be a list.');
  const projects = input.projects.map(parseProject);
  for (const key of ['name', 'path'] as const) {
    const values = projects.map(project => project[key]);
    const repeated = values.find((item, index) => values.indexOf(item) !== index);
    if (repeated !== undefined) throw invalid(`Expected unique project ${key} values; "${repeated}" is repeated.`);
  }
  // A flat `src` project owns every folder under src, so it cannot share src with src/<name> projects.
  if (projects.length > 1 && projects.some(project => project.path === 'src'))
    throw invalid('Expected a flat "src" project to be the only project; move it to src/<name> before adding others.');
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
  if (cycle) throw new SketchError('SOURCE_CYCLE', `Source projects form a cycle: ${cycle.join(' -> ')}.`);
  const byName = new Map(manifest.projects.map(project => [project.name, project]));
  const order: string[] = [], seen = new Set<string>();
  const visit = (name: string): void => {
    const project = byName.get(name);
    if (seen.has(name) || !project) return;
    seen.add(name);
    project.references.forEach(visit);
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
    throw new SketchError('SOURCE_NOT_FOUND', `No ${kind} project named "${name}" exists${listing ? `; ${kind} projects: ${listing}` : ''}.`);
  }
  if (candidates.length === 0) throw new SketchError('SOURCE_NOT_FOUND', `No ${kind} project exists in the source manifest.`);
  if (candidates.length > 1) throw new SketchError('SOURCE_AMBIGUOUS', `Several ${kind} projects exist (${listing}); name one.`);
  return candidates[0]!;
}

/** Relative POSIX path between two repository-relative paths. */
function relativePath(from: string, to: string): string {
  const a = from.split('/'), b = to.split('/');
  let shared = 0;
  while (shared < a.length && shared < b.length && a[shared] === b[shared]) shared++;
  const parts = [...a.slice(shared).map(() => '..'), ...b.slice(shared)];
  return parts.length === 0 ? '.' : parts.join('/');
}

function projectPlatform(project: SourceProject): SourcePlatform {
  if (project.kind === 'plugin' || project.kind === 'companion') return 'browser';
  return project.kind === 'cli' ? 'node' : project.platform ?? 'node';
}
function referencePaths(project: SourceProject, manifest: SourceManifest, from: string): Array<{ path: string }> {
  return project.references.map(name => {
    const target = manifest.projects.find(item => item.name === name);
    if (!target) throw invalid(`Expected project "${project.name}" to reference a declared project; "${name}" is unknown.`);
    return { path: relativePath(from, target.path) };
  });
}
const upTo = (path: string): string => path.split('/').map(() => '..').join('/');
const defaultInclude = (kind: SourceKind): string[] => ['**/*.ts', ...(kind === 'plugin' || kind === 'companion' ? ['**/*.vue'] : []),
  ...(kind === 'library' ? ['**/*.mjs', '**/*.d.mts'] : [])];

/** `tsconfig.json` content derived from the manifest for one project. */
export function projectTsconfig(project: SourceProject, manifest: SourceManifest): object {
  const up = upTo(project.path);
  const cache = `${up}/.cache/tsbuild/${project.name}`;
  return {
    extends: `${up}/configs/types/tsconfig.${projectPlatform(project)}.json`,
    compilerOptions: { rootDir: '.', declarationDir: cache, tsBuildInfoFile: `${cache}.tsbuildinfo`, ...structuredClone(project.compilerOptions ?? {}) },
    include: [...project.include ?? defaultInclude(project.kind)],
    exclude: ['tests/**'],
    references: [...referencePaths(project, manifest, project.path), ...(project.extraReferences ?? []).map(path => ({ path: relativePath(project.path, path) }))],
  };
}

/** `tests/tsconfig.json` scaffold of a project: a non-composite check of its tests against the project and its references. */
export function testsTsconfig(project: SourceProject, manifest: SourceManifest): object {
  const folder = `${project.path}/tests`, up = upTo(folder);
  return {
    extends: `${up}/configs/types/tsconfig.${projectPlatform(project)}.json`,
    compilerOptions: { rootDir: '.', composite: false, declaration: false, emitDeclarationOnly: false, noEmit: true, incremental: true,
      tsBuildInfoFile: `${up}/.cache/tsbuild/${project.name}-tests.tsbuildinfo` },
    include: ['**/*'],
    references: [{ path: '..' }, ...referencePaths(project, manifest, folder)],
  };
}

/** Root solution `tsconfig.json`: every project in dependency order. */
export function solutionTsconfig(manifest: SourceManifest): object {
  const byName = new Map(manifest.projects.map(project => [project.name, project]));
  return { files: [], references: topologicalOrder(manifest).map(name => ({ path: `./${byName.get(name)!.path}` })) };
}
