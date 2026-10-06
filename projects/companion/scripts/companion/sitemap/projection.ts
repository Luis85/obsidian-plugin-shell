import type { Position, SitemapDesign, SurfaceKind } from './model.ts';
import { canonicalKey, requireSitemap } from './safety.ts';
import { validateSitemapModel } from './validate.ts';

export interface SitemapContext {
  parent: string | null;
  siblings: string[];
  children: string[];
  related: string[];
  incoming: string[];
  outgoing: string[];
  breadcrumb: string[];
}
export interface ProjectedSurface {
  id: string;
  label: string;
  kind: SurfaceKind;
  parent: string | null;
  position: Position | null;
  route: string | null;
  matched: boolean;
  journeySteps: string[];
}
export interface ProjectedEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  kind: 'hierarchy' | 'navigation' | 'journey';
  transition: string | null;
  executable: boolean;
}
export interface ProjectionOptions { lens: 'hierarchy' | 'navigation' | 'journey'; journey?: string; query?: string }

/** Sitemap-only semantic fingerprint. Not a substitute for the compiler's full-project plan hash. */
export function sitemapSemanticKey(design: SitemapDesign): string {
  validateSitemapModel(design);
  return canonicalKey({ nodes: design.nodes, links: design.links,
    sitemap: design.sitemap ?? null, features: design.features ?? null });
}

export function sitemapContext(design: SitemapDesign, selected: string): SitemapContext {
  validateSitemapModel(design);
  const node = design.nodes.find(item => item.id === selected);
  requireSitemap(node, 'SITEMAP_REFERENCE', 'The selected surface does not exist.');
  const incoming = design.links.filter(link => link.to === selected);
  const outgoing = design.links.filter(link => link.from === selected);
  const breadcrumb: string[] = []; let cursor: string | null = selected;
  while (cursor !== null) {
    breadcrumb.unshift(cursor);
    cursor = design.nodes.find(item => item.id === cursor)?.parent ?? null;
  }
  return {
    parent: node.parent,
    siblings: design.nodes.filter(item => item.parent === node.parent && item.id !== selected).map(item => item.id),
    children: design.nodes.filter(item => item.parent === selected).map(item => item.id),
    related: [...new Set([...incoming.map(link => link.from), ...outgoing.map(link => link.to)])].filter(key => key !== selected),
    incoming: incoming.map(link => link.id), outgoing: outgoing.map(link => link.id), breadcrumb,
  };
}

/** Projection IDs are display-only. The original surface/transition IDs stay authoritative. */
export function sitemapProjection(design: SitemapDesign, options: ProjectionOptions): { nodes: ProjectedSurface[]; edges: ProjectedEdge[] } {
  validateSitemapModel(design);
  requireSitemap(['hierarchy', 'navigation', 'journey'].includes(options.lens), 'SITEMAP_SHAPE', 'Unknown lens.');
  const journey = design.sitemap?.journeys.find(item => item.id === options.journey);
  requireSitemap(options.lens !== 'journey' || journey, 'SITEMAP_REFERENCE', 'Select an existing journey.');
  const query = (options.query ?? '').trim().toLowerCase();
  const nodes: ProjectedSurface[] = design.nodes.map(node => {
    const position = design.canvas?.positions[node.id];
    return ({
    id: node.id, label: node.label, kind: node.kind, parent: node.parent,
    position: position ? { ...position } : null,
    route: design.sitemap?.routes.find(route => route.surface === node.id)?.path ?? null,
    matched: !query || [node.label, node.slug ?? '', node.kind].join(' ').toLowerCase().includes(query),
    journeySteps: (journey?.steps ?? []).filter(step => step.surface === node.id).map(step => step.id),
  });
  });
  const edges: ProjectedEdge[] = [];
  if (options.lens === 'hierarchy') for (const node of design.nodes) {
    if (node.parent !== null) edges.push({ id: 'hierarchy:' + node.id, source: node.parent, target: node.id,
      label: '', kind: 'hierarchy', transition: null, executable: false });
  }
  if (options.lens === 'navigation') for (const link of design.links) {
    if (['navigate', 'open', 'conditional'].includes(link.kind)) edges.push({ id: 'navigation:' + link.id,
      source: link.from, target: link.to, label: link.label, kind: 'navigation', transition: link.id,
      executable: link.kind !== 'conditional' });
  }
  if (options.lens === 'journey' && journey) journey.steps.forEach((step, index) => {
    const previous = journey.steps[index - 1];
    if (!previous || step.unresolved || previous.unresolved || step.via === null) return;
    const link = design.links.find(item => item.id === step.via);
    if (link) edges.push({ id: 'journey:' + journey.id + ':' + step.id,
      source: previous.surface, target: step.surface, label: link.label, kind: 'journey', transition: link.id,
      executable: link.kind !== 'conditional' });
  });
  return { nodes, edges };
}
