import type { SitemapCommand, SitemapDesign } from './model.ts';
import { SITEMAP_LIMITS } from './model.ts';
import { canonicalKey, requireSitemap, utf8Length } from './safety.ts';
import { applySitemapCommand } from './commands.ts';
import { sitemapSemanticKey } from './projection.ts';
import { validateSitemapModel } from './validate.ts';

export interface SitemapChange {
  schema: 1;
  command: SitemapCommand;
  beforeKey: string;
  afterKey: string;
  change: 'semantic' | 'arrangement' | 'unchanged';
}
export interface HistoryEntry<T extends SitemapDesign> { restore: T; expected: string }
export interface SitemapHistory<T extends SitemapDesign> {
  past: HistoryEntry<T>[];
  future: HistoryEntry<T>[];
}
export interface SitemapChangeResult<T extends SitemapDesign> {
  design: T;
  history: SitemapHistory<T>;
  evicted: number;
}

/** An in-memory authoring review, not an execution approval and never a portable project field. */
export function planSitemapChange<T extends SitemapDesign>(design: T, command: SitemapCommand): SitemapChange {
  const candidate = applySitemapCommand(design, command);
  return { schema: 1, command: structuredClone(command), beforeKey: canonicalKey(design), afterKey: canonicalKey(candidate),
    change: candidate === design ? 'unchanged' : sitemapSemanticKey(candidate) === sitemapSemanticKey(design) ? 'arrangement' : 'semantic' };
}

function boundHistory<T extends SitemapDesign>(history: SitemapHistory<T>): number {
  let evicted = 0;
  while (history.past.length + history.future.length > SITEMAP_LIMITS.history ||
    utf8Length(JSON.stringify(history)) > SITEMAP_LIMITS.historyBytes) {
    const stack = history.past.length ? history.past : history.future;
    if (stack.length === 0) break;
    stack.shift(); evicted++;
  }
  return evicted;
}

/** Revalidates the command and exact whole-design preimage. The caller persists the returned candidate. */
export function applySitemapChange<T extends SitemapDesign>(
  current: T, plan: SitemapChange, previous: SitemapHistory<T> = { past: [], future: [] },
): SitemapChangeResult<T> {
  validateSitemapModel(current);
  requireSitemap(plan.schema === 1 && canonicalKey(current) === plan.beforeKey,
    'SITEMAP_STALE', 'The project changed after review. Rebuild the review.');
  const candidate = applySitemapCommand(current, plan.command);
  requireSitemap(canonicalKey(candidate) === plan.afterKey, 'SITEMAP_STALE', 'The reviewed change was modified.');
  if (candidate === current) return { design: current, history: structuredClone(previous), evicted: 0 };
  const latest = previous.past.at(-1);
  requireSitemap(!latest || latest.expected === plan.beforeKey, 'SITEMAP_STALE', 'History no longer matches the committed project.');
  const history: SitemapHistory<T> = { past: [...structuredClone(previous.past), { restore: structuredClone(current), expected: plan.afterKey }], future: [] };
  return { design: candidate, history, evicted: boundHistory(history) };
}

/** Returns a candidate only. Failed native persistence must not replace the caller's design or history. */
export function travelSitemapHistory<T extends SitemapDesign>(
  current: T, previous: SitemapHistory<T>, direction: 'undo' | 'redo',
): SitemapChangeResult<T> {
  validateSitemapModel(current);
  requireSitemap(direction === 'undo' || direction === 'redo', 'SITEMAP_COMMAND', 'Unknown history direction.');
  const history = structuredClone(previous), source = direction === 'undo' ? history.past : history.future;
  const target = direction === 'undo' ? history.future : history.past;
  const entry = source.at(-1);
  if (!entry) return { design: current, history, evicted: 0 };
  requireSitemap(canonicalKey(current) === entry.expected, 'SITEMAP_STALE', 'A concurrent change invalidated this history entry.');
  validateSitemapModel(entry.restore);
  const candidate = structuredClone(entry.restore);
  source.pop(); target.push({ restore: structuredClone(current), expected: canonicalKey(candidate) });
  return { design: candidate, history, evicted: boundHistory(history) };
}
