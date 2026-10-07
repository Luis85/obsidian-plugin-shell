/** Findings of `source check`: manifest, graph, project folders, derived files, cross-project imports and gate scopes. */
import { findCycle, unknownReferences, type SourceFinding, type SourceManifest, type SourceProject } from '../domain/source-projects.ts';
import { projectForPath, resolveSpecifier, type AliasPrefixes } from '../domain/source-imports.ts';
import { OperationError } from './framework/contracts.ts';
import { derivedChanges, type DerivedChange } from './source-derived.ts';
import { gateFindings } from './source-gates.ts';
import { isDirectory, listFiles, readSourceState, repositoryAliases, scanImports, sourceManifestFile } from './source-workspace.ts';

export interface CrossImport { from: string; to: string; file: string; line: number; specifier: string }
export interface SourceCheck { declared: boolean; manifest: SourceManifest | null; findings: SourceFinding[]; changes: DerivedChange[] }

/** Imports from `project` into other declared projects, resolved through the manifest aliases and package.json "imports". */
export async function crossImports(root: string, manifest: SourceManifest, project: SourceProject, aliases: AliasPrefixes): Promise<CrossImport[]> {
  const found: CrossImport[] = [];
  for (const { file, specifiers } of await scanImports(root, await listFiles(root, project.path))) {
    for (const { specifier, line } of specifiers) {
      const target = resolveSpecifier(file, specifier, aliases);
      const owner = target === null ? null : projectForPath(manifest.projects, target);
      if (owner && owner.name !== project.name) found.push({ from: project.name, to: owner.name, file, line, specifier });
    }
  }
  return found;
}
async function importFindings(root: string, manifest: SourceManifest): Promise<SourceFinding[]> {
  const aliases = await repositoryAliases(root, manifest), findings: SourceFinding[] = [];
  for (const project of manifest.projects) {
    if (!await isDirectory(root, project.path)) continue;
    const unreferenced = (await crossImports(root, manifest, project, aliases)).filter(item => !project.references.includes(item.to));
    for (const to of new Set(unreferenced.map(item => item.to))) {
      const sites = unreferenced.filter(item => item.to === to);
      const shown = sites.slice(0, 3).map(item => `${item.file}:${item.line} (${item.specifier})`).join(', ');
      findings.push({ code: 'SOURCE_UNREFERENCED_IMPORT', project: project.name, fix: 'source link', next: `source link ${project.name} ${to}`,
        message: `${project.name} imports ${to} without referencing it: ${shown}${sites.length > 3 ? ` and ${sites.length - 3} more` : ''}. Run source link ${project.name} ${to}, or remove the imports.` });
    }
  }
  return findings;
}
function graphFindings(manifest: SourceManifest): SourceFinding[] {
  const findings: SourceFinding[] = unknownReferences(manifest).map(({ project, reference }) => ({ code: 'SOURCE_UNKNOWN_REFERENCE', project, fix: 'manual',
    message: `${project} references "${reference}", which is not a declared project; declare it or remove the reference from ${sourceManifestFile}.` }));
  const cycle = findCycle(manifest);
  if (cycle) findings.push({ code: 'SOURCE_CYCLE', project: cycle[0], fix: 'manual', message: `Source projects form a cycle: ${cycle.join(' -> ')}. Remove one reference with source unlink.` });
  return findings;
}
async function pathFindings(root: string, manifest: SourceManifest): Promise<SourceFinding[]> {
  const findings: SourceFinding[] = [];
  for (const project of manifest.projects) if (!await isDirectory(root, project.path))
    findings.push({ code: 'SOURCE_PATH_MISSING', project: project.name, fix: 'manual', message: `${project.path} does not exist; restore it, or remove the project with source remove ${project.name}.` });
  return findings;
}
const changeFinding = (change: DerivedChange): SourceFinding => ({ code: change.code, ...(change.project ? { project: change.project } : {}),
  message: change.message, fix: change.content === null ? 'manual' : 'check --fix' });

/** Every finding; without a manifest only SOURCE_MANIFEST_MISSING (the derived checks need a declared manifest). */
export async function sourceCheck(root: string): Promise<SourceCheck> {
  let state;
  try { state = await readSourceState(root); }
  catch (error) {
    if (error instanceof OperationError && error.code === 'SOURCE_MANIFEST_INVALID')
      return { declared: true, manifest: null, changes: [], findings: [{ code: 'SOURCE_MANIFEST_INVALID', fix: 'manual', message: error.message }] };
    throw error;
  }
  if (!state.declared) {
    const implicit = state.manifest.projects[0];
    return { declared: false, manifest: state.manifest, changes: [], findings: [{ code: 'SOURCE_MANIFEST_MISSING', fix: implicit ? 'check --fix' : 'manual',
      message: implicit ? `${sourceManifestFile} is missing; source check --fix writes it for the implicit ${implicit.kind} project at ${implicit.path} without moving files.`
        : `${sourceManifestFile} is missing and neither src/plugin nor src/main.ts exists; create a project with source add <name> --kind <kind>.` }] };
  }
  const manifest = state.manifest, graph = graphFindings(manifest);
  const findings = [...graph, ...await pathFindings(root, manifest)];
  const changes = graph.length ? [] : await derivedChanges(root, manifest);
  findings.push(...changes.map(changeFinding), ...await importFindings(root, manifest), ...await gateFindings(root, manifest));
  return { declared: true, manifest, findings, changes };
}
