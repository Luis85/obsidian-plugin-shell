import { requireSketch } from '#shared/contracts/sketch-errors.ts';
import type { FormChoice, FormField } from '../../domain/form.ts';
import type { FormValues } from '../../domain/form-model.ts';
import type { CollectionDefinition } from '../../domain/collection-definition.ts';
import { collectionReviewQueue } from '../../domain/collection-query.ts';
import type { CollectionRecord } from '../../domain/collection-record.ts';
import { collectionCreatePlan, collectionNote, collectionUpdatePlan, openCollection, readCollection, type CollectionContext } from '../../adapters/collection-store.ts';
import type { Prepared } from '../../adapters/storage.ts';
import { formDefinition, runForm } from '../form-runner.ts';
import { Back, reportError } from '#tui/prompts.ts';
import { review } from '../review.ts';
import type { ActionContext } from '../wizard-runner.ts';
import type { WizardModule } from './module.ts';
interface Data { definition: CollectionDefinition; record?: CollectionRecord; notes?: Array<{ id: string; title: string; status: string }> }
const dataOf = (data: unknown) => data as Data;
const flagOf = (options: ActionContext['options'], name: string) => {
  const value = (options.flags as FormValues | undefined)?.[name];
  return typeof value === 'string' ? value : undefined;
};
const open = (state: FormValues, root: string) => openCollection(root, String(state.collection), String(state.asOf));
/** Form values are strings (select ids); integers become numbers again and only fields that differ from the note are sent. */
function draftOf(definition: CollectionDefinition, record?: CollectionRecord): FormValues {
  const draft: FormValues = { status: record?.status ?? definition.initialStatus };
  for (const field of definition.fields.filter(item => item.source === 'input' && (!record || item.frontmatter))) {
    const value = record?.values[field.key];
    draft[field.input] = value === undefined ? (field.kind === 'list' ? [] : '') : Array.isArray(value) ? [...value] : String(value);
  }
  if (record) draft.id = record.id;
  return draft;
}
const typed = (definition: CollectionDefinition, key: string, value: unknown) =>
  definition.fields.some(item => item.input === key && item.kind === 'integer') && typeof value === 'string' && value !== '' ? Number(value) : value;
