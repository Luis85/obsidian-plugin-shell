/**
 * Files derived from the source manifest: each project's tsconfig.json and tests/tsconfig.json, the root solution
 * tsconfig.json and package.json "imports". One computation serves `source check` (as findings) and every writing
 * `source` command (as plan entries); a file whose content already matches is never rewritten, so hand formatting
 * of an unchanged file survives.
 */
import { isDeepStrictEqual } from 'node:util';
import { serializeJson as json } from '#shared/contracts/serialization.ts';
import { importAliases, projectTsconfig, testsTsconfig, type SourceFindingCode, type SourceManifest, type SourceProject } from '../domain/source-projects.ts';
import { reconcileImports, reconcileSolution, solutionDrift, solutionRequirements } from '../domain/source-projects-edit.ts';
import { normalizePath } from '../domain/source-imports.ts';
import { isDirectory, readJsonFile } from './source-workspace.ts';

/** A drifted derived file: `content` is the regenerated text, null when only a person can repair it. */
export interface DerivedChange { path: string; code: SourceFindingCode; project?: string; message: string; content: string | null }
export interface DerivedOptions {
  /** Solution reference renames applied before reconciling, so a renamed project keeps its place. */
  renamed?: ReadonlyArray<readonly [from: string, to: string]>;
  /** Files the same plan writes (scaffolded or moved), read instead of the disk; their folders count as present. */
  overlay?: ReadonlyMap<string, string>;
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const referencePaths = (value: unknown): string[] => (Array.isArray(record(value).references) ? record(value).references as unknown[] : [])
  .map(item => String(record(item).path ?? '').replace(/\\/g, '/').replace(/\/+$/, ''));

type Present = (folder: string) => Promise<boolean>;
type Read = (path: string) => Promise<{ value: unknown } | null | 'invalid'>;
function reader(root: string, overlay?: ReadonlyMap<string, string>): Read {
  return async path => {
    try {
      const text = overlay?.get(path);
      return text === undefined ? await readJsonFile(root, path) : { value: JSON.parse(text) as unknown };
    } catch { return 'invalid'; }
  };
}
async function projectChange(read: Read, project: SourceProject, manifest: SourceManifest): Promise<DerivedChange | null> {
  const path = `${project.path}/tsconfig.json`, actual = await read(path), derived = projectTsconfig(project, manifest);
  if (actual === 'invalid') return { path, code: 'SOURCE_TSCONFIG_DRIFT', project: project.name, message: `${path} is not valid JSON; repair it by hand.`, content: null };
  if (actual && isDeepStrictEqual(actual.value, derived)) return null;
  return { path, code: 'SOURCE_TSCONFIG_DRIFT', project: project.name, content: json(derived),
    message: actual ? `${path} differs from the manifest (extends, compiler options, include or references).` : `${path} is missing.` };
}
/** Required test references: the project itself and its references, then any extra reference outside src (a stale project reference is dropped). */
function testsReferences(actual: unknown, project: SourceProject, manifest: SourceManifest): Array<{ path: string }> {
  const folder = `${project.path}/tests`;
  const required = (record(testsTsconfig(project, manifest)).references as Array<{ path: string }>).map(item => item.path);
  const inSrc = (path: string) => { const target = normalizePath(`${folder}/${path}`) ?? ''; return target === 'src' || target.startsWith('src/'); };
  const extras = referencePaths(actual).filter(path => !required.includes(path) && !inSrc(path));
  return [...required, ...extras].map(path => ({ path }));
}
async function testsChange(read: Read, present: Present, project: SourceProject, manifest: SourceManifest): Promise<DerivedChange | null> {
  const folder = `${project.path}/tests`, path = `${folder}/tsconfig.json`;
  if (!await present(folder))
    return { path, code: 'SOURCE_TSCONFIG_DRIFT', project: project.name, content: null, message: `${folder}/ is missing; add at least one test with ${path} referencing the project.` };
  const actual = await read(path);
  if (actual === 'invalid') return { path, code: 'SOURCE_TSCONFIG_DRIFT', project: project.name, message: `${path} is not valid JSON; repair it by hand.`, content: null };
  if (!actual) return { path, code: 'SOURCE_TSCONFIG_DRIFT', project: project.name, message: `${path} is missing.`, content: json(testsTsconfig(project, manifest)) };
  const references = testsReferences(actual.value, project, manifest);
  if (isDeepStrictEqual([...referencePaths(actual.value)].sort(), references.map(item => item.path).sort())) return null;
  return { path, code: 'SOURCE_TSCONFIG_DRIFT', project: project.name, content: json({ ...record(actual.value), references }),
    message: `${path} must reference its project (..) and exactly the projects ${project.name} references.` };
}
/** The solution with renamed project folders already applied, so a renamed project keeps its place in the list. */
function withRenames(value: unknown, renamed: DerivedOptions['renamed']): unknown {
  const copy = structuredClone(value);
  for (const item of Array.isArray(record(copy).references) ? record(copy).references as unknown[] : []) {
    const reference = record(item), current = String(reference.path ?? '').replace(/^\.\//, '');
    const rename = renamed?.find(([from]) => current === from || current.startsWith(`${from}/`));
    if (rename) reference.path = `./${rename[1]}${current.slice(rename[0].length)}`;
  }
  return copy;
}
const driftDetail = (drift: { missing: string[]; stale: string[] }): string =>
  [drift.missing.length ? `missing ${drift.missing.join(', ')}` : '', drift.stale.length ? `stale ${drift.stale.join(', ')}` : ''].filter(Boolean).join('; ') || 'renamed projects';
async function solutionChange(read: Read, required: string[], renamed: DerivedOptions['renamed']): Promise<DerivedChange | null> {
  const path = 'tsconfig.json', actual = await read(path);
  if (actual === 'invalid') return { path, code: 'SOURCE_TSCONFIG_DRIFT', message: 'tsconfig.json is not valid JSON; repair it by hand.', content: null };
  if (!actual) return { path, code: 'SOURCE_TSCONFIG_DRIFT', content: json(reconcileSolution(null, required)), message: 'The root solution tsconfig.json is missing.' };
  const value = withRenames(actual.value, renamed), drift = solutionDrift(value, required);
  if (!drift.solution) return { path, code: 'SOURCE_TSCONFIG_DRIFT', content: null,
    message: 'The root tsconfig.json is not a solution file (it has include or compilerOptions); convert it to references by hand.' };
  const next = reconcileSolution(value, required);
  if (isDeepStrictEqual(actual.value, next)) return null;
  return { path, code: 'SOURCE_TSCONFIG_DRIFT', content: json(next), message: `The root solution tsconfig.json references drift: ${driftDetail(drift)}.` };
}
async function importsChange(read: Read, manifest: SourceManifest): Promise<DerivedChange | null> {
  const aliases = importAliases(manifest), pkg = await read('package.json');
  if (pkg === 'invalid') return { path: 'package.json', code: 'SOURCE_IMPORTS_DRIFT', message: 'package.json is not valid JSON; repair it by hand.', content: null };
  if (!pkg) return Object.keys(aliases).length ? { path: 'package.json', code: 'SOURCE_IMPORTS_DRIFT', content: null,
    message: `package.json is missing; it must declare "imports" ${Object.keys(aliases).join(', ')}.` } : null;
  const current = record(pkg.value).imports, next = reconcileImports(current, aliases);
  if (isDeepStrictEqual(record(current), next)) return null;
  const document: Record<string, unknown> = { ...record(pkg.value) };
  if (Object.keys(next).length) document.imports = next; else delete document.imports;
  const expected = Object.entries(aliases).map(([key, value]) => `"${key}": "${value}"`).join(', ') || 'no #<project>/* aliases';
  return { path: 'package.json', code: 'SOURCE_IMPORTS_DRIFT', content: json(document), message: `package.json "imports" must hold exactly the library aliases: ${expected}.` };
}

/** Every derived file that differs from the manifest; folders that do not exist are reported separately (SOURCE_PATH_MISSING). */
export async function derivedChanges(root: string, manifest: SourceManifest, options: DerivedOptions = {}): Promise<DerivedChange[]> {
  const read = reader(root, options.overlay), overlay = [...options.overlay?.keys() ?? []];
  const present: Present = async folder => overlay.some(path => path.startsWith(`${folder}/`)) || await isDirectory(root, folder);
  const changes: Array<DerivedChange | null> = [], projects: SourceProject[] = [], tests: string[] = [];
  for (const project of manifest.projects) {
    if (!await present(project.path)) continue;
    projects.push(project);
    changes.push(await projectChange(read, project, manifest));
    changes.push(await testsChange(read, present, project, manifest));
    if (await present(`${project.path}/tests`)) tests.push(`${project.path}/tests`);
  }
  changes.push(await solutionChange(read, solutionRequirements({ ...manifest, projects }, tests), options.renamed));
  changes.push(await importsChange(read, manifest));
  return changes.filter((change): change is DerivedChange => change !== null);
}
/** Plan entries for the regenerable changes. */
export const derivedEntries = (changes: readonly DerivedChange[]) =>
  changes.filter(change => change.content !== null).map(change => ({ path: change.path, content: change.content }));
