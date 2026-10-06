import { requireSketch } from './errors.ts';
import { collectionField, collectionStatus, type CollectionDefinition, type CollectionSort } from './collection-definition.ts';
import { collectionOverdue, type CollectionIssue, type CollectionRecord, type CollectionValue } from './collection-record.ts';
/** A note as listed and checked: its path, the readable record (if any) and every issue found while reading it. */
export interface CollectionEntry { path: string; record?: CollectionRecord; issues: CollectionIssue[] }
const valueOf = (record: CollectionRecord, key: string): CollectionValue | undefined => key === 'id' ? record.id : key === 'status' ? record.status : record.values[key];
/** Choice and status values sort by their position in the definition (for example low → critical); others naturally. */
function rank(definition: CollectionDefinition, key: string, value: CollectionValue): number | string {
  const field = collectionField(definition, key);
  const order = key === 'status' ? definition.statuses : field?.kind === 'choice' ? definition.vocabularies[field.vocabulary!] : undefined;
  if (order) return order.findIndex(item => item.id === value);
  return typeof value === 'number' ? value : Array.isArray(value) ? value.join(', ') : value;
}
function compare(definition: CollectionDefinition, sort: CollectionSort, left: CollectionRecord, right: CollectionRecord): number {
  const a = valueOf(left, sort.key), b = valueOf(right, sort.key);
  if (a === undefined || b === undefined) return a === b ? 0 : a === undefined ? 1 : -1;
  const x = rank(definition, sort.key, a), y = rank(definition, sort.key, b);
  const result = x < y ? -1 : x > y ? 1 : 0;
  return sort.order === 'desc' ? -result : result;
}
/** The report order of the definition, then id; missing values sort last. */
export function sortCollection(definition: CollectionDefinition, records: readonly CollectionRecord[]): CollectionRecord[] {
  const order: CollectionSort[] = [...definition.report.sort, { key: 'id', order: 'asc' }];
  return [...records].sort((left, right) => {
    for (const sort of order) { const result = compare(definition, sort, left, right); if (result) return result; }
    return 0;
  });
}
/** Filters by status or any choice field; an unknown key or value fails instead of silently matching nothing. */
export function filterCollection(definition: CollectionDefinition, records: readonly CollectionRecord[], filters: Readonly<Record<string, string>>, overdue: boolean, asOf: string): CollectionRecord[] {
  for (const [key, value] of Object.entries(filters)) {
    const field = collectionField(definition, key);
    const allowed = key === 'status' ? definition.statuses : field?.kind === 'choice' ? definition.vocabularies[field.vocabulary!] : undefined;
    requireSketch(allowed, 'COLLECTION_FILTER', `${key} is not a status or choice field of ${definition.id}.`);
    requireSketch(allowed.some(item => item.id === value), 'COLLECTION_FILTER', `${key} must be one of ${allowed.map(item => item.id).join(', ')}.`);
  }
  return records.filter(record => Object.entries(filters).every(([key, value]) => valueOf(record, key) === value)
    && (!overdue || collectionOverdue(definition, record, asOf)));
}
/** Open notes that match a review rule (for example level high or critical) or are overdue, in report order. */
export function collectionReviewQueue(definition: CollectionDefinition, records: readonly CollectionRecord[], asOf: string): CollectionRecord[] {
  const review = definition.review;
  if (!review) return [];
  return sortCollection(definition, records.filter(record => collectionStatus(definition, record.status)?.open
    && (review.match.some(rule => rule.in.includes(String(record.values[rule.key]))) || (review.overdue && collectionOverdue(definition, record, asOf)))));
}
/** Every issue of a collection: per-note problems, duplicate ids and overdue open notes. Warnings never fail a check. */
export function collectionCheck(definition: CollectionDefinition, entries: readonly CollectionEntry[], asOf: string): CollectionIssue[] {
  const issues = entries.flatMap(entry => entry.issues.map(item => ({ ...item, path: entry.path, ...(entry.record?.id ? { id: entry.record.id } : {}) })));
  const seen = new Map<string, string>();
  for (const entry of entries) {
    const id = entry.record?.id.toLowerCase();
    if (!id) continue;
    const first = seen.get(id);
    if (first) issues.push({ severity: 'error', code: 'COLLECTION_DUPLICATE_ID', message: `${entry.record!.id} is also used by ${first}.`, path: entry.path, id: entry.record!.id });
    else seen.set(id, entry.path);
    if (collectionOverdue(definition, entry.record!, asOf))
      issues.push({ severity: 'warning', code: 'COLLECTION_OVERDUE', message: `${entry.record!.id} is overdue.`, path: entry.path, id: entry.record!.id });
  }
  return issues;
}
/** A compact row for listings: the definition's list columns plus overdue. */
export function collectionRow(definition: CollectionDefinition, entry: CollectionEntry & { record: CollectionRecord }, asOf: string): Record<string, unknown> {
  const columns = Object.fromEntries(definition.list.columns.map(key => [key, valueOf(entry.record, key) ?? null]));
  return { ...columns, path: entry.path, overdue: collectionOverdue(definition, entry.record, asOf), issues: entry.issues.length };
}
export const collectionCell = valueOf;
