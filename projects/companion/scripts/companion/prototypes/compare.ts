/** Read-only complete-project comparison; bounded summaries are not a merge operation. */
import { validateAuthoringDocument } from '../authoring-contract.ts';
import { prototypeJson, ensure } from './safety.ts';
export interface PrototypeDifference { path: string; kind: 'added' | 'removed' | 'changed'; before: string; after: string }
export interface PrototypeComparison { equal: boolean; total: number; omitted: number; changes: PrototypeDifference[] }
const pointer = (key: string) => key.replaceAll('~', '~0').replaceAll('/', '~1');
function preview(value: unknown, present: boolean): string {
  if (!present) return '(absent)';
  const text = JSON.stringify(value) ?? 'null';
  return text.length <= 180 ? text : text.slice(0, 177) + '…';
}
export function comparePrototypeDocuments(before: unknown, after: unknown): PrototypeComparison {
  prototypeJson(before); prototypeJson(after);
  const a = validateAuthoringDocument(before), b = validateAuthoringDocument(after);
  ensure(a.project.id === b.project.id, 'PROTOTYPE_PROJECT', 'Compare snapshots belonging to the same project.');
  const changes: PrototypeDifference[] = []; let total = 0;
  function visit(left: unknown, right: unknown, path: string, leftPresent = true, rightPresent = true): void {
    if (leftPresent && rightPresent && left === right) return;
    if (leftPresent && rightPresent && left !== null && right !== null && typeof left === 'object' && typeof right === 'object' && Array.isArray(left) === Array.isArray(right)) {
      if (Array.isArray(left) && Array.isArray(right)) {
        for (let i = 0; i < Math.max(left.length, right.length); i++) visit(left[i], right[i], path + '/' + i, i < left.length, i < right.length);
      } else {
        const l = left as Record<string, unknown>, r = right as Record<string, unknown>;
        for (const key of [...new Set([...Object.keys(l), ...Object.keys(r)])].sort()) visit(l[key], r[key], path + '/' + pointer(key), Object.hasOwn(l, key), Object.hasOwn(r, key));
      }
      return;
    }
    total++;
    if (changes.length < 100) changes.push({ path: path || '/', kind: !leftPresent ? 'added' : !rightPresent ? 'removed' : 'changed', before: preview(left, leftPresent), after: preview(right, rightPresent) });
  }
  visit(a, b, '');
  return { equal: total === 0, total, omitted: total - changes.length, changes };
}
