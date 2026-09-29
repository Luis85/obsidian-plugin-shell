import { newSitemapSurface } from '../../scripts/companion/sitemap/create.ts';
import { visualAllocate, visualLayoutRules, visualLocate, visualNodes, type PageDefinition, type UiNode } from '../../scripts/companion/visual/visual-ir.mjs';
import type { SketchDocument } from './document.ts';
import { requireSketch, slug, title } from './errors.ts';

export function surfaceFor(document: SketchDocument, id: string) {
  const surface = document.design.nodes.find(item => item.id === id);
  requireSketch(surface && !['group', 'action'].includes(surface.kind), 'SKETCH_PAGE_MISSING', 'Select an existing page or view.');
  return surface;
}
export function pageFor(document: SketchDocument, id: string): PageDefinition {
  const surface = surfaceFor(document, id), store = document.design.visualDesigns;
  let page = store.pages.find(item => item.ownerId === id);
  if (!page) {
    page = { id: visualAllocate(store, 'vp'), ownerId: id, name: surface.label, root: [], scenarios: [], notes: '' };
    store.pages.push(page);
  }
  return page;
}
export function addPage(document: SketchDocument, name: string): string {
  const label = title(name), design = document.design;
  const surface = newSitemapSurface(design, label, 'view', null);
  surface.slug = slug(label, 'page', design.nodes.map(item => item.slug ?? ''));
  surface.entry = !design.nodes.some(item => item.entry); surface.command = true;
  design.nodes.push(surface); design.nextId = Number(surface.id.slice('node-'.length)) + 1;
  design.sitemap ??= { schema: 1, routes: [], journeys: [] };
  const path = '/' + surface.slug;
  if (!design.sitemap.routes.some(route => route.path === path)) {
    design.sitemap.routes.push({ id: 'route-' + surface.id, surface: surface.id, path });
  }
  pageFor(document, surface.id);
  return surface.id;
}
export function renamePage(document: SketchDocument, id: string, name: string): void {
  const label = title(name); surfaceFor(document, id).label = label;
  const page = document.design.visualDesigns.pages.find(item => item.ownerId === id);
  if (page) page.name = label;
}
export function pageNodes(document: SketchDocument, id: string): UiNode[] {
  const page = document.design.visualDesigns.pages.find(item => item.ownerId === id);
  return page ? visualNodes(page.root) : [];
}
export function moveNode(document: SketchDocument, surface: string, node: string, direction: -1 | 1): void {
  const hit = visualLocate(pageFor(document, surface).root, node);
  requireSketch(hit, 'SKETCH_NODE_MISSING', 'The selected element no longer exists.');
  const next = hit.index + direction;
  requireSketch(next >= 0 && next < hit.list.length, 'SKETCH_ORDER_BOUNDARY', 'This element is already at that end of its region.');
  hit.list.splice(hit.index, 1); hit.list.splice(next, 0, hit.node);
}
export function setPageLayout(document: SketchDocument, surface: string, mode: 'stack' | 'row' | 'grid'): void {
  const page = pageFor(document, surface), store = document.design.visualDesigns;
  const existing = page.root.length === 1 ? page.root[0] : undefined;
  if (existing?.kind === 'element' && existing.name === 'Page layout') { existing.layout = visualLayoutRules(mode); return; }
  page.root = [{ id: visualAllocate(store, 'vn'), kind: 'element', tag: 'section', name: 'Page layout',
    attrs: {}, children: page.root, events: [], layout: visualLayoutRules(mode) }];
}
/** New children join the explicit layout region; imported trees are otherwise left intact. */
export function pageContent(document: SketchDocument, surface: string): UiNode[] {
  const root = pageFor(document, surface).root, first = root.length === 1 ? root[0] : undefined;
  return first?.kind === 'element' && first.name === 'Page layout' ? first.children : root;
}
