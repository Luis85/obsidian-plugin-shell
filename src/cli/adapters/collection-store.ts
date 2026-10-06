import { createFilePlan } from '#shared/platform/file-plan.ts';
import { requireSketch, SketchError, slug } from '#shared/contracts/sketch-errors.ts';
import { collectionRoot } from '../domain/user-settings.ts';
import { collectionCreate, collectionUpdate, isCollectionDate, nextCollectionId, readCollectionRecord } from '../domain/collection-record.ts';
import type { CollectionEntry } from '../domain/collection-query.ts';
import { hash } from './framework/files.ts';
import { prepared, type Prepared } from './storage.ts';
import { loadSettings } from './user-settings.ts';
import { loadCollection, type LoadedCollection } from './collection-catalog.ts';
import { parseCollectionNote, patchCollectionNote, renderCollectionNote, scanCollectionFolder, type CollectionFile } from './collection-notes.ts';
/** One collection opened against a project: its definition and hook, the configured folder and the reference date. */
export interface CollectionContext { root: string; loaded: LoadedCollection; folder: string; asOf: string }
/** `note`: a note of this type (possibly with issues); `future`: a newer schema, read-only; `unreadable`: not parseable. */
export interface CollectionNote extends CollectionEntry { state: 'note' | 'future' | 'unreadable'; beforeHash: string; content: string | null; rawId?: string }
export interface CollectionSnapshot { notes: CollectionNote[]; ignored: string[]; inventory: string; texts: string[] }
/** Today as YYYY-MM-DD in local time, or an explicit reference date (`--as-of`) for reproducible plans and reports. */
export function collectionDate(value?: string): string {
  if (value === undefined || value === '') {
    const now = new Date();
    return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part, index) => String(part).padStart(index ? 2 : 4, '0')).join('-');
  }
  requireSketch(isCollectionDate(value), 'COLLECTION_DATE', '--as-of must be a date written as YYYY-MM-DD.');
  return value;
}
export async function openCollection(root: string, id: string, asOf?: string): Promise<CollectionContext> {
  const loaded = await loadCollection(root, id), settings = (await loadSettings(root)).settings;
  return { root, loaded, folder: collectionRoot(settings.paths, loaded.definition.pathKey), asOf: collectionDate(asOf) };
}
const unreadable = (file: CollectionFile, message: string): CollectionNote =>
  ({ path: file.path, state: 'unreadable', beforeHash: file.beforeHash, content: file.content, issues: [{ severity: 'error', code: 'COLLECTION_NOTE_UNREADABLE', message: `${message}; the file is preserved.` }] });
