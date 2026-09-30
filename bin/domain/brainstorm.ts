import { applyConcept } from '../../scripts/companion/concepts/apply.ts';
import { parseConcept, type Concept } from '../../scripts/companion/concepts/contract.ts';
import { newSitemapSurface } from '../../scripts/companion/sitemap/create.ts';
import { visualAllocate, visualText } from '../../scripts/companion/visual/visual-ir.mjs';
import { object, keys, list, text } from './data.ts';
import { requireSketch, slug } from './errors.ts';
import type { SketchDocument } from './document.ts';

export type BrainstormOutput = 'definition' | 'prototype' | 'boilerplate';
export type BrainstormVerification = 'none' | 'test' | 'test-build';
export interface BrainstormInteraction { label: string; target: string }
export interface BrainstormPage {
  title: string; purpose: string; kind: 'view' | 'page' | 'modal';
  interactions: BrainstormInteraction[];
}
export interface FeatureBrainstorm {
  schemaVersion: 1; name: string; purpose: string; actors: string[]; entities: string[];
  pages: BrainstormPage[]; acceptance: string[]; output: BrainstormOutput;
  verification: BrainstormVerification; projectId?: string; baseSha256?: string;
}
const outputKinds: BrainstormOutput[] = ['definition', 'prototype', 'boilerplate'];
const verificationKinds: BrainstormVerification[] = ['none', 'test', 'test-build'];

function bounded(value: unknown, label: string, max: number): string {
  const result = text(value, label, max);
  requireSketch(!/[\r\n]/.test(result), 'BRAINSTORM_TEXT', label + ' must use one line.');
  return result;
}
function optionalList(value: unknown, label: string, maxItems = 20): string[] {
  const result = list(value ?? [], label, maxItems).map(item => bounded(item, label, 120));
  requireSketch(new Set(result.map(item => item.toLowerCase())).size === result.length,
    'BRAINSTORM_DUPLICATE', 'Duplicate ' + label + '.');
  return result;
}
/** One bounded, inert request contract is shared by machine clients and the terminal wizard. */
export function readFeatureBrainstorm(input: unknown): FeatureBrainstorm {
  const raw = object(input);
  keys(raw, ['schemaVersion', 'name', 'purpose', 'actors', 'entities', 'pages', 'acceptance', 'output',
    'verification', 'projectId', 'baseSha256']);
  requireSketch(raw.schemaVersion === 1, 'BRAINSTORM_VERSION', 'Expected feature brainstorm schemaVersion 1.');
  const name = bounded(raw.name, 'Feature name', 80);
  const purpose = text(raw.purpose, 'Feature purpose', 2000);
  const actors = optionalList(raw.actors, 'actors');
  const entities = optionalList(raw.entities, 'entities');
  const acceptance = optionalList(raw.acceptance, 'acceptance criteria', 30);
  const pages = list(raw.pages, 'pages', 12).map((item, index) => {
    const page = object(item); keys(page, ['title', 'purpose', 'kind', 'interactions']);
    const title = bounded(page.title, 'Page title', 80);
    const kind = page.kind ?? (index === 0 ? 'view' : 'page');
    requireSketch(['view', 'page', 'modal'].includes(String(kind)) && (index !== 0 || kind === 'view') &&
      (index === 0 || kind !== 'view'), 'BRAINSTORM_PAGE_KIND',
    'The first surface must be the feature view; subsequent surfaces are pages or modals.');
    const interactions = list(page.interactions ?? [], 'interactions', 12).map(item => {
      const interaction = object(item); keys(interaction, ['label', 'target']);
      return { label: bounded(interaction.label, 'Interaction label', 120),
        target: bounded(interaction.target, 'Interaction target', 80) };
    });
    requireSketch(new Set(interactions.map(item => item.label.toLowerCase() + '/' + item.target.toLowerCase())).size === interactions.length,
      'BRAINSTORM_DUPLICATE', 'Repeated interaction on ' + title + '.');
    return { title, purpose: text(page.purpose, 'Page purpose', 2000), kind: kind as BrainstormPage['kind'], interactions };
  });
  requireSketch(pages.length > 0, 'BRAINSTORM_PAGES', 'Describe at least one feature view.');
  const names = new Set(pages.map(page => page.title.toLowerCase()));
  requireSketch(names.size === pages.length, 'BRAINSTORM_DUPLICATE', 'Page titles must be unique.');
  for (const page of pages) for (const interaction of page.interactions)
    requireSketch(names.has(interaction.target.toLowerCase()), 'BRAINSTORM_TARGET',
      'Interaction target must name a page or modal in this feature: ' + interaction.target + '.');
  const output = raw.output ?? 'definition', verification = raw.verification ?? 'none';
  requireSketch(outputKinds.includes(output as BrainstormOutput), 'BRAINSTORM_OUTPUT', 'Choose definition, prototype or boilerplate.');
  requireSketch(verificationKinds.includes(verification as BrainstormVerification) &&
    (output !== 'definition' || verification === 'none'), 'BRAINSTORM_VERIFICATION',
  'Verification needs generated source; choose prototype or boilerplate first.');
  if (raw.projectId !== undefined) bounded(raw.projectId, 'Project ID', 60);
  if (raw.baseSha256 !== undefined) requireSketch(typeof raw.baseSha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(raw.baseSha256), 'BRAINSTORM_BASE', 'baseSha256 must be the inspected saved project hash.');
  return { schemaVersion: 1, name, purpose, actors, entities, pages, acceptance,
    output: output as BrainstormOutput, verification: verification as BrainstormVerification,
    ...(raw.projectId === undefined ? {} : { projectId: raw.projectId as string }),
    ...(raw.baseSha256 === undefined ? {} : { baseSha256: raw.baseSha256 as string }) };
}

