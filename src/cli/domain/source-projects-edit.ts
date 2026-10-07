import { SketchError, requireSketch } from '#shared/contracts/sketch-errors.ts';
import { findCycle, parseSourceManifest, type SourceKind, type SourceManifest, type SourcePlatform, type SourceProject } from './source-projects.ts';

/** Pure edits of a source manifest and of the files derived from it; each result is revalidated before it is returned. */
const KEY_ORDER = ['name', 'kind', 'path', 'references', 'platform', 'include', 'compilerOptions', 'extraReferences', 'gateExemptions'] as const;

/** Stable key order, so a manifest written by any command reads the same. */
export function manifestDocument(manifest: SourceManifest): object {
  return { schemaVersion: 1, projects: manifest.projects.map(project => Object.fromEntries(KEY_ORDER
    .filter(key => project[key] !== undefined).map(key => [key, structuredClone(project[key])]))) };
}
function checked(projects: SourceProject[]): SourceManifest {
  const manifest = parseSourceManifest(manifestDocument({ schemaVersion: 1, projects }));
  const cycle = findCycle(manifest);
  if (cycle) throw new SketchError('SOURCE_CYCLE', `The change would form a cycle: ${cycle.join(' -> ')}.`);
  return manifest;
}
function project(manifest: SourceManifest, name: string): SourceProject {
  const found = manifest.projects.find(item => item.name === name);
  if (!found) throw new SketchError('SOURCE_NOT_FOUND', `No source project named "${name}"; declared: ${manifest.projects.map(item => item.name).join(', ') || 'none'}.`);
  return found;
}
export const dependents = (manifest: SourceManifest, name: string): string[] =>
  manifest.projects.filter(item => item.references.includes(name)).map(item => item.name);

export interface NewSourceProject { name: string; kind: SourceKind; platform?: SourcePlatform; references: string[] }
export function addProject(manifest: SourceManifest, input: NewSourceProject): SourceManifest {
  requireSketch(!manifest.projects.some(item => item.name === input.name), 'SOURCE_EXISTS', `A source project named "${input.name}" already exists.`);
  requireSketch(!manifest.projects.some(item => item.path === 'src'), 'SOURCE_FLAT_SRC', 'This repository keeps one flat src project; move it to src/<name> before adding another.');
  for (const reference of input.references) project(manifest, reference);
  const added: SourceProject = { name: input.name, kind: input.kind, path: `src/${input.name}`, references: [...input.references], ...(input.platform ? { platform: input.platform } : {}) };
  return checked([...manifest.projects, added]);
}
export function linkProjects(manifest: SourceManifest, from: string, to: string): SourceManifest {
  const source = project(manifest, from); project(manifest, to);
  requireSketch(from !== to, 'SOURCE_CYCLE', `A project cannot reference itself (${from}).`);
  requireSketch(!source.references.includes(to), 'SOURCE_LINKED', `${from} already references ${to}.`);
  return checked(manifest.projects.map(item => item.name === from ? { ...item, references: [...item.references, to] } : item));
}
export function unlinkProjects(manifest: SourceManifest, from: string, to: string): SourceManifest {
  const source = project(manifest, from);
  requireSketch(source.references.includes(to), 'SOURCE_NOT_LINKED', `${from} does not reference ${to}.`);
  return checked(manifest.projects.map(item => item.name === from ? { ...item, references: item.references.filter(name => name !== to) } : item));
}
export function renameProject(manifest: SourceManifest, from: string, to: string): SourceManifest {
  const source = project(manifest, from);
  requireSketch(!manifest.projects.some(item => item.name === to), 'SOURCE_EXISTS', `A source project named "${to}" already exists.`);
  const path = source.path === 'src' ? 'src' : `src/${to}`;
  requireSketch(!manifest.projects.some(item => item.path === path && item.name !== from), 'SOURCE_EXISTS', `${path} already belongs to another project.`);
  return checked(manifest.projects.map(item => ({ ...item, ...(item.name === from ? { name: to, path } : {}),
    references: item.references.map(name => name === from ? to : name) })));
}
export function removeProject(manifest: SourceManifest, name: string): SourceManifest {
  project(manifest, name);
  const users = dependents(manifest, name);
  requireSketch(!users.length, 'SOURCE_REFERENCED', `${name} is still referenced by ${users.join(', ')}; unlink those first.`);
  return checked(manifest.projects.filter(item => item.name !== name));
}

const normalized = (path: string): string => path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
const inSrc = (path: string): boolean => path === 'src' || path.startsWith('src/');
export interface SolutionDrift { missing: string[]; stale: string[]; solution: boolean }
/** Required references of the root solution: every project and every project tests folder that exists. */
export function solutionRequirements(manifest: SourceManifest, testFolders: readonly string[]): string[] {
  return [...manifest.projects.map(item => item.path), ...testFolders];
}
function solutionPaths(config: unknown): string[] | null {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const { references, include, compilerOptions } = config as Record<string, unknown>;
  if (!Array.isArray(references) || include !== undefined || compilerOptions !== undefined) return null;
  return references.map(item => normalized(String((item as { path?: unknown } | null)?.path ?? '')));
}
/** Missing project/tests references and stale `src` references of a root solution; `solution: false` when it is no solution file. */
export function solutionDrift(config: unknown, required: readonly string[]): SolutionDrift {
  const paths = solutionPaths(config);
  if (paths === null) return { missing: [...required], stale: [], solution: false };
  return { missing: required.filter(path => !paths.includes(path)), stale: paths.filter(path => inSrc(path) && !required.includes(path)), solution: true };
}
/** The solution with stale `src` references removed and missing ones inserted after the last reference of their group. */
export function reconcileSolution(config: unknown, required: readonly string[]): object {
  const base = solutionPaths(config) === null ? { files: [], references: [] } : structuredClone(config as Record<string, unknown>);
  const drift = solutionDrift(base, required);
  const references = (base.references as Array<{ path: string }>).filter(item => !drift.stale.includes(normalized(item.path)));
  for (const path of drift.missing) {
    const tests = path.endsWith('/tests');
    let at = -1;
    references.forEach((item, index) => { const current = normalized(item.path); if (inSrc(current) && current.endsWith('/tests') === tests) at = index; });
    if (at < 0 && tests) references.forEach((item, index) => { if (inSrc(normalized(item.path))) at = index; });
    references.splice(at + 1, 0, { path: `./${path}` });
  }
  return { ...base, references };
}
/** `package.json` `imports` with the library aliases set, stale aliases into src removed and every other entry kept in place. */
export function reconcileImports(current: unknown, aliases: Readonly<Record<string, string>>): Record<string, unknown> {
  const existing = current && typeof current === 'object' && !Array.isArray(current) ? current as Record<string, unknown> : {};
  const managed = (key: string, value: unknown) => key.startsWith('#') && typeof value === 'string' && /^\.\/src(?:\/|$)/.test(value);
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(existing)) {
    if (Object.hasOwn(aliases, key)) next[key] = aliases[key];
    else if (!managed(key, value)) next[key] = value;
  }
  for (const [key, value] of Object.entries(aliases)) if (!Object.hasOwn(next, key)) next[key] = value;
  return next;
}