function inputOf(definition: CollectionDefinition, draft: FormValues, record?: CollectionRecord): FormValues {
  const before: FormValues = record ? draftOf(definition, record) : {};
  const sent = Object.entries(draft).filter(([key, value]) => !['id', 'decision'].includes(key) && !(record && JSON.stringify(value) === JSON.stringify(before[key])));
  return Object.fromEntries(sent.map(([key, value]) => [key, typed(definition, key, value)]));
}
/** Shows the exact note bytes, then the default-No review of the one-file plan. */
async function reviewNote(context: ActionContext, plan: Prepared): Promise<boolean> {
  const content = String(plan.data.content), path = String(plan.data.path);
  if (context.ui.rich) await context.ui.rich.review('Note', [{ title: path, body: content }]);
  else context.ui.write(`\n${path}:\n${content}\n`);
  return review(context.ui, plan, context.options.signal);
}
async function load({ state, options, step }: ActionContext): Promise<void> {
  const id = step.with?.collection;
  requireSketch(id, 'WIZARD_ACTION', `${step.id} needs with.collection.`);
  const collection = await openCollection(options.root, id, flagOf(options, 'as-of'));
  const snapshot = await readCollection(collection), noteId = flagOf(options, 'id');
  const notes = snapshot.notes.filter(note => note.record?.id).map(note => ({ id: note.record!.id, title: note.record!.title, status: note.record!.status }));
  Object.assign(state, { collection: id, asOf: collection.asOf, folder: collection.folder, definition: collection.loaded.definition, notes,
    draft: draftOf(collection.loaded.definition), pick: noteId === undefined, ...(noteId ? { noteId } : {}) });
}
async function noteOf(state: FormValues, root: string): Promise<{ collection: CollectionContext; record: CollectionRecord }> {
  const collection = await open(state, root), note = collectionNote(await readCollection(collection), collection, String(state.noteId));
  return { collection, record: note.record };
}
async function reviewOne(context: ActionContext, id: string): Promise<'done' | 'skip' | 'stop'> {
  const { state, options } = context;
  while (true) {
    const { collection, record } = await noteOf({ ...state, noteId: id }, options.root), definition = collection.loaded.definition;
    const value: FormValues = { decision: 'review', ...draftOf(definition, record) };
    const env = { ...context.env, data: { ...state, record, options } };
    await runForm(context.ui, formDefinition(env, definition.forms.review!), value, env);
    if (value.decision !== 'review') return value.decision === 'stop' ? 'stop' : 'skip';
    try { return await reviewNote(context, await collectionUpdatePlan(collection, id, inputOf(definition, value, record), true)) ? 'done' : 'skip'; }
    catch (error) { if (error instanceof Back) throw error; reportError(context.ui, error); }
  }
}
/** Actions and choice providers behind any collection's wizards (configs/wizards/risk-*.json); every write is a reviewed plan. */
export const collectionModule: WizardModule = {
  hooks: {
    choices: {
      /** The vocabulary of the definition field whose input name the asking form field binds. */
      'collection.choices': (data: unknown, field: FormField): FormChoice[] => {
        const { definition } = dataOf(data), name = (field.bind ?? field.id).split('.').at(-1);
        const target = definition.fields.find(item => item.input === name && item.vocabulary);
        requireSketch(target, 'COLLECTION_FORM', `${field.id} binds no vocabulary field of ${definition.id}.`);
        return definition.vocabularies[target.vocabulary!]!.map(item => ({ id: item.id, label: target.kind === 'integer' ? `${item.id} — ${item.label}` : item.label }));
      },
      /** A new note may start in any status people own; an existing one offers its own status and the allowed transitions. */
      'collection.statuses': data => {
        const { definition, record } = dataOf(data), current = definition.statuses.find(item => item.id === record?.status);
        const ids = current ? [current.id, ...current.transitions] : definition.statuses.filter(item => !item.managed).map(item => item.id);
        return ids.map(id => ({ id, label: definition.statuses.find(item => item.id === id)!.label + (id === current?.id ? ' (current)' : '') }));
      },
      'collection.notes': data => (dataOf(data).notes ?? []).map(item => ({ id: item.id, label: `${item.id} — ${item.title} (${item.status})` })),
    },
  },
  actions: {
    'collection.load': load,
    'collection.open': async ({ state, options }) => {
      const { collection, record } = await noteOf(state, options.root);
      Object.assign(state, { record, draft: draftOf(collection.loaded.definition, record) });
    },
    'collection.plan-new': async context => {
      const { state, options } = context, collection = await open(state, options.root);
      const plan = await collectionCreatePlan(collection, inputOf(collection.loaded.definition, state.draft as FormValues));
      if (!await reviewNote(context, plan)) return { end: true, completion: 'Nothing was written.\n' };
      state.created = { id: plan.data.id, path: plan.data.path };
    },
    'collection.plan-update': async context => {
      const { state, options } = context, collection = await open(state, options.root), record = state.record as CollectionRecord;
      const plan = await collectionUpdatePlan(collection, record.id, inputOf(collection.loaded.definition, state.draft as FormValues, record));
      if (!await reviewNote(context, plan)) return { end: true, completion: 'Nothing was written.\n' };
      state.updated = { id: plan.data.id, path: plan.data.path };
    },
    'collection.review-load': async ({ state, options }) => {
      const collection = await open(state, options.root), snapshot = await readCollection(collection);
      const records = snapshot.notes.filter(note => note.record && !note.issues.some(item => item.severity === 'error')).map(note => note.record!);
      const queue = collectionReviewQueue(collection.loaded.definition, records, collection.asOf).map(record => record.id);
      if (!queue.length) return { end: true, completion: `Nothing to review in ${collection.folder}.\n` };
      Object.assign(state, { queue, queued: queue.length, reviewed: 0 });
    },
    'collection.review-walk': async context => {
      for (const id of context.state.queue as string[]) {
        const outcome = await reviewOne(context, id);
        if (outcome === 'stop') break;
        if (outcome === 'done') context.state.reviewed = Number(context.state.reviewed) + 1;
      }
    },
  },
};
