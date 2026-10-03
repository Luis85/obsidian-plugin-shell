import type { SitemapDesign, SitemapFinding } from './model.ts';
import { SITEMAP_LIMITS } from './model.ts';
import { assertJson, distinct, id, list, sitemapObject as object, record, requireSitemap, sitemapText as text } from './safety.ts';
import { validateFeatureExtension, validateSitemapExtension } from './extension.ts';
import { validateSurfaceAcceptance } from './acceptance.ts';

function assertDesign(value: unknown): asserts value is SitemapDesign {
  requireSitemap(record(value), 'SITEMAP_SHAPE', 'Expected the canonical design object.');
  list(value.nodes, SITEMAP_LIMITS.nodes); list(value.links, SITEMAP_LIMITS.links);
  const parents = new Map<string, string | null>(), kinds = new Map<string, string>();
  const surfaceIds: string[] = [], linkIds: string[] = [];
  for (const node of value.nodes) {
    requireSitemap(record(node), 'SITEMAP_SHAPE', 'Expected a surface record.');
    id(node.id); text(node.label);
    requireSitemap(['view', 'page', 'group', 'modal', 'settings', 'action'].includes(String(node.kind)),
      'SITEMAP_SHAPE', 'Unsupported surface kind.');
    if (node.parent !== null) id(node.parent);
    if (node.slug !== undefined) text(node.slug, 120, false);
    for (const key of ['nav', 'entry']) requireSitemap(node[key] === undefined || typeof node[key] === 'boolean',
      'SITEMAP_SHAPE', 'Surface flags must be booleans.');
    if (node.acceptance !== undefined) validateSurfaceAcceptance(node.acceptance);
    surfaceIds.push(node.id); parents.set(node.id, node.parent); kinds.set(node.id, String(node.kind));
  }
  distinct(surfaceIds, 'surfaces');
  for (const key of surfaceIds) {
    const parent = parents.get(key) ?? null, kind = kinds.get(key);
    requireSitemap(parent === null || parents.has(parent), 'SITEMAP_REFERENCE', 'A parent surface is missing.');
    requireSitemap(parent === null || !['modal', 'settings', 'action'].includes(kinds.get(parent) ?? ''),
      'SITEMAP_PARENT', 'Dialogs, settings and actions cannot contain sitemap surfaces.');
    requireSitemap(kind !== 'view' || parent === null || kinds.get(parent) === 'group',
      'SITEMAP_PARENT', 'A native view may only be top-level or grouped.');
    const seen = new Set<string>(); let cursor: string | null = key, hasView = false;
    while (cursor !== null) {
      requireSitemap(!seen.has(cursor), 'SITEMAP_CYCLE', 'Containment contains a cycle.');
      seen.add(cursor); hasView ||= kinds.get(cursor) === 'view'; cursor = parents.get(cursor) ?? null;
    }
    requireSitemap(kind !== 'page' || hasView, 'SITEMAP_PARENT', 'An internal page must belong to a native view.');
  }
  for (const link of value.links) {
    requireSitemap(record(link), 'SITEMAP_SHAPE', 'Expected a transition record.');
    id(link.id); id(link.from); id(link.to); text(link.label); text(link.kind, 80);
    requireSitemap(parents.has(link.from) && parents.has(link.to), 'SITEMAP_REFERENCE', 'A transition endpoint is missing.');
    requireSitemap(kinds.get(link.from) !== 'group' && kinds.get(link.to) !== 'group',
      'SITEMAP_REFERENCE', 'Structural groups cannot be transition endpoints.');
    linkIds.push(link.id);
  }
  distinct(linkIds, 'transitions');
  if (value.canvas !== undefined) {
    requireSitemap(record(value.canvas) && record(value.canvas.positions), 'SITEMAP_SHAPE', 'Expected canonical canvas positions.');
    for (const [key, position] of Object.entries(value.canvas.positions)) {
      id(key); object(position, ['x', 'y']);
      requireSitemap(typeof position.x === 'number' && typeof position.y === 'number' &&
        Math.abs(position.x) <= SITEMAP_LIMITS.coordinate && Math.abs(position.y) <= SITEMAP_LIMITS.coordinate,
      'SITEMAP_POSITION', 'Position exceeds the finite world bound.');
    }
    requireSitemap(Object.keys(value.canvas.positions).length <= SITEMAP_LIMITS.nodes, 'SITEMAP_LIMIT', 'Too many stored positions.');
    if (value.canvas.collapsed !== undefined) {
      list(value.canvas.collapsed, SITEMAP_LIMITS.nodes); value.canvas.collapsed.forEach(id);
    }
  }
}

/** Validates sitemap structure only. The caller must still validate the complete project before persistence. */
export function validateSitemapModel(value: unknown): SitemapDesign {
  assertJson(value); assertDesign(value);
  if (value.sitemap !== undefined) validateSitemapExtension(value.sitemap, value);
  if (value.features !== undefined) validateFeatureExtension(value.features, value);
  return value;
}

export function inspectSitemap(design: SitemapDesign): SitemapFinding[] {
  validateSitemapModel(design);
  const findings: SitemapFinding[] = [], links = new Map(design.links.map(link => [link.id, link]));
  for (const journey of design.sitemap?.journeys ?? []) {
    journey.steps.forEach((step, index) => {
      const add = (code: SitemapFinding['code'], message: string): void => { findings.push({ code, journey: journey.id, step: step.id, message }); };
      if (step.unresolved) add('JOURNEY_UNRESOLVED', 'Resolve this explicitly retained planning reference before generation.');
      else if (index > 0 && (step.via === null || journey.steps[index - 1]?.unresolved))
        add('JOURNEY_TRANSITION_REQUIRED', 'Select a declared transition from the preceding resolved step.');
      else if (step.via && links.get(step.via)?.kind === 'conditional')
        add('JOURNEY_CONDITION_UNIMPLEMENTED', 'A prose condition is not an executable predicate.');
    });
  }
  return findings;
}