export const brainstormGuide = Object.freeze({
  schemaVersion: 1, useCases: { feature: 'available', project: 'planned' },
  questions: [
    { field: 'name', prompt: 'What is the name of the new feature?' },
    { field: 'purpose', prompt: 'What problem does this feature solve, and what is its purpose?' },
    { field: 'actors', prompt: 'Who will use or interact with it?' },
    { field: 'entities', prompt: 'Which business or domain entities are involved? (Planning only.)' },
    { field: 'pages', prompt: 'Which screens and dialogs are needed? Start with the main feature view.' },
    { field: 'pages[].purpose', prompt: 'What does the user accomplish on each screen?' },
    { field: 'pages[].interactions', prompt: 'Which actions navigate between these screens or open dialogs?' },
    { field: 'acceptance', prompt: 'How will you recognize the feature as useful and correct?' },
    { field: 'output', prompt: 'Save a definition only, compile a prototype, or compile boilerplate?' },
    { field: 'verification', prompt: 'Skip execution, test, or test and build? Requires separate execution approval.' },
  ],
  next: 'Use brainstorm context, brainstorm schema, brainstorm validate and brainstorm feature.',
  limitation: 'Actors, entities, acceptance and event triggers are descriptive until modeled in the appropriate canonical editors.',
});
export function brainstormSchema() {
  const line = (limit = 120) => ({ type: 'string', minLength: 1, maxLength: limit });
  return { $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'Feature brainstorm request v1',
    type: 'object', additionalProperties: false, required: ['schemaVersion', 'name', 'purpose', 'pages'],
    properties: { schemaVersion: { const: 1 }, name: line(80), purpose: line(2000),
      projectId: line(60), baseSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      actors: { type: 'array', maxItems: 20, uniqueItems: true, items: line() },
      entities: { type: 'array', maxItems: 20, uniqueItems: true, items: line() },
      acceptance: { type: 'array', maxItems: 30, uniqueItems: true, items: line() },
      pages: { type: 'array', minItems: 1, maxItems: 12, items: { type: 'object', additionalProperties: false,
        required: ['title', 'purpose'], properties: { title: line(80), purpose: line(2000),
          kind: { enum: ['view', 'page', 'modal'] },
          interactions: { type: 'array', maxItems: 12, items: { type: 'object', additionalProperties: false,
            required: ['label', 'target'], properties: { label: line(), target: line(80) } } },
        } } },
      output: { enum: outputKinds, default: 'definition' },
      verification: { enum: verificationKinds, default: 'none' },
    },
    'x-semantic-validation': 'node shell.mjs brainstorm validate --input request.json --json',
  };
}
function freshNumber(used: Set<string>, prefix: string, start: number): [string, number] {
  let serial = start;
  while (used.has(prefix + '-' + serial)) serial++;
  const id = prefix + '-' + serial; used.add(id);
  return [id, serial + 1];
}
export interface BrainstormResult {
  concept: Concept;
  candidate: SketchDocument;
  definition: Record<string, unknown>;
  mapping: { title: string; surfaceId: string; route: string | null }[];
}
/** Builds canonical v6 additive records only; applyConcept supplies ownership and reference validation. */
export function featureConcept(request: FeatureBrainstorm, current: { document: SketchDocument; sha256: string }): BrainstormResult {
  requireSketch(!request.projectId || request.projectId === current.document.project.id,
    'BRAINSTORM_PROJECT', 'The brainstorm targets a different project.');
  requireSketch(!request.baseSha256 || request.baseSha256 === current.sha256,
    'BRAINSTORM_STALE', 'Project bytes changed; inspect a new base before continuing.');
  const working = structuredClone(current.document), design = working.design;
  const featureId = slug(request.name, 'feature', (design.features?.items ?? []).map(item => item.id));
  const used = new Set([...design.nodes.map(item => item.id), ...design.links.map(item => item.id),
    ...(design.sitemap?.routes ?? []).map(item => item.id)]);
  let serial = design.nextId;
  const changes: Array<{ collection: 'nodes' | 'links' | 'sitemap.routes' | 'visualDesigns.pages' | 'features.items';
    op: 'add'; id: string; value: Record<string, unknown> }> = [];
  const added = new Map<string, { id: string; kind: BrainstormPage['kind']; slug: string }>();
  const mapping: BrainstormResult['mapping'] = [];
  const existingRoutes = new Set((design.sitemap?.routes ?? []).map(item => item.path.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ':param')));
  for (const [index, page] of request.pages.entries()) {
    const kind = page.kind, parent = kind === 'page' ? added.get(request.pages[0]!.title.toLowerCase())!.id : null;
    // Use the canonical sitemap factory for placement/host defaults and collision-safe slugs.
    const surface = newSitemapSurface(design, page.title, kind, parent);
    // Do not collide with link/route IDs even if imported designs used another allocation scheme.
    const allocated = freshNumber(used, 'node', serial); surface.id = allocated[0]; serial = allocated[1];
    surface.goal = page.purpose;
    surface.entry = index === 0 && !design.nodes.some(node => node.entry);
    design.nodes.push(surface);
    design.nextId = serial;
    added.set(page.title.toLowerCase(), { id: surface.id, kind, slug: surface.slug! });
    changes.push({ collection: 'nodes', op: 'add', id: surface.id, value: surface });
    let path: string | null = null;
    if (kind !== 'modal') {
      const initial = '/' + featureId + '/' + surface.slug;
      path = initial; let suffix = 2;
      while (existingRoutes.has(path)) path = initial + '-' + suffix++;
      existingRoutes.add(path);
      const route = freshNumber(used, 'route', serial); serial = route[1];
      const record = { id: route[0], surface: surface.id, path };
      design.sitemap ??= { schema: 1, routes: [], journeys: [] };
      design.sitemap.routes.push(record);
      changes.push({ collection: 'sitemap.routes', op: 'add', id: record.id, value: record });
    }
    const visual = design.visualDesigns;
    const heading = visualText(visualAllocate(visual, 'vn'), page.title, 'h1');
    const explanation = visualText(visualAllocate(visual, 'vn'), page.purpose, 'p');
    const notes = page.interactions.length ? 'Planned navigation: ' +
      page.interactions.map(item => item.label + ' → ' + item.target).join('; ') : 'No navigation declared yet.';
    const pageDesign = { id: visualAllocate(visual, 'vp'), ownerId: surface.id, name: page.title,
      root: [heading, explanation], scenarios: [], notes: notes.slice(0, 2000) };
    visual.pages.push(pageDesign);
    changes.push({ collection: 'visualDesigns.pages', op: 'add', id: pageDesign.id, value: pageDesign });
    mapping.push({ title: page.title, surfaceId: surface.id, route: path });
  }
  for (const page of request.pages) {
    for (const interaction of page.interactions) {
      const from = added.get(page.title.toLowerCase())!, to = added.get(interaction.target.toLowerCase())!;
      const allocated = freshNumber(used, 'edge', serial); serial = allocated[1];
      const transition = { id: allocated[0], from: from.id, to: to.id,
        kind: to.kind === 'modal' ? 'open' : 'navigate', label: interaction.label };
      design.links.push(transition);
      changes.push({ collection: 'links', op: 'add', id: transition.id, value: transition });
    }
  }
  const owned = request.pages.map(page => added.get(page.title.toLowerCase())!.id);
  const owner = { id: featureId, name: request.name, surfaces: owned, entryPoints: [owned[0]!],
    components: [], requirements: [], dependsOn: [] };
  changes.push({ collection: 'features.items', op: 'add', id: featureId, value: owner });
  const concept = parseConcept(JSON.stringify({
    kind: 'obsidian-companion-concept', schemaVersion: 1, id: featureId + '-brainstorm',
    mode: 'feature', projectId: current.document.project.id, baseSha256: current.sha256,
    references: [], changes,
  }));
  const candidate = applyConcept(concept, current).document as SketchDocument;
  return { concept, candidate, mapping,
    definition: { kind: 'shell-feature-definition', schemaVersion: 1, status: 'draft',
      projectId: current.document.project.id, baseSha256: current.sha256, featureId,
      feature: request, mapping, acceptance: 'not-verified', execution: 'not-run',
      limits: ['Descriptive entities and actors are not schema implementations.',
        'Transitions define navigation, not completed event handlers.',
        'Generated code does not imply native Companion feature acceptance.'] } };
}
