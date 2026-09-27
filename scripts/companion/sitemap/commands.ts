import type { RemovalImpact, SitemapCommand, SitemapDesign, Surface } from './model.ts';
import { SITEMAP_LIMITS } from './model.ts';
import { canonicalKey, assertJson, id, object, record, requireSitemap, text } from './safety.ts';
import { validateSitemapModel } from './validate.ts';

function assertCommand(value: unknown): asserts value is SitemapCommand {
  // A removal review includes a complete escaped preimage; the actual design stays bounded to 4 MB.
  assertJson(value, 'review');
  requireSitemap(record(value), 'SITEMAP_SHAPE', 'Expected an editor command.');
  switch (value.type) {
    case 'create': object(value, ['type', 'surface']); requireSitemap(record(value.surface), 'SITEMAP_SHAPE', 'Expected a new surface.'); break;
    case 'link': object(value, ['type', 'transition']); requireSitemap(record(value.transition), 'SITEMAP_SHAPE', 'Expected a transition.'); break;
    case 'move':
      object(value, ['type', 'surface', 'parent', 'before']); id(value.surface);
      if (value.parent !== null) id(value.parent);
      if (value.before !== null) id(value.before);
      break;
    case 'rename': object(value, ['type', 'surface', 'label']); id(value.surface); text(value.label); break;
    case 'arrange': object(value, ['type', 'positions']); requireSitemap(record(value.positions), 'SITEMAP_SHAPE', 'Expected positions.'); break;
    case 'route': object(value, ['type', 'route']); requireSitemap(record(value.route), 'SITEMAP_SHAPE', 'Expected a route.'); break;
    case 'journey': object(value, ['type', 'journey']); requireSitemap(record(value.journey), 'SITEMAP_SHAPE', 'Expected a journey.'); break;
    case 'feature': object(value, ['type', 'feature']); requireSitemap(record(value.feature), 'SITEMAP_SHAPE', 'Expected a feature.'); break;
    case 'remove': object(value, ['type', 'surface', 'review']); id(value.surface); text(value.review, SITEMAP_LIMITS.reviewBytes); break;
    default: requireSitemap(false, 'SITEMAP_COMMAND', 'Unknown sitemap command.');
  }
}
function surface(design: SitemapDesign, key: string): Surface {
  const found = design.nodes.find(node => node.id === key);
  requireSitemap(found, 'SITEMAP_REFERENCE', 'The selected surface does not exist.');
  return found;
}
function move(design: SitemapDesign, change: Extract<SitemapCommand, { type: 'move' }>): void {
  const node = surface(design, change.surface);
  const parent = change.parent === null ? null : surface(design, change.parent);
  requireSitemap(node.kind !== 'view' || parent === null || parent.kind === 'group',
    'SITEMAP_PARENT', 'A native view may only be top-level or grouped.');
  requireSitemap(change.before !== change.surface, 'SITEMAP_ORDER', 'A surface cannot precede itself.');
  if (change.before !== null) requireSitemap(surface(design, change.before).parent === change.parent,
    'SITEMAP_ORDER', 'The insertion anchor is not a destination sibling.');
  node.parent = change.parent;
  design.nodes = design.nodes.filter(item => item.id !== node.id);
  let index = change.before === null ? -1 : design.nodes.findIndex(item => item.id === change.before);
  if (index < 0) {
    for (let i = 0; i < design.nodes.length; i++) if (design.nodes[i]?.parent === change.parent) index = i + 1;
    if (index < 0) index = change.parent === null ? design.nodes.length : design.nodes.findIndex(item => item.id === change.parent) + 1;
  }
  design.nodes.splice(index, 0, node);
}
function upsert<T extends { id: string }>(items: T[], candidate: T): void {
  const index = items.findIndex(item => item.id === candidate.id);
  if (index < 0) items.push(structuredClone(candidate));
  else items[index] = structuredClone(candidate);
}
function pointer(key: string): string { return key.replaceAll('~', '~0').replaceAll('/', '~1'); }
function references(value: unknown, keys: Set<string>, path: string, found: string[]): void {
  if (typeof value === 'string' && keys.has(value)) { found.push(path); return; }
  if (Array.isArray(value)) value.forEach((child, index) => references(child, keys, path + '/' + index, found));
  else if (record(value)) for (const [name, child] of Object.entries(value)) references(child, keys, path + '/' + pointer(name), found);
}

