import { validateDocumentationSettings } from './settings-documentation.ts';
import { createFilePlan } from '../../scripts/shared/file-plan.ts';
import { parseJsonData } from '../../scripts/contracts/json-data.ts';
import { hash } from './framework/files.ts';
import { object, list } from '../domain/data.ts';
import { documentText, openDocument } from '../domain/document.ts';
import { collectionPathKeys, designRoot, effectivePaths, pathsOverlap, readSettings, settingsPath, setupStatePath, type UserSettings } from '../domain/user-settings.ts';
import { designManifestFile, readDesignManifest } from '../domain/design-folder.ts';
import { requireSketch } from '../domain/errors.ts';
import { prepared } from './storage.ts';
import { guardedText, jsonText, loadSettings } from './user-settings.ts';
import { migrationFiles, type MigrationFile } from './migration-files.ts';
import { preparedDesignFolders } from './design-folder.ts';
const folderPaths = new Set<string>(['prds', 'app', 'prototypes', 'design', ...collectionPathKeys]);
interface Move { key: string; from: string; to: string; folder: boolean }
/** The optional design root compares by its effective value, so configuring it for the first time relocates the default root. */
function movesFor(before: UserSettings, after: UserSettings): Move[] {
  const target = effectivePaths(after.paths);
  return Object.entries(effectivePaths(before.paths)).flatMap(([key, from]) => {
    const to = target[key as keyof typeof target];
    return from === to ? [] : [{ key, from, to, folder: folderPaths.has(key) }];
  });
}
/** A design root is shared (the default one holds the token inventory), so only its prepared design folders move. */
async function contentMoves(root: string, moves: Move[]): Promise<Move[]> {
  const expanded = await Promise.all(moves.map(async move => move.key !== 'design' ? [move]
    : (await preparedDesignFolders(root, move.from)).map(path => ({ ...move, from: path, to: move.to + path.slice(move.from.length) }))));
  return expanded.flat();
}
function remap(path: string, moves: Move[]): string {
  for (const move of moves) {
    if (path === move.from) return move.to;
    if (move.folder && path.startsWith(move.from + '/')) return move.to + path.slice(move.from.length);
  }
  return path;
}
function remapDocument(bytes: Buffer, moves: Move[]): string {
  const doc = openDocument(parseJsonData(bytes.toString('utf8')));
  for (const raw of list(doc.design.prds, 'prds', 12)) {
    const prd = object(raw);
    if (prd.source === undefined) continue;
    const source = object(prd.source);
    if (typeof source.path === 'string') source.path = remap(source.path, moves);
  }
  return documentText(doc);
}
function identity(files: MigrationFile[]): string {
  return hash(jsonText(files.map(file => ({ path: file.path, sha256: file.sha256 }))));
}
async function collect(root: string, moves: Move[]) {
  const scans = await Promise.all(moves.map(move => migrationFiles(root, move.from, move.folder)));
  return { files: scans.flatMap(scan => scan.files), retained: scans.flatMap(scan => scan.retained) };
}
function verifyDestinations(moves: Move[], before: UserSettings): void {
  for (const move of moves) for (const old of Object.values(effectivePaths(before.paths)))
    requireSketch(!pathsOverlap(move.to, old), 'MIGRATION_OVERLAP', 'Migration destinations must be outside every existing configured location.');
}
/** A design manifest names its project source and package brief by root-relative path; moved paths are rewritten, nothing else. */
function remapManifest(content: string, moves: Move[]): string | null {
  const raw = object(parseJsonData(content)), manifest = readDesignManifest(raw);
  const source = manifest.source.kind === 'project' ? remap(manifest.source.path, moves) : manifest.source.path;
  const brief = manifest.brief?.scope === 'root' ? remap(manifest.brief.path, moves) : manifest.brief?.path;
  if (source === manifest.source.path && brief === manifest.brief?.path) return null;
  object(raw.source).path = source;
  if (raw.brief !== null) object(raw.brief).path = brief;
  return jsonText(raw);
}
interface Edit { path: string; content: string | null; encoding?: 'base64' }
/** Manifests that move are rewritten from their inventoried bytes; manifests that stay are hash-guarded like every other source. */
async function manifestEdits(root: string, base: string, moves: Move[], files: MigrationFile[]) {
  const edits: Edit[] = [], guards: { path: string; beforeHash: string | null }[] = [];
  for (const folder of await preparedDesignFolders(root, base)) {
    const path = `${folder}/${designManifestFile}`, moved = files.find(file => file.path === path);
    const read = moved ? { content: moved.bytes.toString('utf8'), beforeHash: moved.sha256 } : await guardedText(root, path);
    const content = read.content === null ? null : remapManifest(read.content, moves);
    if (content === null) continue;
    edits.push({ path: remap(path, moves), content });
    if (!moved) guards.push({ path, beforeHash: read.beforeHash });
  }
  return { edits, guards };
}
function upsert(edits: Edit[], entry: Edit): void {
  const index = edits.findIndex(item => item.path === entry.path);
  if (index < 0) edits.push(entry); else edits[index] = entry;
}
function migrateState(content: string | null, moves: Move[], settings: UserSettings): string | null {
  if (content === null) return null;
  const metadata = object(parseJsonData(content));
  requireSketch(metadata.schemaVersion === 1, 'MIGRATION_STATE', 'Unsupported setup state; preserve it.');
  metadata.paths = settings.paths;
  if (Array.isArray(metadata.prds)) for (const raw of metadata.prds) {
    const prd = object(raw); if (typeof prd.path === 'string') prd.path = remap(prd.path, moves);
  }
  return jsonText(metadata);
}
function verifySources(plan: Awaited<ReturnType<typeof createFilePlan>>, files: MigrationFile[], destinations: typeof plan, settingsHash: string | null): void {
  for (const file of files) requireSketch(plan.changes.find(change => change.path === file.path)?.beforeHash === file.sha256, 'MAKER_STALE', 'Migration source changed while planning.');
  for (const change of destinations.changes) requireSketch(plan.changes.find(item => item.path === change.path)?.beforeHash === null, 'MAKER_STALE', 'Migration destination changed while planning.');
  requireSketch(plan.changes.find(change => change.path === settingsPath)?.beforeHash === settingsHash, 'MAKER_STALE', 'Settings changed while planning migration.');

}
/** Explicit migration is a reviewed file transaction, never a settings-only path rewrite. */
export async function settingsMigrationPlan(root: string, input: unknown) {
  const loaded = await loadSettings(root), settings = readSettings(input, loaded.settings);
  validateDocumentationSettings(settings);
  const moves = movesFor(loaded.settings, settings);
  requireSketch(moves.length, 'MIGRATION_EMPTY', 'No configured paths changed; use settings for preference updates.');
  verifyDestinations(moves, loaded.settings);
  const state = await guardedText(root, setupStatePath), contents = await contentMoves(root, moves);
  const current = await collect(root, contents), snapshotHash = identity(current.files);
  const project = await guardedText(root, loaded.settings.paths.project);
  const entries = current.files.map(file => ({ path: remap(file.path, contents), content: file.bytes.toString('base64'), encoding: 'base64' as const }));
  const destinations = await createFilePlan(root, entries);
  requireSketch(destinations.changes.every(change => change.beforeHash === null), 'MIGRATION_CONFLICT', 'Migration destination already contains a file; nothing was overwritten.');
  const edits: Edit[] = [...entries];
  if (project.content !== null) upsert(edits, { path: settings.paths.project, content: remapDocument(Buffer.from(project.content), contents) });
  const manifests = await manifestEdits(root, designRoot(loaded.settings.paths), contents, current.files);
  for (const entry of manifests.edits) upsert(edits, entry);
  const metadata = migrateState(state.content, contents, settings);
  if (metadata !== null) edits.push({ path: setupStatePath, content: metadata });
  edits.push({ path: settingsPath, content: jsonText(settings) });
  edits.push(...current.files.map(file => ({ path: file.path, content: null })));
  const plan = await createFilePlan(root, edits);
  verifySources(plan, current.files, destinations, loaded.beforeHash);
  requireSketch(manifests.guards.every(guard => plan.changes.find(change => change.path === guard.path)?.beforeHash === guard.beforeHash), 'MAKER_STALE', 'A design manifest changed while planning migration.');
  const checked = prepared(plan, { settings, moves, retained: current.retained, next: 'Reinstall dependencies and rebuild the relocated application. Empty original directories and excluded build/dependency outputs are retained. Review any hand-written links to old locations.' + (manifests.edits.length ? ' Then run node bin/app design sync for each design folder whose source or brief moved.' : '') }, { snapshotHash });
  return { ...checked, validate: async () => {
    requireSketch(identity((await collect(root, await contentMoves(root, moves))).files) === snapshotHash, 'MAKER_STALE', 'Migration inventory changed after review.');
    for (const guard of manifests.guards)
      requireSketch((await guardedText(root, guard.path)).beforeHash === guard.beforeHash, 'MAKER_STALE', 'A design manifest changed after migration review.');
    requireSketch((await guardedText(root, setupStatePath)).beforeHash === state.beforeHash, 'MAKER_STALE', 'Setup state changed after migration review.');
    requireSketch((await guardedText(root, loaded.settings.paths.project)).beforeHash === project.beforeHash, 'MAKER_STALE', 'Project changed after migration review.');
  } };
}
