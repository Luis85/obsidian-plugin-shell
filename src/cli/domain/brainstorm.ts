import { applyConcept } from '../../../scripts/companion/concepts/apply.ts';
import { parseConcept, type Concept } from '../../../scripts/companion/concepts/contract.ts';
import { newSitemapSurface } from '../../../scripts/companion/sitemap/create.ts';
import { visualAllocate, visualText } from '../../../scripts/companion/visual/visual-ir.mjs';
import { object, keys, list, text } from './data.ts';
import { requireSketch, slug } from './errors.ts';
import type { SketchDocument } from './document.ts';

export type BrainstormOutput = 'definition' | 'prototype' | 'boilerplate';
export type BrainstormVerification = 'none' | 'test' | 'test-build';
export type BrainstormInteraction = { kind?: 'navigate'; label: string; target: string } | { kind: 'action'; label: string; outcome: string };
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
function readInteraction(value: unknown): BrainstormInteraction {
  const interaction = object(value); keys(interaction, ['label', 'kind', 'target', 'outcome']);
  const label = bounded(interaction.label, 'Interaction label', 120);
  const kind = interaction.kind ?? 'navigate';
  requireSketch(kind === 'navigate' || kind === 'action', 'BRAINSTORM_INTERACTION',
    'Interactions are navigation or planned actions.');
  if (kind === 'action') {
    requireSketch(interaction.target === undefined, 'BRAINSTORM_INTERACTION',
      'A planned action has an outcome, not a navigation target.');
    return { kind, label, outcome: text(interaction.outcome, 'Expected outcome', 1000) };
  }
  requireSketch(interaction.outcome === undefined, 'BRAINSTORM_INTERACTION',
    'Navigation has a target, not an action outcome.');
  return { kind, label, target: bounded(interaction.target, 'Interaction target', 80) };
}
function readPage(value: unknown, index: number): BrainstormPage {
  const page = object(value); keys(page, ['title', 'purpose', 'kind', 'interactions']);
  const title = bounded(page.title, 'Page title', 80);
  const kind = page.kind ?? (index === 0 ? 'view' : 'page');
  const valid = ['view', 'page', 'modal'].includes(String(kind)) &&
    (index === 0 ? kind === 'view' : kind !== 'view');
  requireSketch(valid, 'BRAINSTORM_PAGE_KIND',
    'The first surface must be the feature view; subsequent surfaces are pages or modals.');
  const interactions = list(page.interactions ?? [], 'interactions', 12).map(readInteraction);
  const identities = interactions.map(item => item.kind + '/' + item.label.toLowerCase());
  requireSketch(new Set(identities).size === interactions.length,
    'BRAINSTORM_DUPLICATE', 'Repeated interaction on ' + title + '.');
  return { title, purpose: text(page.purpose, 'Page purpose', 2000),
    kind: kind as BrainstormPage['kind'], interactions };
}
function validatePageReferences(pages: BrainstormPage[]): void {
  requireSketch(pages.length > 0, 'BRAINSTORM_PAGES', 'Describe at least one feature view.');
  const names = new Set(pages.map(page => page.title.toLowerCase()));
  requireSketch(names.size === pages.length, 'BRAINSTORM_DUPLICATE', 'Page titles must be unique.');
  for (const page of pages) {
    for (const interaction of page.interactions) {
      if (interaction.kind === 'action') continue;
      requireSketch(names.has(interaction.target.toLowerCase()), 'BRAINSTORM_TARGET',
        'Navigation target must name a page or modal in this feature: ' + interaction.target + '.');
    }
  }
}
function delivery(raw: Record<string, unknown>): { output: BrainstormOutput; verification: BrainstormVerification } {
  const output = raw.output ?? 'definition', verification = raw.verification ?? 'none';
  requireSketch(outputKinds.includes(output as BrainstormOutput), 'BRAINSTORM_OUTPUT',
    'Choose definition, prototype or boilerplate.');
  requireSketch(verificationKinds.includes(verification as BrainstormVerification) &&
    (output !== 'definition' || verification === 'none'), 'BRAINSTORM_VERIFICATION',
  'Verification needs generated source; choose prototype or boilerplate first.');
  return { output: output as BrainstormOutput, verification: verification as BrainstormVerification };
}
function optionalBinding(raw: Record<string, unknown>) {
  const projectId = raw.projectId === undefined ? undefined : bounded(raw.projectId, 'Project ID', 60);
  if (raw.baseSha256 !== undefined) requireSketch(typeof raw.baseSha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(raw.baseSha256), 'BRAINSTORM_BASE',
  'baseSha256 must be the inspected saved project hash.');
  return { ...(projectId === undefined ? {} : { projectId }),
    ...(raw.baseSha256 === undefined ? {} : { baseSha256: raw.baseSha256 as string }) };
}
/** One bounded, inert request contract is shared by machine clients and the terminal wizard. */
export function readFeatureBrainstorm(input: unknown): FeatureBrainstorm {
  const raw = object(input);
  keys(raw, ['schemaVersion', 'name', 'purpose', 'actors', 'entities', 'pages', 'acceptance', 'output',
    'verification', 'projectId', 'baseSha256']);
  requireSketch(raw.schemaVersion === 1, 'BRAINSTORM_VERSION', 'Expected feature brainstorm schemaVersion 1.');
  const pages = list(raw.pages, 'pages', 12).map(readPage);
  validatePageReferences(pages);
  return { schemaVersion: 1, name: bounded(raw.name, 'Feature name', 80),
    purpose: text(raw.purpose, 'Feature purpose', 2000), actors: optionalList(raw.actors, 'actors'),
    entities: optionalList(raw.entities, 'entities'), pages,
    acceptance: optionalList(raw.acceptance, 'acceptance criteria', 30),
    ...delivery(raw), ...optionalBinding(raw) };
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
    { field: 'pages[].interactions', prompt: 'Which interactions navigate to screens, or describe planned user actions and outcomes?' },
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
          interactions: { type: 'array', maxItems: 12, items: { oneOf: [
            { type: 'object', additionalProperties: false, required: ['label', 'target'],
              properties: { kind: { const: 'navigate' }, label: line(), target: line(80) } },
            { type: 'object', additionalProperties: false, required: ['kind', 'label', 'outcome'],
              properties: { kind: { const: 'action' }, label: line(), outcome: line(1000) } },
          ] } },
        } } },
      output: { enum: outputKinds, default: 'definition' },
      verification: { enum: verificationKinds, default: 'none' },
    },
    'x-semantic-validation': 'node bin/app brainstorm validate --input request.json --json',
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
type BrainstormChange = { collection: 'nodes' | 'links' | 'sitemap.routes' | 'visualDesigns.pages' | 'features.items';
  op: 'add'; id: string; value: Record<string, unknown> };
