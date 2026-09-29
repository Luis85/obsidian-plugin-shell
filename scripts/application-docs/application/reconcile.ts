import { keyOf, equal, insist, type Entity, type DocsIndex, type Conflict, type Resolutions } from '../domain/contracts.ts';
import { mergeEntity } from '../domain/merge.ts';
export interface Reconciliation {
  entities: Entity[]; selected: string[]; conflicts: Conflict[];
  states: Array<{ entity: string; state: string }>;
}
/** Pure reconciliation. Import is additive; missing documents never become deletions. */
export function reconcile(project: Entity[], documents: Entity[], index: DocsIndex, direction: 'import' | 'export', resolutions: Resolutions = {}): Reconciliation {
  const map = new Map(project.map(entity => [keyOf(entity), entity])), seen = new Set<string>();
  const conflicts: Conflict[] = [], states: Reconciliation['states'] = [], used = new Set<string>();
  for (const markdown of documents) {
    const key = keyOf(markdown); insist(!seen.has(key), 'DOCS_DUPLICATE', 'Two documents declare ' + key); seen.add(key);
    const current = map.get(key), base = index.entries[key]?.baseline;
    insist(markdown.project === index.project, 'DOCS_PROJECT', 'Document belongs to a different project: ' + key);
    if (!current && base) {
      conflicts.push({ entity: key, field: '/', reason: 'The project element was removed. Missing elements are not implicitly recreated.' });
      states.push({ entity: key, state: 'project-missing' }); continue;
    }
    const merged = mergeEntity(base, markdown, current, resolutions);
    merged.used.forEach(key => used.add(key)); conflicts.push(...merged.conflicts);
    const changedMarkdown = !base || !equal(markdown, base), changedProject = !base || !equal(current, base);
    const state = !current ? 'new' : merged.conflicts.length ? 'conflict' : equal(markdown, current) ? 'synchronized' :
      changedMarkdown && changedProject ? 'both-changed' : changedMarkdown ? 'markdown-changed' : 'project-changed';
    states.push({ entity: key, state });
    if (direction === 'export') {
      if (current && !equal(merged.value, current)) conflicts.push({ entity: key, field: '/', reason: 'Markdown is ahead. Review docs import before exporting; existing docs are preserved.' });
      if (!current) conflicts.push({ entity: key, field: '/', reason: 'Unimported document. Review docs import first.' });
    } else map.set(key, merged.value);
  }
  insist(Object.keys(resolutions).every(key => used.has(key)), 'DOCS_RESOLUTION_UNUSED', 'Resolution file contains stale or unknown conflict keys.');
  return { entities: [...map.values()], selected: [...seen], conflicts, states };
}
