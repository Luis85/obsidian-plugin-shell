import type { FeatureExtension, SitemapDesign, SitemapExtension } from './model.ts';
import { SITEMAP_LIMITS } from './model.ts';
import { distinct, id, ids, list, object, record, requireSitemap, text } from './safety.ts';

export function validateSitemapExtension(value: unknown, design: SitemapDesign): asserts value is SitemapExtension {
  object(value, ['schema', 'routes', 'journeys']);
  requireSitemap(value.schema === 1, 'SITEMAP_VERSION', 'Unsupported sitemap subsystem schema.');
  list(value.routes, SITEMAP_LIMITS.routes);
  list(value.journeys, SITEMAP_LIMITS.journeys);
  const surfaces = new Map(design.nodes.map(n => [n.id, n]));
  const links = new Map(design.links.map(l => [l.id, l]));
  const routeIds: string[] = [], paths: string[] = [], owners: string[] = [], journeyIds: string[] = [];
  for (const route of value.routes) {
    object(route, ['id', 'surface', 'path']); id(route.id); id(route.surface); text(route.path, 240);
    requireSitemap(/^\/(?:(?:[A-Za-z0-9_-]+|:[A-Za-z_][A-Za-z0-9_]*)(?:\/(?:[A-Za-z0-9_-]+|:[A-Za-z_][A-Za-z0-9_]*))*)?$/.test(route.path),
      'SITEMAP_ROUTE', 'Use a local path with optional named parameter segments, without queries, fragments or encoded segments.');
    requireSitemap(['view', 'page'].includes(surfaces.get(route.surface)?.kind ?? ''),
      'SITEMAP_ROUTE', 'A route must reference a native view or an internal page.');
    const pathKey = route.path.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ':param');
    const parameters = route.path.split('/').filter(segment => segment.startsWith(':'));
    distinct(parameters, 'route parameters');
    requireSitemap(!paths.includes(pathKey) && !owners.includes(route.surface),
      'SITEMAP_ROUTE', 'Each path and routed surface must be unique.');
    routeIds.push(route.id); paths.push(pathKey); owners.push(route.surface);
  }
  distinct(routeIds, 'routes');
  let totalSteps = 0;
  for (const journey of value.journeys) {
    object(journey, ['id', 'name', 'steps']); id(journey.id); text(journey.name); journeyIds.push(journey.id);
    list(journey.steps, SITEMAP_LIMITS.steps); totalSteps += journey.steps.length;
    requireSitemap(totalSteps <= SITEMAP_LIMITS.totalSteps, 'SITEMAP_LIMIT', 'Too many journey steps.');
    const stepIds: string[] = [];
    let previous: { surface: string; unresolved: boolean } | null = null;
    for (const step of journey.steps) {
      object(step, ['id', 'surface', 'via', 'unresolved', 'lastKnownLabel'], ['id', 'surface', 'via']);
      id(step.id); id(step.surface); stepIds.push(step.id);
      if (step.via !== null) id(step.via);
      requireSitemap(step.unresolved === undefined || step.unresolved === true, 'SITEMAP_SHAPE', 'Only explicit unresolved references are supported.');
      if (step.lastKnownLabel !== undefined) text(step.lastKnownLabel);
      requireSitemap(step.unresolved !== true || typeof step.lastKnownLabel === 'string',
        'SITEMAP_JOURNEY', 'Unresolved steps require a last-known label.');
      requireSitemap(previous !== null || step.via === null, 'SITEMAP_JOURNEY', 'The first step has no incoming transition.');
      if (step.unresolved !== true) {
        requireSitemap(surfaces.has(step.surface) && surfaces.get(step.surface)?.kind !== 'group',
          'SITEMAP_JOURNEY', 'Journey target is missing or structural-only.');
        if (step.via !== null) {
          const transition = links.get(step.via);
          requireSitemap(transition && transition.from === previous?.surface && transition.to === step.surface &&
            ['navigate', 'open', 'conditional'].includes(transition.kind),
          'SITEMAP_JOURNEY', 'The incoming transition must connect consecutive steps in its declared direction.');
        }
      }
      previous = { surface: step.surface, unresolved: step.unresolved === true };
    }
    distinct(stepIds, 'journey steps');
  }
  distinct(journeyIds, 'journeys');
}

function catalogIds(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.filter(record).map(row => row.id).filter((key): key is string => typeof key === 'string'));
}
export function validateFeatureExtension(value: unknown, design: SitemapDesign): asserts value is FeatureExtension {
  object(value, ['schema', 'items']);
  requireSitemap(value.schema === 1, 'SITEMAP_VERSION', 'Unsupported feature subsystem schema.');
  list(value.items, SITEMAP_LIMITS.features);
  const featureIds: string[] = [], owners = new Set<string>(), graph = new Map<string, string[]>();
  const surfaceIds = new Set(design.nodes.map(n => n.id)), componentIds = catalogIds(design.library);
  const requirementIds = new Set<string>();
  if (Array.isArray(design.prds)) for (const prd of design.prds) {
    if (record(prd)) for (const key of catalogIds(prd.requirements)) requirementIds.add(key);
  }
  for (const feature of value.items) {
    object(feature, ['id', 'name', 'surfaces', 'entryPoints', 'components', 'requirements', 'dependsOn']);
    id(feature.id); text(feature.name); featureIds.push(feature.id);
    ids(feature.surfaces, SITEMAP_LIMITS.nodes); ids(feature.entryPoints, SITEMAP_LIMITS.nodes);
    ids(feature.components, 200); ids(feature.requirements, 1200); ids(feature.dependsOn, SITEMAP_LIMITS.features);
    for (const surface of feature.surfaces) {
      requireSitemap(surfaceIds.has(surface) && !owners.has(surface), 'SITEMAP_FEATURE', 'Each owned surface must exist and belong to one feature.');
      owners.add(surface);
    }
    const ownedSurfaces = feature.surfaces;
    requireSitemap(feature.entryPoints.every(key => ownedSurfaces.includes(key) &&
      design.nodes.find(n => n.id === key)?.kind !== 'group'), 'SITEMAP_FEATURE', 'Feature entries must be owned executable surfaces.');
    requireSitemap(feature.components.every(key => componentIds.has(key)) && feature.requirements.every(key => requirementIds.has(key)),
      'SITEMAP_FEATURE', 'A component or requirement reference is missing.');
    graph.set(feature.id, feature.dependsOn);
  }
  distinct(featureIds, 'features');
  const complete = new Set<string>(), active = new Set<string>();
  const visit = (key: string): void => {
    requireSitemap(graph.has(key), 'SITEMAP_FEATURE', 'Feature dependency does not exist.');
    requireSitemap(!active.has(key), 'SITEMAP_CYCLE', 'Feature dependencies contain a cycle.');
    if (complete.has(key)) return;
    active.add(key);
    for (const dependency of graph.get(key) ?? []) visit(dependency);
    active.delete(key); complete.add(key);
  };
  featureIds.forEach(visit);
}
