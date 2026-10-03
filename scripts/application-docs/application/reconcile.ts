import { keyOf, equal, insist, type Entity, type DocsIndex, type Conflict, type Resolutions } from '../domain/contracts.ts';
import { mergeEntity } from '../domain/merge.ts';
export interface Reconciliation {
  entities: Entity[]; selected: string[]; conflicts: Conflict[];
  states: Array<{ entity: string; state: string }>;
}
interface Review {
  map: Map<string, Entity>; seen: Set<string>; used: Set<string>; conflicts: Conflict[]; states: Reconciliation['states'];
  index: DocsIndex; direction: 'import' | 'export'; resolutions: Resolutions;
}
function stateOf(markdown: Entity, current: Entity | undefined, base: Entity | undefined, conflicted: boolean): string {
  if (!current) return 'new';
  if (conflicted) return 'conflict';
  if (equal(markdown, current)) return 'synchronized';
  const changedMarkdown = !base || !equal(markdown, base), changedProject = !base || !equal(current, base);
  if (changedMarkdown && changedProject) return 'both-changed';
  return changedMarkdown ? 'markdown-changed' : 'project-changed';
}
function exportConflicts(review: Review, key: string, merged: Entity, current: Entity | undefined): void {
  if (current && !equal(merged, current)) review.conflicts.push({ entity: key, field: '/', reason: 'Markdown is ahead. Review docs import before exporting; existing docs are preserved.' });
  if (!current) review.conflicts.push({ entity: key, field: '/', reason: 'Unimported document. Review docs import first.' });
}
function reviewDocument(review: Review, markdown: Entity): void {
  const key = keyOf(markdown); insist(!review.seen.has(key), 'DOCS_DUPLICATE', 'Two documents declare ' + key); review.seen.add(key);
  const current = review.map.get(key), base = review.index.entries[key]?.baseline;
  insist(markdown.project === review.index.project, 'DOCS_PROJECT', 'Document belongs to a different project: ' + key);
  if (!current && base) {
    review.conflicts.push({ entity: key, field: '/', reason: 'The project element was removed. Missing elements are not implicitly recreated.' });
    review.states.push({ entity: key, state: 'project-missing' }); return;
  }
  const merged = mergeEntity(base, markdown, current, review.resolutions);
  merged.used.forEach(item => review.used.add(item)); review.conflicts.push(...merged.conflicts);
  review.states.push({ entity: key, state: stateOf(markdown, current, base, merged.conflicts.length > 0) });
  if (review.direction === 'export') exportConflicts(review, key, merged.value, current);
  else review.map.set(key, merged.value);
}
/** Pure reconciliation. Import is additive; missing documents never become deletions. */
export function reconcile(project: Entity[], documents: Entity[], index: DocsIndex, direction: 'import' | 'export', resolutions: Resolutions = {}): Reconciliation {
  const review: Review = { map: new Map(project.map(entity => [keyOf(entity), entity])), seen: new Set<string>(), used: new Set<string>(),
    conflicts: [], states: [], index, direction, resolutions };
  for (const markdown of documents) reviewDocument(review, markdown);
  insist(Object.keys(resolutions).every(key => review.used.has(key)), 'DOCS_RESOLUTION_UNUSED', 'Resolution file contains stale or unknown conflict keys.');
  return { entities: [...review.map.values()], selected: [...review.seen], conflicts: review.conflicts, states: review.states };
}
