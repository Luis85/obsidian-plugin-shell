import { option, type Arguments } from '../domain/command-options.ts';
import { requireSketch, SketchError } from '#shared/contracts/sketch-errors.ts';
import { collectionField } from '../domain/collection-definition.ts';
import { collectionCheck, collectionRow, filterCollection, sortCollection } from '../domain/collection-query.ts';
import { collectionOverdue, type CollectionRecord } from '../domain/collection-record.ts';
import { applyPrepared, type Prepared } from './storage.ts';
import { collectionReportPlan } from './collection-report.ts';
import { collectionCreatePlan, collectionUpdatePlan, openCollection, readCollection, type CollectionContext, type CollectionNote } from './collection-store.ts';
import type { CommandContext } from './commands.ts';
/** Actions that need a person; the command root runs them as the collection's wizards in a terminal. */
export const collectionInteractiveActions: readonly string[] = ['new', 'edit', 'review'];
const valid = (note: CollectionNote): note is CollectionNote & { record: CollectionRecord } => Boolean(note.record) && !note.issues.some(item => item.severity === 'error');
function noteId(args: Arguments, root: string): string {
  const id = option(args, 'id');
  requireSketch(id, 'COLLECTION_ID_REQUIRED', `Use ${root} ${args.action} --id <id>.`);
  return id;
}
/** --status and any choice field (for example --level high) filter; --overdue keeps open notes past their due date. */
function filters(args: Arguments, collection: CollectionContext): Record<string, string> {
  const { definition } = collection.loaded;
  return Object.fromEntries(Object.entries(args.flags).filter((entry): entry is [string, string] =>
    typeof entry[1] === 'string' && (entry[0] === 'status' || collectionField(definition, entry[0])?.kind === 'choice')));
}
async function list(args: Arguments, collection: CollectionContext): Promise<Record<string, unknown>> {
  const { definition } = collection.loaded, snapshot = await readCollection(collection);
  const readable = snapshot.notes.filter(valid), byRecord = new Map(readable.map(note => [note.record, note]));
  const records = sortCollection(definition, filterCollection(definition, readable.map(note => note.record), filters(args, collection), args.flags.overdue === true, collection.asOf));
  return { collection: definition.id, folder: collection.folder, asOf: collection.asOf, count: records.length,
    notes: records.map(record => collectionRow(definition, byRecord.get(record)!, collection.asOf)),
    needsAttention: snapshot.notes.filter(note => !valid(note)).map(note => ({ path: note.path, state: note.state, issues: note.issues })), ignored: snapshot.ignored };
}
async function show(args: Arguments, collection: CollectionContext, root: string): Promise<Record<string, unknown>> {
  const snapshot = await readCollection(collection), id = noteId(args, root).toLowerCase();
  const note = snapshot.notes.find(item => (item.record?.id || item.rawId || '').toLowerCase() === id);
  requireSketch(note, 'COLLECTION_NOT_FOUND', `No ${collection.loaded.definition.type} note with id ${option(args, 'id')} in ${collection.folder}.`);
  const record = note.record;
  return { collection: collection.loaded.definition.id, path: note.path, state: note.state, sha256: note.beforeHash, issues: note.issues,
    ...(record ? { id: record.id, noteStatus: record.status, title: record.title, values: record.values, overdue: collectionOverdue(collection.loaded.definition, record, collection.asOf) } : {}),
    content: note.content };
}
async function check(collection: CollectionContext): Promise<Record<string, unknown>> {
  const snapshot = await readCollection(collection), issues = collectionCheck(collection.loaded.definition, snapshot.notes, collection.asOf);
  const errors = issues.filter(item => item.severity === 'error').length;
  return { collection: collection.loaded.definition.id, folder: collection.folder, asOf: collection.asOf, notes: snapshot.notes.length, errors,
    warnings: issues.length - errors, issues, ignored: snapshot.ignored, status: errors ? 'failed' : 'ok' };
}
/**
 * One collection command root (for example `risk`): list, show, check and model read; new, update and report plan a
 * reviewed write that only `--apply <planHash>` performs. The folder always comes from user settings.
 */
interface Invocation { args: Arguments; collection: CollectionContext; context: CommandContext; input: () => Promise<unknown> }
const planned = async (call: Invocation, plan: Promise<Prepared>) => applyPrepared(await plan, option(call.args, 'apply') || undefined, call.context.signal);
/** Every non-interactive action of a collection command root; reads return data, writes return a plan or its applied result. */
const actions: Readonly<Record<string, (call: Invocation) => Promise<Record<string, unknown>> | Record<string, unknown>>> = {
  '': call => list(call.args, call.collection),
  list: call => list(call.args, call.collection),
  show: call => show(call.args, call.collection, call.args.command),
  check: call => check(call.collection),
  model: ({ collection }) => ({ collection: collection.loaded.definition.id, source: collection.loaded.source, file: collection.loaded.file, folder: collection.folder, definition: collection.loaded.definition }),
  new: async call => planned(call, collectionCreatePlan(call.collection, await call.input())),
  update: async call => planned(call, collectionUpdatePlan(call.collection, noteId(call.args, call.args.command), await call.input())),
  report: call => planned(call, collectionReportPlan(call.collection, call.args.flags.base === true)),
};
export async function collectionCommand(id: string, args: Arguments, context: CommandContext, input: () => Promise<unknown>): Promise<Record<string, unknown>> {
  const root = args.command, action = Object.hasOwn(actions, args.action) ? actions[args.action] : undefined;
  if (!action) {
    requireSketch(!collectionInteractiveActions.includes(args.action), 'COLLECTION_INTERACTIVE', `${root} ${args.action} runs in a terminal; agents use ${root} new|update --input <file.json> --json.`);
    throw new SketchError('COLLECTION_COMMAND', `Use ${root} list|show|check|model|new|update|report, or ${root} new|edit|review in a terminal.`);
  }
  return action({ args, context, input, collection: await openCollection(context.root, id, option(args, 'as-of') || undefined) });
}