/** Reads every retained subsystem conservatively. Unowned references must be resolved by their editor. */
export function planSurfaceRemoval(design: SitemapDesign, key: string): RemovalImpact {
  validateSitemapModel(design); surface(design, key);
  const children = design.nodes.filter(node => node.parent === key).map(node => node.id);
  const links = design.links.filter(link => link.from === key || link.to === key).map(link => link.id);
  const routes = (design.sitemap?.routes ?? []).filter(route => route.surface === key).map(route => route.id);
  const journeySteps = (design.sitemap?.journeys ?? []).flatMap(journey => journey.steps
    .filter(step => step.surface === key || step.via !== null && links.includes(step.via)).map(step => journey.id + '/' + step.id));
  const features = (design.features?.items ?? []).filter(feature => feature.surfaces.includes(key)).map(feature => feature.id);
  const doomed = new Set([key, ...links, ...routes]);
  const externalReferences: string[] = [], owned = new Set(['nodes', 'links', 'canvas', 'sitemap', 'features']);
  for (const [name, value] of Object.entries(design)) if (!owned.has(name)) references(value, doomed, '/' + pointer(name), externalReferences);
  design.nodes.forEach((node, index) => {
    if (node.id === key) return;
    for (const [name, value] of Object.entries(node)) if (!['id', 'label', 'slug', 'parent'].includes(name))
      references(value, doomed, '/nodes/' + index + '/' + pointer(name), externalReferences);
  });
  if (design.canvas) for (const [name, value] of Object.entries(design.canvas)) {
    if (!['positions', 'collapsed'].includes(name)) references(value, doomed, '/canvas/' + pointer(name), externalReferences);
  }
  design.links.forEach((link, index) => {
    if (doomed.has(link.id)) return;
    for (const [name, value] of Object.entries(link)) if (!['id', 'from', 'to', 'label', 'kind'].includes(name))
      references(value, doomed, '/links/' + index + '/' + pointer(name), externalReferences);
  });
  return { surface: key, children, links, routes, journeySteps, features, externalReferences,
    canRemove: children.length === 0 && externalReferences.length === 0,
    review: key + '\n' + canonicalKey(design) };
}

function remove(design: SitemapDesign, key: string, review: string): void {
  const impact = planSurfaceRemoval(design, key);
  requireSitemap(review === impact.review, 'SITEMAP_STALE', 'Removal impact changed. Review it again.');
  requireSitemap(impact.canRemove, 'SITEMAP_REFERENCED', 'Move children and resolve external references before removing this surface.');
  const removed = surface(design, key);
  design.nodes = design.nodes.filter(node => node.id !== key);
  design.links = design.links.filter(link => !impact.links.includes(link.id));
  if (design.sitemap) {
    design.sitemap.routes = design.sitemap.routes.filter(route => route.surface !== key);
    for (const journey of design.sitemap.journeys) for (const step of journey.steps) {
      if (step.surface === key || step.via !== null && impact.links.includes(step.via)) {
        step.unresolved = true;
        step.lastKnownLabel = step.surface === key ? removed.label :
          design.nodes.find(node => node.id === step.surface)?.label ?? step.lastKnownLabel ?? step.surface;
      }
    }
  }
  for (const feature of design.features?.items ?? []) {
    feature.surfaces = feature.surfaces.filter(item => item !== key);
    feature.entryPoints = feature.entryPoints.filter(item => item !== key);
  }
  if (design.canvas) {
    delete design.canvas.positions[key];
    if (design.canvas.collapsed) design.canvas.collapsed = design.canvas.collapsed.filter(item => item !== key);
  }
}

function advanceCounter(design: SitemapDesign, key: string): void {
  const match = /^(?:node|edge)-(\d+)$/.exec(key);
  if (!match || design.nextId === undefined) return;
  const value = Number(match[1]);
  requireSitemap(Number.isSafeInteger(value) && value > 0 && value < Number.MAX_SAFE_INTEGER - 100000 &&
    typeof design.nextId === 'number' && Number.isSafeInteger(design.nextId), 'SITEMAP_LIMIT', 'Invalid identity counter.');
  design.nextId = Math.max(design.nextId, value + 1);
}

/** Applies to a detached candidate. Never mutates the input, writes storage or grants an approval. */
export function applySitemapCommand<T extends SitemapDesign>(design: T, command: unknown): T {
  validateSitemapModel(design); assertCommand(command);
  const next = structuredClone(design);
  switch (command.type) {
    case 'create':
      next.nodes.push(structuredClone(command.surface));
      advanceCounter(next, command.surface.id); break;
    case 'link':
      next.links.push(structuredClone(command.transition));
      advanceCounter(next, command.transition.id); break;
    case 'move': move(next, command); break;
    case 'rename': surface(next, command.surface).label = command.label; break;
    case 'arrange':
      requireSitemap(next.canvas, 'SITEMAP_POSITION', 'Initialize the canonical canvas through its owner before arranging.');
      for (const [key, position] of Object.entries(command.positions)) {
        surface(next, key); next.canvas.positions[key] = structuredClone(position);
      }
      break;
    case 'route': {
      next.sitemap ??= { schema: 1, routes: [], journeys: [] };
      const existing = next.sitemap.routes.find(route => route.id === command.route.id);
      requireSitemap(!existing || existing.surface === command.route.surface, 'SITEMAP_ROUTE', 'A route identity cannot be reassigned to another surface.');
      upsert(next.sitemap.routes, command.route); break;
    }
    case 'journey': next.sitemap ??= { schema: 1, routes: [], journeys: [] }; upsert(next.sitemap.journeys, command.journey); break;
    case 'feature': next.features ??= { schema: 1, items: [] }; upsert(next.features.items, command.feature); break;
    case 'remove': remove(next, command.surface, command.review); break;
  }
  validateSitemapModel(next);
  return canonicalKey(next) === canonicalKey(design) ? design : next;
}
