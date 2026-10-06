import type { SitemapDesign, Transition } from './model.ts';
import { canonicalKey, record, requireSitemap } from './safety.ts';
import { validateSitemapModel } from './validate.ts';

type RecordKind = 'transition' | 'route' | 'journey';
export interface RecordRemoval { kind: RecordKind; id: string; label: string; references: string[]; journeySteps: string[]; review: string; canRemove: boolean }
function scan(value: unknown, id: string, path: string, found: string[]): void {
  if (value === id) found.push(path);
  else if (Array.isArray(value)) value.forEach((item, index) => scan(item, id, `${path}/${index}`, found));
  else if (record(value)) for (const [key, item] of Object.entries(value)) scan(item, id, `${path}/${key.replaceAll('~','~0').replaceAll('/','~1')}`, found);
}
/** External subsystems are never silently rewritten. Journey link history is deliberately retained unresolved. */
export function planRecordRemoval(design: SitemapDesign, kind: RecordKind, id: string): RecordRemoval {
  validateSitemapModel(design);
  requireSitemap(['transition','route','journey'].includes(kind), 'SITEMAP_COMMAND', 'Unknown record kind.');
  const item = kind === 'transition' ? design.links.find(item => item.id === id) : kind === 'route'
    ? design.sitemap?.routes.find(item => item.id === id) : design.sitemap?.journeys.find(item => item.id === id);
  requireSitemap(item, 'SITEMAP_REFERENCE', 'The selected record no longer exists.');
  const references: string[] = [];
  for (const [key, value] of Object.entries(design)) {
    if (key === 'sitemap') continue;
    if (key === 'links' && kind === 'transition') scan(design.links.filter(link => link.id !== id), id, '/links', references);
    else scan(value, id, '/' + key, references);
  }
  // Own journey identity/steps can be removed. Other journey metadata is not an unowned reference.
  const journeySteps = kind === 'transition' ? (design.sitemap?.journeys ?? []).flatMap(journey =>
    journey.steps.filter(step => step.via === id).map(step => journey.id + '/' + step.id)) : [];
  return { kind, id, label: 'label' in item ? String(item.label) : 'name' in item ? String(item.name) : String((item as {path:string}).path),
    references, journeySteps, review: `${kind}:${id}\n${canonicalKey(design)}`, canRemove: references.length === 0 };
}
/** Mutates only an already detached candidate inside the command transaction. */
export function removeSitemapRecord(design: SitemapDesign, kind: RecordKind, id: string, review: string): void {
  const plan = planRecordRemoval(design, kind, id);
  requireSitemap(plan.review === review, 'SITEMAP_STALE', 'Removal impact changed. Review it again.');
  requireSitemap(plan.canRemove, 'SITEMAP_REFERENCED', 'Resolve the listed external references before removing this record.');
  if (kind === 'transition') {
    design.links = design.links.filter(link => link.id !== id);
    for (const journey of design.sitemap?.journeys ?? []) for (const step of journey.steps) if (step.via === id) {
      step.unresolved = true; step.lastKnownLabel = design.nodes.find(node => node.id === step.surface)?.label ?? step.lastKnownLabel ?? step.surface;
    }
  } else if (design.sitemap && kind === 'route') design.sitemap.routes = design.sitemap.routes.filter(route => route.id !== id);
  else if (design.sitemap) design.sitemap.journeys = design.sitemap.journeys.filter(journey => journey.id !== id);
}
export function editSitemapTransition(design: SitemapDesign, candidate: Transition): void {
  const index = design.links.findIndex(link => link.id === candidate.id);
  requireSitemap(index >= 0, 'SITEMAP_REFERENCE', 'The selected action no longer exists.');
  requireSitemap(design.links[index]!.from === candidate.from, 'SITEMAP_REFERENCE', 'An action identity cannot be reassigned to another source.');
  design.links[index] = structuredClone(candidate);
  for (const journey of design.sitemap?.journeys ?? []) journey.steps.forEach((step, at) => {
    if (step.via !== candidate.id || step.unresolved) return;
    if (journey.steps[at-1]?.surface !== candidate.from || step.surface !== candidate.to || !['navigate','open','conditional'].includes(candidate.kind)) {
      step.unresolved = true; step.lastKnownLabel = design.nodes.find(node => node.id === step.surface)?.label ?? step.surface;
    }
  });
}
