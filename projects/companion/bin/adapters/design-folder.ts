/** Plans, syncs and inspects per-prototype Claude Design folders through the shared guarded file writer. */
import { join } from 'node:path';
import { opendir } from 'node:fs/promises';
import { createFilePlan } from '../../scripts/shared/file-plan.ts';
import { parseJsonData } from '../../scripts/contracts/json-data.ts';
import { exists, hash } from './framework/files.ts';
import { prepared, type Prepared } from './storage.ts';
import { guardedText, jsonText, loadSettings } from './user-settings.ts';
import { currentSource, currentSourceHash, designTarget, designTemplates, designTokens, readBrief, readBriefFile, resolveDesignSource } from './design-source.ts';
import { engineeringFacts } from './design-facts.ts';
import { renderDesignFolder } from '../application/design-folder.ts';
import { designRoot } from '../domain/user-settings.ts';
import { designFolderName, designManifestFile, designerOwned, isDesignSlug, keptBrief, readDesignManifest, type DesignBrief, type DesignManifest } from '../domain/design-folder.ts';
import { requireSketch } from '../domain/errors.ts';
export interface DesignFolderOptions {
  root: string; frameworkRoot: string; name: string; mode: 'prepare' | 'sync';
  /** Project model path; overrides a managed prototype or a synced folder's source. */
  project?: string;
  /** A prepared prototype package whose design-brief.md becomes the folder's brief. */
  package?: string;
  /** A prepared brief file outside the root; its text is kept as notes/prototype-brief.md so sync can reread it. */
  briefFile?: string; title?: string; signal?: AbortSignal;
  /** An explicit project configuration path when configs/ holds several. */
  config?: string;
}
/** Settings validation already rejects a design root, configured or default, that overlaps another configured path. */
async function configuredRoot(root: string) {
  const { settings } = await loadSettings(root);
  return { base: designRoot(settings.paths), project: settings.paths.project };
}
async function readManifest(root: string, folder: string): Promise<{ manifest: DesignManifest | null; beforeHash: string | null }> {
  const read = await guardedText(root, `${folder}/${designManifestFile}`);
  return { manifest: read.content === null ? null : readDesignManifest(parseJsonData(read.content)), beforeHash: read.beforeHash };
}
const conflictHelp = 'Move the edits into notes/ or prototypes/, or delete the file to regenerate it. Nothing was written.';
function briefSource(options: DesignFolderOptions, previous: DesignManifest | null): DesignBrief | null {
  if (options.package) return { scope: 'root', path: `${options.package}/design-brief.md` };
  return options.briefFile !== undefined ? keptBrief : previous?.brief ?? null;
}
const briefPath = (folder: string, brief: DesignBrief) => brief.scope === 'folder' ? `${folder}/${brief.path}` : brief.path;
/** A package brief is reread from the root; a brief file from outside the root is kept inside the folder. A recorded brief that is gone fails closed, like a missing source. */
async function briefFor(options: DesignFolderOptions, folder: string, previous: DesignManifest | null): Promise<{ source: DesignBrief | null; text: string | null }> {
  const source = briefSource(options, previous);
  if (!source) return { source, text: null };
  const text = await readBrief(options.root, briefPath(folder, source)) ?? (source.scope === 'folder' && options.briefFile !== undefined ? await readBriefFile(options.briefFile) : null);
  requireSketch(text !== null, 'DESIGN_BRIEF_MISSING', options.package ? `No design-brief.md in ${options.package}.`
    : `The design brief ${briefPath(folder, source)} is missing. Restore it, or prepare again with --package <prepared folder>. Nothing was written.`);
  return { source, text };
}
type Entries = { path: string; content: string }[];
/** A brief kept inside the folder is seeded once, like the other design-owned files. */
function withKeptBrief(seeded: Entries, brief: { source: DesignBrief | null; text: string | null }): Entries {
  return brief.source?.scope === 'folder' && brief.text !== null ? [...seeded, { path: keptBrief.path, content: brief.text }] : seeded;
}
/** A generated path may be written while absent, identical, or still holding the bytes this tool recorded. */
function assertOwned(folder: string, managed: Entries, before: Map<string, string | null>, previous: DesignManifest | null): void {
  const owned = new Map((previous?.managed ?? []).map(file => [file.path, file.sha256]));
  const edited = managed.filter(entry => {
    const current = before.get(`${folder}/${entry.path}`) ?? null;
    return current !== null && current !== hash(entry.content) && current !== owned.get(entry.path);
  }).map(entry => entry.path);
  requireSketch(!edited.length, 'DESIGN_FILE_CONFLICT', `Generated files in ${folder} were edited or are not owned by this tool: ${edited.join(', ')}. ${conflictHelp}`);
}
/** Generated files are rewritten only while they still hold what this tool wrote; design-owned files are created once. */
export async function designFolderPlan(options: DesignFolderOptions): Promise<Prepared> {
  const { root } = options, name = designFolderName(options.name);
  const { base, project } = await configuredRoot(root), folder = `${base}/${name}`;
  const previous = await readManifest(root, folder);
  requireSketch(options.mode === 'prepare' || previous.manifest, 'DESIGN_FOLDER_MISSING', `No prepared design folder at ${folder}. Run node bin/app design prepare --name ${name} first.`);
  requireSketch(!previous.manifest || previous.manifest.name === name, 'DESIGN_MANIFEST', 'The manifest names another design folder. It has not been changed.');
  const request = { ...options, name, configuredProject: project, previous: previous.manifest };
  const resolved = await resolveDesignSource(request), brief = await briefFor(options, folder, previous.manifest);
  const title = options.title ?? previous.manifest?.title ?? resolved.title, target = await designTarget(root, options.config);
  const facts = await engineeringFacts(root, resolved.document.settings);
  const { managed, seeded: rendered } = renderDesignFolder({ name, title, folder, sourcePath: resolved.source.path, document: resolved.document, brief: brief.text,
    target, tokens: await designTokens(root, options.frameworkRoot), templates: await designTemplates(), facts });
  const seeded = withKeptBrief(rendered, brief);
  const at = (path: string) => `${folder}/${path}`;
  const inspected = await createFilePlan(root, [...managed, ...seeded].map(entry => ({ path: at(entry.path), content: null })));
  const before = new Map(inspected.changes.map(change => [change.path, change.beforeHash]));
  assertOwned(folder, managed, before, previous.manifest);
  const created = seeded.filter(entry => before.get(at(entry.path)) === null);
  // The writer validates with the reader, so status, sync and prepare can always read back what was written.
  const manifest = readDesignManifest({ kind: 'workbench-design-folder', schemaVersion: 1, name, title, folder,
    project: { id: resolved.document.project.id, name: resolved.document.project.name }, source: resolved.source, brief: brief.source,
    targets: target.targets, framework: target.framework, managed: managed.map(entry => ({ path: entry.path, sha256: hash(entry.content) })), designerOwned: [...designerOwned], facts: facts.fingerprint });
  const plan = await createFilePlan(root, [...managed, ...created, { path: designManifestFile, content: jsonText(manifest) }].map(entry => ({ path: at(entry.path), content: entry.content })));
  requireSketch(plan.changes.every(change => change.beforeHash === (change.path === at(designManifestFile) ? previous.beforeHash : before.get(change.path))),
    'MAKER_STALE', 'The design folder changed while planning. Review it again.');
  const retired = (previous.manifest?.managed ?? []).map(file => file.path).filter(path => !managed.some(entry => entry.path === path));
  return { ...prepared(plan, { folder, name, title, source: resolved.source, seeded: created.map(entry => entry.path), retired,
    designerOwned, next: `Import ${folder} into Claude Design. Sync later with node bin/app design sync --name ${name}.` }, { kind: 'design-folder', folder, source: resolved.source }),
  validate: async () => {
    requireSketch((await currentSourceHash(request))?.sha256 === resolved.source.sha256, 'MAKER_STALE', 'The prototype source changed after review. Plan the design folder again.');
  } };
}
async function folderFiles(directory: string, prefix: string, limit = 400): Promise<string[]> {
  if (!await exists(directory)) return [];
  const found: string[] = [];
  for await (const entry of await opendir(directory)) {
    requireSketch(found.length < limit, 'DESIGN_LIMIT', `More than ${limit} files in ${prefix}.`);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) found.push(...await folderFiles(join(directory, entry.name), `${prefix}${entry.name}/`, limit - found.length));
    else if (entry.isFile()) found.push(prefix + entry.name);
  }
  return found.sort();
}
/** Implementation-map rows: `| Screen | `id` | status | ...`; a screen title may hold an escaped `\|`. Counts only; the table belongs to the design work. */
function mapStatuses(markdown: string | null): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const line of (markdown ?? '').split('\n')) {
    const status = /^\|(?:[^|\\]|\\.)*\|\s*`[^`]+`\s*\|\s*([a-z-]+)\s*\|/.exec(line)?.[1];
    if (status) counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}
type Current = Awaited<ReturnType<typeof currentSource>>;
/** The engineering guide is stale once any project file it cites changes, even when the design source did not. */
async function freshness(root: string, folder: string, manifest: DesignManifest, current: Current) {
  if (!current) return { state: 'source-missing' as const, facts: 'changed' as const };
  const facts = (await engineeringFacts(root, current.document.settings)).fingerprint === manifest.facts ? 'current' as const : 'changed' as const;
  const moved = current.source.sha256 !== manifest.source.sha256 || current.source.path !== manifest.source.path || manifest.folder !== folder;
  return { state: moved || facts === 'changed' ? 'stale' as const : 'current' as const, facts };
}
async function folderStatus(root: string, frameworkRoot: string, base: string, project: string, name: string) {
  const folder = `${base}/${name}`, { manifest } = await readManifest(root, folder);
  if (!manifest) return { name, folder, state: 'unmanaged' as const };
  const inspected = await createFilePlan(root, manifest.managed.map(file => ({ path: `${folder}/${file.path}`, content: null })));
  const edited = manifest.managed.filter((file, index) => inspected.changes[index]!.beforeHash !== file.sha256).map(file => file.path);
  const current = await currentSource({ root, frameworkRoot, name, configuredProject: project, previous: manifest });
  const prototypes = (await folderFiles(join(root, folder, 'prototypes'), 'prototypes/')).filter(path => path !== 'prototypes/README.md');
  const { state, facts } = await freshness(root, folder, manifest, current);
  const brief = manifest.brief && { ...manifest.brief, missing: !await exists(join(root, briefPath(folder, manifest.brief))) };
  return { name, folder, state, title: manifest.title,
    source: manifest.source, brief, facts, edited, prototypes, implementation: mapStatuses((await guardedText(root, `${folder}/handoff/implementation-map.md`)).content) };
}
/** Read-only: every folder under the design root, or one named folder. */
export async function designFolderStatus(root: string, frameworkRoot: string, name?: string) {
  const { base, project } = await configuredRoot(root);
  const names = name ? [designFolderName(name)] : (await exists(join(root, base))) ? await folderNames(join(root, base)) : [];
  const folders = [];
  for (const item of names) folders.push(await folderStatus(root, frameworkRoot, base, project, item));
  return { root: base, folders, next: folders.some(item => item.state === 'stale') ? 'Run node bin/app design sync --name <name> for stale folders.' : undefined };
}
async function folderNames(directory: string): Promise<string[]> {
  const names: string[] = [];
  for await (const entry of await opendir(directory)) {
    requireSketch(names.length < 200, 'DESIGN_LIMIT', 'More than 200 entries in the design root.');
    if (entry.isDirectory() && isDesignSlug(entry.name)) names.push(entry.name);
  }
  return names.sort();
}
/** Prepared design folders (those holding a manifest) under a design root; shared files beside them are not design folders. */
export async function preparedDesignFolders(root: string, base: string): Promise<string[]> {
  const names = await exists(join(root, base)) ? await folderNames(join(root, base)) : [];
  const prepared: string[] = [];
  for (const name of names) if (await exists(join(root, base, name, designManifestFile))) prepared.push(`${base}/${name}`);
  return prepared;
}
