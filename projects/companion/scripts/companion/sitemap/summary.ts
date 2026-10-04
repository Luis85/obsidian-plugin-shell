import type { SitemapFinding } from './model.ts';
import { inspectSitemap, validateSitemapModel } from './validate.ts';

export interface SitemapSummary {
  surfaces: number;
  nativeViews: number;
  pages: number;
  hierarchyEdges: number;
  transitions: number;
  navigationTransitions: number;
  routes: number;
  journeys: number;
  features: number;
  declared: { sitemap: boolean; features: boolean };
  journeyFindings: SitemapFinding[];
  acceptance: 'structure-only-not-product-acceptance';
}

/** Read-only diagnostic projection used by project inspection, not a generator or migration. */
export function inspectSitemapSummary(value: unknown): SitemapSummary {
  const design = validateSitemapModel(value);
  return {
    surfaces: design.nodes.length,
    nativeViews: design.nodes.filter(node => node.kind === 'view').length,
    pages: design.nodes.filter(node => node.kind === 'page').length,
    hierarchyEdges: design.nodes.filter(node => node.parent !== null).length,
    transitions: design.links.length,
    navigationTransitions: design.links.filter(link => ['navigate', 'open', 'conditional'].includes(link.kind)).length,
    routes: design.sitemap?.routes.length ?? 0,
    journeys: design.sitemap?.journeys.length ?? 0,
    features: design.features?.items.length ?? 0,
    declared: { sitemap: design.sitemap !== undefined, features: design.features !== undefined },
    journeyFindings: inspectSitemap(design),
    acceptance: 'structure-only-not-product-acceptance',
  };
}