interface BuildState {
  design: SketchDocument['design']; featureId: string; used: Set<string>; serial: number;
  changes: BrainstormChange[];
  added: Map<string, { id: string; kind: BrainstormPage['kind']; slug: string }>;
  mapping: BrainstormResult['mapping']; existingRoutes: Set<string>;
}
function buildState(document: SketchDocument, request: FeatureBrainstorm): BuildState {
  const design = document.design;
  return { design, featureId: slug(request.name, 'feature', (design.features?.items ?? []).map(item => item.id)),
    used: new Set([...design.nodes.map(item => item.id), ...design.links.map(item => item.id),
      ...(design.sitemap?.routes ?? []).map(item => item.id)]), serial: design.nextId, changes: [],
    added: new Map(), mapping: [], existingRoutes: new Set((design.sitemap?.routes ?? [])
      .map(item => item.path.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ':param'))) };
}
function allocate(state: BuildState, prefix: string): string {
  const allocated = freshNumber(state.used, prefix, state.serial);
  state.serial = allocated[1]; state.design.nextId = state.serial;
  return allocated[0];
}
function routeFor(state: BuildState, surface: Record<string, unknown>): string | null {
  if (surface.kind === 'modal') return null;
  const initial = '/' + state.featureId + '/' + String(surface.slug);
  let path = initial, suffix = 2;
  while (state.existingRoutes.has(path)) path = initial + '-' + suffix++;
  state.existingRoutes.add(path);
  const record = { id: allocate(state, 'route'), surface: String(surface.id), path };
  state.design.sitemap ??= { schema: 1, routes: [], journeys: [] };
  state.design.sitemap.routes.push(record);
  state.changes.push({ collection: 'sitemap.routes', op: 'add', id: record.id, value: record });
  return path;
}
function visualFor(state: BuildState, page: BrainstormPage, surfaceId: string): void {
  const visual = state.design.visualDesigns;
  const notes = page.interactions.length ? 'Planned interactions (not implemented): ' +
    page.interactions.map(item => item.kind === 'action' ? item.label + ' => ' + item.outcome :
      item.label + ' → ' + item.target).join('; ') : 'No interactions declared yet.';
  const pageDesign = { id: visualAllocate(visual, 'vp'), ownerId: surfaceId, name: page.title,
    root: [visualText(visualAllocate(visual, 'vn'), page.title, 'h1'),
      visualText(visualAllocate(visual, 'vn'), page.purpose, 'p')],
    scenarios: [], notes: notes.slice(0, 2000) };
  visual.pages.push(pageDesign);
  state.changes.push({ collection: 'visualDesigns.pages', op: 'add', id: pageDesign.id, value: pageDesign });
}
function addSurface(state: BuildState, page: BrainstormPage, index: number, firstTitle: string): void {
  const parent = page.kind === 'page' ? state.added.get(firstTitle.toLowerCase())!.id : null;
  const surface = newSitemapSurface(state.design, page.title, page.kind, parent);
  surface.id = allocate(state, 'node'); surface.goal = page.purpose;
  surface.entry = index === 0 && !state.design.nodes.some(node => node.entry);
  state.design.nodes.push(surface);
  state.added.set(page.title.toLowerCase(), { id: surface.id, kind: page.kind, slug: surface.slug! });
  state.changes.push({ collection: 'nodes', op: 'add', id: surface.id, value: surface });
  const path = routeFor(state, surface);
  visualFor(state, page, surface.id);
  state.mapping.push({ title: page.title, surfaceId: surface.id, route: path });
}
function addTransitions(state: BuildState, pages: BrainstormPage[]): void {
  for (const page of pages) {
    for (const interaction of page.interactions) {
      if (interaction.kind === 'action') continue;
      const from = state.added.get(page.title.toLowerCase())!, to = state.added.get(interaction.target.toLowerCase())!;
      const transition = { id: allocate(state, 'edge'), from: from.id, to: to.id,
        kind: to.kind === 'modal' ? 'open' : 'navigate', label: interaction.label };
      state.design.links.push(transition);
      state.changes.push({ collection: 'links', op: 'add', id: transition.id, value: transition });
    }
  }
}
function addFeatureOwner(state: BuildState, request: FeatureBrainstorm): void {
  const owned = request.pages.map(page => state.added.get(page.title.toLowerCase())!.id);
  const owner = { id: state.featureId, name: request.name, surfaces: owned, entryPoints: [owned[0]!],
    components: [], requirements: [], dependsOn: [] };
  state.changes.push({ collection: 'features.items', op: 'add', id: state.featureId, value: owner });
}
function definition(request: FeatureBrainstorm, current: { document: SketchDocument; sha256: string },
  state: BuildState): Record<string, unknown> {
  return { kind: 'shell-feature-definition', schemaVersion: 1, status: 'draft',
    projectId: current.document.project.id, baseSha256: current.sha256, featureId: state.featureId,
    feature: request, mapping: state.mapping, acceptance: 'not-verified', execution: 'not-run',
    limits: ['Descriptive entities and actors are not schema implementations.',
      'Navigation and planned action outcomes are not completed event handlers.',
      'Generated code does not imply native Companion feature acceptance.'] };
}
/** Builds canonical v6 additive records only; applyConcept supplies ownership and reference validation. */
export function featureConcept(request: FeatureBrainstorm, current: { document: SketchDocument; sha256: string }): BrainstormResult {
  requireSketch(!request.projectId || request.projectId === current.document.project.id,
    'BRAINSTORM_PROJECT', 'The brainstorm targets a different project.');
  requireSketch(!request.baseSha256 || request.baseSha256 === current.sha256,
    'BRAINSTORM_STALE', 'Project bytes changed; inspect a new base before continuing.');
  const working = structuredClone(current.document), state = buildState(working, request);
  request.pages.forEach((page, index) => addSurface(state, page, index, request.pages[0]!.title));
  addTransitions(state, request.pages); addFeatureOwner(state, request);
  const concept = parseConcept(JSON.stringify({
    kind: 'obsidian-companion-concept', schemaVersion: 1, id: state.featureId + '-brainstorm',
    mode: 'feature', projectId: current.document.project.id, baseSha256: current.sha256,
    references: [], changes: state.changes,
  }));
  const candidate = applyConcept(concept, current).document as SketchDocument;
  return { concept, candidate, mapping: state.mapping, definition: definition(request, current, state) };
}
