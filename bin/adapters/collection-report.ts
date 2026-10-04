import { createFilePlan } from '../../scripts/shared/file-plan.ts';
import { requireSketch } from '../domain/errors.ts';
import { sortCollection } from '../domain/collection-query.ts';
import { collectionBase, collectionRegister, mergeCollectionRegister } from '../domain/collection-register.ts';
import { hash } from './framework/files.ts';
import { renderBase } from './fake-data-plan.ts';
import { prepared, type Entry, type Prepared } from './storage.ts';
import { guardedText } from './user-settings.ts';
import { readCollection, type CollectionContext } from './collection-store.ts';
/**
 * The generated register (and optional Obsidian Bases file) as one reviewed plan. Text outside the register's markers
 * is preserved; an edited generated block or a different existing .base file stops the plan before anything is written.
 */
export async function collectionReportPlan(context: CollectionContext, withBase: boolean): Promise<Prepared> {
  const { definition, hook } = context.loaded, snapshot = await readCollection(context);
  const valid = snapshot.notes.filter(note => note.record && !note.issues.some(item => item.severity === 'error'));
  const records = sortCollection(definition, valid.map(note => note.record!));
  const pathOf = new Map(valid.map(note => [note.record!, note.path]));
  const rows = records.map(record => ({ record, href: pathOf.get(record)!.slice(context.folder.length + 1) }));
  const attention = snapshot.notes.filter(note => !valid.includes(note)).map(note => note.path);
  const inner = collectionRegister(definition, rows, context.asOf, attention, hook?.report?.(records, definition) ?? '');
  const path = `${context.folder}/${definition.report.file}`, existing = await guardedText(context.root, path);
  const entries: Entry[] = [{ path, content: mergeCollectionRegister(definition, existing.content, inner, hash) }];
  const basePath = definition.report.base && withBase ? `${context.folder}/${definition.report.base}` : undefined;
  if (basePath) entries.push({ path: basePath, content: renderBase({ path: basePath, data: collectionBase(definition) }) });
  const plan = await createFilePlan(context.root, entries);
  requireSketch(plan.changes[0]!.beforeHash === existing.beforeHash, 'MAKER_STALE', `${path} changed while planning; nothing was overwritten.`);
  requireSketch(!basePath || ['create', 'unchanged'].includes(plan.changes[1]!.status), 'COLLECTION_CONFLICT', `${basePath} already exists with other content; nothing was overwritten.`);
  const identity = { kind: 'collection-report', collection: definition.id, path, asOf: context.asOf, base: Boolean(basePath) };
  return prepared(plan, { collection: definition.id, register: path, ...(basePath ? { base: basePath } : {}), notes: records.length, needsAttention: attention }, identity);
}
