import type { SitemapDesign, Surface, SurfaceKind } from './model.ts';
import { requireSitemap } from './safety.ts';
import { validateSitemapModel } from './validate.ts';

/** Existing native surface defaults, not a page-store or router owned by the editor. */
export function newSitemapSurface(design: SitemapDesign, label: string, kind: SurfaceKind, parent: string | null): Surface {
  validateSitemapModel(design);
  requireSitemap(label.trim() && label.length <= 120, 'SITEMAP_SHAPE', 'Enter a surface name.');
  const count = typeof design.nextId === 'number' ? design.nextId : 1;
  let serial = count;
  while (design.nodes.some(n => n.id === 'node-' + serial) || design.links.some(l => l.id === 'node-' + serial)) serial++;
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'surface';
  const prefix = /^[a-z]/.test(base) ? base : 'surface-' + base;
  let slug = prefix, suffix = 2;
  while (design.nodes.some(n => n.slug === slug)) slug = prefix + '-' + suffix++;
  return { id: 'node-' + serial, slug, label: label.trim(), kind, parent,
    layout: kind === 'settings' || kind === 'modal' ? 'form' : kind === 'view' ? 'sidebar-left' : 'single',
    placement: 'tab', nav: kind === 'page', command: kind === 'view' || kind === 'modal',
    ribbon: false, entry: !design.nodes.some(n => n.entry) && kind === 'view', instance: 'reuse',
    patterns: kind === 'view' ? ['open-view'] : kind === 'settings' ? ['settings'] : [],
    goal: '', entity: '', intent: '', goals: [], components: [], bricks: [],
  };
}
