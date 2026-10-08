import type { Position } from './model.ts';

export interface LayoutSurface { id: string; parent: string | null; position?: Position | null }
export const SITEMAP_CARD = Object.freeze({ width: 218, height: 112, gapX: 38, gapY: 66, columns: 6 });

/** Display geometry only. Never infers parents/routes or mutates the canonical design.
 * Depth bands reserve their full height, including wrapped rows. Explicit saved
 * positions are retained; unsaved cards are placed without colliding with them.
 */
export function sitemapDisplayLayout(nodes: readonly LayoutSurface[], preserve = true): Record<string, Position> {
  const byId = new Map(nodes.map(node => [node.id, node]));
  if (byId.size !== nodes.length || nodes.length > 60) throw Error('Invalid sitemap layout input.');
  const depths = new Map<string, number>();
  function depth(id: string, visiting = new Set<string>()): number {
    const cached = depths.get(id); if (cached !== undefined) return cached;
    const node = byId.get(id);
    if (!node || visiting.has(id)) throw Error('Sitemap layout requires a valid hierarchy.');
    visiting.add(id);
    const value = node.parent === null ? 0 : depth(node.parent, visiting) + 1;
    visiting.delete(id); depths.set(id, value); return value;
  }
  const bands = new Map<number, LayoutSurface[]>();
  for (const node of nodes) { const level = depth(node.id); bands.set(level, [...(bands.get(level) ?? []), node]); }
  const positions = new Map<string, Position>(), occupied: Position[] = [];
  for (const node of nodes) if (preserve && node.position) {
    if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) throw Error('Invalid sitemap position.');
    positions.set(node.id, { ...node.position }); occupied.push(node.position);
  }
  const { width, height, gapX, gapY, columns } = SITEMAP_CARD;
  const collides = (position: Position) => occupied.some(other =>
    Math.abs(position.x - other.x) < width + 12 && Math.abs(position.y - other.y) < height + 12);
  let top = 32;
  for (const [, band] of [...bands].sort(([a], [b]) => a - b)) {
    let bottom = top;
    for (let index = 0; index < band.length; index++) {
      const node = band[index]; if (!node || positions.has(node.id)) continue;
      let slot = index, candidate: Position;
      do {
        candidate = { x: 32 + (slot % columns) * (width + gapX), y: top + Math.floor(slot / columns) * (height + gapY) };
        slot++;
      } while (collides(candidate));
      positions.set(node.id, candidate); occupied.push(candidate); bottom = Math.max(bottom, candidate.y);
    }
    top = Math.max(bottom, top + Math.floor(Math.max(0, band.length - 1) / columns) * (height + gapY)) + height + gapY;
  }
  return Object.fromEntries(positions);
}

/** Stable pre-order outline; indentation reflects parents, not canvas positions. */
export function sitemapOutline(nodes: readonly LayoutSurface[]): Array<{ id: string; depth: number }> {
  sitemapDisplayLayout(nodes); // Reject missing parents/cycles before traversal.
  const result: Array<{ id: string; depth: number }> = [];
  function visit(parent: string | null, depth: number): void {
    for (const node of nodes) if (node.parent === parent) { result.push({ id: node.id, depth }); visit(node.id, depth + 1); }
  }
  visit(null, 0); return result;
}
