import { validateDocumentationSettings } from './settings-documentation.ts';
import { createFilePlan } from '../../scripts/shared/file-plan.mjs';
import { parseJsonData } from '../../scripts/contracts/json-data.ts';
import { hash } from '../../scripts/framework/files.ts';
import { object, list } from '../domain/data.ts';
import { documentText, openDocument } from '../domain/document.ts';
import { readSettings, settingsPath, setupStatePath, type UserSettings } from '../domain/user-settings.ts';
import { requireSketch } from '../domain/errors.ts';
import { prepared } from './storage.ts';
import { guardedText, jsonText, loadSettings } from './user-settings.ts';
import { migrationFiles, type MigrationFile } from './migration-files.ts';
const folderPaths = new Set(['prds', 'app', 'prototypes']);
interface Move { key: string; from: string; to: string; folder: boolean }
function movesFor(before: UserSettings, after: UserSettings): Move[] {
  return Object.entries(before.paths).flatMap(([key, from]) => {
    const to = after.paths[key as keyof UserSettings['paths']];
    return from === to ? [] : [{ key, from, to, folder: folderPaths.has(key) }];
  });
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
  for (const move of moves) for (const old of Object.values(before.paths)) {
    const a = move.to.toLowerCase(), b = old.toLowerCase();
    requireSketch(a !== b && !a.startsWith(b + '/') && !b.startsWith(a + '/'), 'MIGRATION_OVERLAP', 'Migration destinations must be outside every existing configured location.');
  }

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
  const state = await guardedText(root, setupStatePath);
  const current = await collect(root, moves), snapshotHash = identity(current.files);
  const project = await guardedText(root, loaded.settings.paths.project);
  const entries = current.files.map(file => ({ path: remap(file.path, moves), content: file.bytes.toString('base64'), encoding: 'base64' as const }));
  const destinations = await createFilePlan(root, entries);
  requireSketch(destinations.changes.every(change => change.beforeHash === null), 'MIGRATION_CONFLICT', 'Migration destination already contains a file; nothing was overwritten.');
  const edits: { path: string; content: string | null; encoding?: 'base64' }[] = [...entries];
  if (project.content !== null) {
    const path = settings.paths.project;
    const index = edits.findIndex(entry => entry.path === path);
    const entry = { path, content: remapDocument(Buffer.from(project.content), moves) };
    if (index < 0) edits.push(entry); else edits[index] = entry;
  }
  const metadata = migrateState(state.content, moves, settings);
  if (metadata !== null) edits.push({ path: setupStatePath, content: metadata });
  edits.push({ path: settingsPath, content: jsonText(settings) });
  edits.push(...current.files.map(file => ({ path: file.path, content: null })));
  const plan = await createFilePlan(root, edits);
  verifySources(plan, current.files, destinations, loaded.beforeHash);
  const checked = prepared(plan, { settings, moves, retained: current.retained, next: 'Reinstall dependencies and rebuild the relocated application. Empty original directories and excluded build/dependency outputs are retained. Review any hand-written links to old locations.' }, { snapshotHash });
  return { ...checked, validate: async () => {
    requireSketch(identity((await collect(root, moves)).files) === snapshotHash, 'MAKER_STALE', 'Migration inventory changed after review.');
    requireSketch((await guardedText(root, setupStatePath)).beforeHash === state.beforeHash, 'MAKER_STALE', 'Setup state changed after migration review.');
    requireSketch((await guardedText(root, loaded.settings.paths.project)).beforeHash === project.beforeHash, 'MAKER_STALE', 'Project changed after migration review.');
  } };
}