function noteOf(context: CollectionContext, file: CollectionFile): CollectionNote | null {
  if (file.content === null) return unreadable(file, file.problem ?? 'unreadable');
  let parts: ReturnType<typeof parseCollectionNote>;
  try { parts = parseCollectionNote(file.content); }
  catch (error) { if (!(error instanceof SketchError)) throw error; return unreadable(file, error.message); }
  if (!parts) return null;
  const reading = readCollectionRecord(context.loaded.definition, context.loaded.hook, parts.properties);
  if (reading.kind === 'ignored') return null;
  const rawId = typeof parts.properties.id === 'string' ? parts.properties.id : undefined;
  const base = { path: file.path, beforeHash: file.beforeHash, content: file.content, issues: reading.issues, ...(rawId ? { rawId } : {}) };
  return reading.kind === 'future' ? { ...base, state: 'future' } : { ...base, state: 'note', record: reading.record };
}
/** Every note of the collection's type in its folder. Other Markdown is ignored; malformed and future notes are reported, never changed. */
export async function readCollection(context: CollectionContext): Promise<CollectionSnapshot> {
  const files = await scanCollectionFolder(context.root, context.folder), notes: CollectionNote[] = [], ignored: string[] = [];
  const register = `${context.folder}/${context.loaded.definition.report.file}`;
  const texts: string[] = [];
  for (const file of files) {
    const note = noteOf(context, file);
    texts.push(file.path, ...(note?.rawId ? [note.rawId] : []), ...(file.path === register || note?.state === 'unreadable' ? [file.content ?? ''] : []));
    if (note) notes.push(note); else ignored.push(file.path);
  }
  return { notes, ignored, texts, inventory: hash(JSON.stringify(files.map(file => [file.path, file.beforeHash]))) };
}
/** The writable note with this id; unreadable, future or invalid notes are refused, never repaired silently. */
export function collectionNote(snapshot: CollectionSnapshot, context: CollectionContext, id: string): CollectionNote & { record: NonNullable<CollectionNote['record']> } {
  const wanted = id.toLowerCase(), matches = snapshot.notes.filter(note => (note.record?.id || note.rawId || '').toLowerCase() === wanted);
  requireSketch(matches.length, 'COLLECTION_NOT_FOUND', `No ${context.loaded.definition.type} note with id ${id} in ${context.folder}.`);
  requireSketch(matches.length === 1, 'COLLECTION_DUPLICATE_ID', `${id} is used by ${matches.map(note => note.path).join(' and ')}; give one note another id first.`);
  const note = matches[0]!, errors = note.issues.filter(item => item.severity === 'error');
  requireSketch(note.state === 'note' && note.record && !errors.length, 'COLLECTION_NOTE_INVALID', `${note.path} cannot be changed until it is valid: ${errors.map(item => item.message).join(' ')}`);
  return { ...note, record: note.record };
}
function guard(context: CollectionContext, inventory: string): () => Promise<void> {
  return async () => {
    requireSketch((await readCollection(context)).inventory === inventory, 'MAKER_STALE', `${context.folder} changed after review; plan again.`);
  };
}
/** A new note with the next free id, as one reviewed plan that refuses to replace any file. */
export async function collectionCreatePlan(context: CollectionContext, input: unknown): Promise<Prepared> {
  const { definition, hook } = context.loaded, snapshot = await readCollection(context);
  const id = nextCollectionId(definition, snapshot.texts);
  const { frontmatter, body } = collectionCreate(definition, hook, input, id, context.asOf);
  const path = `${context.folder}/${id}-${slug(String(frontmatter[definition.titleField]), definition.id)}.md`;
  const content = renderCollectionNote(path, frontmatter, body);
  const plan = await createFilePlan(context.root, [{ path, content }]);
  requireSketch(plan.changes[0]!.status === 'create', 'COLLECTION_CONFLICT', `${path} already exists; nothing was overwritten.`);
  const identity = { kind: 'collection-create', collection: definition.id, id, path, asOf: context.asOf, inventory: snapshot.inventory };
  return { ...prepared(plan, { collection: definition.id, id, path, frontmatter, content }, identity), validate: guard(context, snapshot.inventory) };
}
/** Changed fields of one valid note, patched in place behind the hash of the bytes that were read. */
export async function collectionUpdatePlan(context: CollectionContext, id: string, input: unknown, review = false): Promise<Prepared> {
  const { definition, hook } = context.loaded, snapshot = await readCollection(context), note = collectionNote(snapshot, context, id);
  const change = collectionUpdate(definition, hook, note.record, input, context.asOf, review);
  const content = patchCollectionNote(note.content!, change.values, change.removed);
  const plan = await createFilePlan(context.root, [{ path: note.path, content }]);
  requireSketch(plan.changes[0]!.beforeHash === note.beforeHash, 'MAKER_STALE', `${note.path} changed while planning; nothing was overwritten.`);
  const identity = { kind: 'collection-update', collection: definition.id, id: note.record.id, path: note.path, asOf: context.asOf };
  return prepared(plan, { collection: definition.id, id: note.record.id, path: note.path, noteStatus: change.status, removed: change.removed, content }, identity);
}
