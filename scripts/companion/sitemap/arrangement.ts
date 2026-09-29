import type { Position, SitemapDesign } from './model.ts';
import { requireSitemap } from './safety.ts';
import { validateSitemapModel } from './validate.ts';

/** Card footprint shared with the editor; layout is presentation, never hierarchy or routing. */
const width = 218, height = 160, column = 290, row = 200;
const overlaps = (a: Position, b: Position): boolean =>
  Math.abs(a.x - b.x) < width + 24 && Math.abs(a.y - b.y) < height + 24;

/** Stable subtree layout. `missing` preserves every saved coordinate, including authored overlaps.
 * `all` only returns a proposal: the caller must review and commit it through the saved-state session. */
export function arrangeSitemap(design: SitemapDesign, mode: 'missing' | 'all' = 'missing'): Record<string, Position> {
  validateSitemapModel(design);
  requireSitemap(mode === 'missing' || mode === 'all', 'SITEMAP_SHAPE', 'Unknown arrangement mode.');
  const children = new Map<string | null, string[]>();
  for (const node of design.nodes) {
    const siblings = children.get(node.parent) ?? []; siblings.push(node.id); children.set(node.parent, siblings);
  }
  const spans = new Map<string, number>();
  function measure(id: string): number {
    const span = Math.max(1, (children.get(id) ?? []).reduce((total, child) => total + measure(child), 0));
    spans.set(id, span); return span;
  }
  const ideal: Record<string, Position> = {};
  function place(id: string, depth: number, start: number): void {
    ideal[id] = { x: depth * column, y: (start + (spans.get(id)! - 1) / 2) * row };
    let next = start;
    for (const child of children.get(id) ?? []) { place(child, depth + 1, next); next += spans.get(child)!; }
  }
  let start = 0;
  for (const id of children.get(null) ?? []) { const span = measure(id); place(id, 0, start); start += span; }
  if (mode === 'all') return ideal;
  const positions: Record<string, Position> = {}, occupied: Position[] = [];
  for (const node of design.nodes) {
    const saved = design.canvas?.positions[node.id];
    if (saved) { positions[node.id] = { ...saved }; occupied.push(positions[node.id]!); }
  }
  for (const node of design.nodes) {
    if (positions[node.id]) continue;
    const candidate = { ...ideal[node.id]! };
    // At most sixty cards: moving below occupied intervals always terminates within the coordinate bound.
    while (occupied.some(position => overlaps(position, candidate))) candidate.y += row;
    positions[node.id] = candidate; occupied.push(candidate);
  }
  return positions;
}
