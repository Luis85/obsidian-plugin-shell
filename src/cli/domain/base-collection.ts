import { requireSketch } from '#shared/contracts/sketch-errors.ts';
import type { BaseNote, BaseValue } from './base-expression.ts';
import { NoteScope, requiredFolder, viewIssues, type BaseDefinition, type BaseSort, type BaseView } from './obsidian-base.ts';

/** A selected Bases view applied to notes: the records a fixture or prototype can load, in the view's order. */
export type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'list' | 'object' | 'empty' | 'mixed';
export interface CollectionField { property: string; displayName: string; type: FieldType }
export interface BaseRecord { path: string; group?: BaseValue; values: Record<string, BaseValue>; properties: Record<string, BaseValue> }
export interface BaseSource { path: string; sha256: string }
export interface FileCollection {
  kind: 'file-collection';
  base: BaseSource & { view: string };
  view: { name: string; type: string };
  folder: string | null;
  fields: CollectionField[];
  sort: BaseSort[];
  groupBy: BaseSort | null;
  limit: number | null;
}
export interface CollectionResult { collection: FileCollection; records: BaseRecord[]; matched: number }

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'variant' });
const DATE = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const rank = (value: BaseValue): number => value === null ? 4 : typeof value === 'number' ? 0 : typeof value === 'boolean' ? 1 : typeof value === 'string' ? 2 : 3;
/** Total, deterministic order: numbers, booleans, text, structured values, then empty values last. */
export function compareValues(left: BaseValue, right: BaseValue): number {
  const byRank = rank(left) - rank(right);
  if (byRank !== 0) return byRank;
  if (typeof left === 'number') return left - (right as number);
  if (typeof left === 'boolean') return Number(left) - Number(right);
  if (typeof left === 'string') return collator.compare(left, right as string);
  return left === null ? 0 : collator.compare(JSON.stringify(left), JSON.stringify(right));
}
function valueType(value: BaseValue): FieldType {
  if (value === null || value === '') return 'empty';
  if (Array.isArray(value)) return 'list';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') return DATE.test(value) ? 'date' : 'text';
  return typeof value === 'number' ? 'number' : 'boolean';
}
export function fieldType(values: readonly BaseValue[]): FieldType {
  const types = new Set(values.map(valueType).filter(type => type !== 'empty'));
  if (!types.size) return 'empty';
  if (types.size === 2 && types.has('date') && types.has('text')) return 'text';
  return types.size === 1 ? [...types][0]! : 'mixed';
}
const columns = (view: BaseView): string[] => view.order.length ? view.order : ['file.name'];

interface Row { record: BaseRecord; keys: BaseValue[] }
function sortRows(rows: Row[], keys: BaseSort[]): Row[] {
  return rows.sort((a, b) => {
    for (const [index, key] of keys.entries()) {
      const order = compareValues(a.keys[index]!, b.keys[index]!);
      if (order !== 0) return key.direction === 'DESC' && a.keys[index] !== null && b.keys[index] !== null ? -order : order;
    }
    return collator.compare(a.record.path, b.record.path);
  });
}

/** Applies the global and view filters, then grouping, sorting and the limit. Unsupported views are refused. */
export function collectRecords(base: BaseDefinition, view: BaseView, notes: readonly BaseNote[], source: BaseSource): CollectionResult {
  const issues = viewIssues(base, view);
  requireSketch(!issues.length, 'BASE_VIEW_UNSUPPORTED', `View "${view.name}" uses unsupported Bases features: ${issues.join(' ')}`);
  const keys = [...(view.groupBy ? [view.groupBy] : []), ...view.sort];
  const fields = columns(view);
  const rows: Row[] = [];
  for (const note of notes) {
    const scope = new NoteScope(base, note);
    if (!scope.matches(base.filters) || !scope.matches(view.filters)) continue;
    const values = Object.fromEntries(fields.map(id => [id, scope.property(id)]));
    const record: BaseRecord = { path: note.path, ...(view.groupBy ? { group: scope.property(view.groupBy.property) } : {}), values, properties: note.properties };
    rows.push({ record, keys: keys.map(key => scope.property(key.property)) });
  }
  const records = sortRows(rows, keys).map(row => row.record);
  const limited = view.limit === null ? records : records.slice(0, view.limit);
  return {
    matched: records.length, records: limited,
    collection: {
      kind: 'file-collection', base: { ...source, view: view.name }, view: { name: view.name, type: view.type },
      folder: requiredFolder(base.filters), sort: view.sort, groupBy: view.groupBy, limit: view.limit,
      fields: fields.map(property => ({ property, displayName: base.displayNames[property] ?? property.replace(/^(?:note|file|formula)\./, ''), type: fieldType(limited.map(record => record.values[property]!)) })),
    },
  };
}
