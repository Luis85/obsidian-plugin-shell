import type { JourneyStep, SitemapDesign, SitemapJourney, Transition } from './model.ts';
import { SITEMAP_LIMITS } from './model.ts';
import { assertJson, id, record, requireSitemap, sitemapObject as object, sitemapText } from './safety.ts';
import { validateSitemapModel } from './validate.ts';

/** Ephemeral editor state only. The counter is never exported into the project. */
export interface JourneyDraft { journey: SitemapJourney; nextStep: number }
export type JourneyEdit =
  | { type: 'append'; surface: string }
  | { type: 'surface'; step: string; surface: string }
  | { type: 'transition'; step: string; via: string | null }
  | { type: 'move'; step: string; offset: -1 | 1 }
  | { type: 'remove'; step: string };
const stepNumber = (step: JourneyStep): number => Number(/^step-([1-9][0-9]*)$/.exec(step.id)?.[1] ?? 0);

/** Multiple outgoing actions are alternatives, not an implicit first-match routing policy. */
export function journeyStepTransitions(design: SitemapDesign, steps: readonly JourneyStep[], index: number): Transition[] {
  const previous = steps[index - 1], current = steps[index];
  if (!previous || !current || previous.unresolved || current.unresolved) return [];
  return design.links.filter(link => link.from === previous.surface && link.to === current.surface &&
    ['navigate', 'open', 'conditional'].includes(link.kind));
}

export function beginJourneyDraft(design: SitemapDesign, existingId?: string): JourneyDraft {
  validateSitemapModel(design);
  const journeys = design.sitemap?.journeys ?? [];
  const existing = existingId === undefined ? undefined : journeys.find(journey => journey.id === existingId);
  requireSitemap(existingId === undefined || existing, 'SITEMAP_REFERENCE', 'The selected journey no longer exists.');
  let ordinal = 1; while (journeys.some(journey => journey.id === 'journey-' + ordinal)) ordinal++;
  const journey = existing ? structuredClone(existing) : { id: 'journey-' + ordinal, name: '', steps: [] };
  const nextStep = Math.max(0, ...journey.steps.map(stepNumber)) + 1;
  requireSitemap(Number.isSafeInteger(nextStep), 'SITEMAP_LIMIT', 'Journey step identities exceed the supported bound.');
  return { journey, nextStep };
}

function validateDraft(design: SitemapDesign, draft: JourneyDraft): void {
  assertJson(draft); object(draft, ['journey', 'nextStep']);
  requireSitemap(record(draft.journey), 'SITEMAP_SHAPE', 'Expected a journey draft.');
  sitemapText(draft.journey.name, 120, false);
  requireSitemap(Number.isSafeInteger(draft.nextStep) && draft.nextStep > 0 && draft.nextStep < Number.MAX_SAFE_INTEGER,
    'SITEMAP_LIMIT', 'Invalid journey step counter.');
  // Empty titles are allowed while typing. All other canonical constraints stay active.
  const journey = { ...draft.journey, name: draft.journey.name || 'Untitled draft' };
  const sitemap = design.sitemap ?? { schema: 1, routes: [], journeys: [] };
  validateSitemapModel({ ...design, sitemap: { ...sitemap, journeys: [
    ...sitemap.journeys.filter(item => item.id !== journey.id), journey,
  ] } });
  requireSitemap(draft.journey.steps.every(step => stepNumber(step) < draft.nextStep),
    'SITEMAP_LIMIT', 'Journey step counter would reuse an identity.');
}
function assertEdit(value: unknown): asserts value is JourneyEdit {
  assertJson(value); requireSitemap(record(value), 'SITEMAP_SHAPE', 'Expected a journey edit.');
  switch (value.type) {
    case 'append': object(value, ['type', 'surface']); id(value.surface); break;
    case 'surface': object(value, ['type', 'step', 'surface']); id(value.step); id(value.surface); break;
    case 'transition': object(value, ['type', 'step', 'via']); id(value.step); if (value.via !== null) id(value.via); break;
    case 'move': object(value, ['type', 'step', 'offset']); id(value.step);
      requireSitemap(value.offset === -1 || value.offset === 1, 'SITEMAP_ORDER', 'Move one step up or down.'); break;
    case 'remove': object(value, ['type', 'step']); id(value.step); break;
    default: requireSitemap(false, 'SITEMAP_COMMAND', 'Unknown journey edit.');
  }
}

/** Detached edits preserve surviving step identities and never rewrite routes, links or hierarchy. */
export function editJourneyDraft(design: SitemapDesign, draft: JourneyDraft, edit: JourneyEdit): JourneyDraft {
  validateSitemapModel(design); validateDraft(design, draft); assertEdit(edit);
  const next = structuredClone(draft), steps = next.journey.steps;
  if (edit.type === 'append' || edit.type === 'surface') {
    requireSitemap(design.nodes.some(node => node.id === edit.surface && node.kind !== 'group'),
      'SITEMAP_REFERENCE', 'Choose an existing content surface.');
  }
  if (edit.type === 'append') {
    requireSitemap(steps.length < SITEMAP_LIMITS.steps, 'SITEMAP_LIMIT', 'This journey has reached its step limit.');
    steps.push({ id: 'step-' + next.nextStep++, surface: edit.surface, via: null });
    const options = journeyStepTransitions(design, steps, steps.length - 1);
    // A single ordinary action is unambiguous. Conditions always require explicit review.
    if (options.length === 1 && options[0]?.kind !== 'conditional') steps[steps.length - 1]!.via = options[0]!.id;
  } else {
    const index = steps.findIndex(step => step.id === edit.step);
    requireSitemap(index >= 0, 'SITEMAP_REFERENCE', 'The selected journey step no longer exists.');
    const step = steps[index]!;
    if (edit.type === 'remove') steps.splice(index, 1);
    else if (edit.type === 'move') {
      const destination = index + edit.offset;
      requireSitemap(destination >= 0 && destination < steps.length, 'SITEMAP_ORDER', 'This step cannot move further.');
      steps.splice(index, 1); steps.splice(destination, 0, step);
    } else if (edit.type === 'surface') {
      // Rebinding is explicit recovery. Selecting an unchanged, resolved surface is a no-op.
      if (step.surface !== edit.surface || step.unresolved) {
        steps[index] = { id: step.id, surface: edit.surface, via: null };
      }
    } else {
      requireSitemap(edit.via === null || journeyStepTransitions(design, steps, index).some(link => link.id === edit.via),
        'SITEMAP_JOURNEY', 'Choose an action connecting these consecutive resolved steps.');
      step.via = edit.via;
    }
  }
  // Changing adjacency clears invalid incoming actions, never silently selects another branch.
  steps.forEach((step, index) => {
    if (index === 0) step.via = null;
    else if (!step.unresolved && step.via !== null && !journeyStepTransitions(design, steps, index).some(link => link.id === step.via)) step.via = null;
  });
  validateDraft(design, next); return next;
}

/** Returns the existing canonical journey shape; draft state never becomes a second project format. */
export function finishJourneyDraft(design: SitemapDesign, draft: JourneyDraft, name: string): SitemapJourney {
  validateSitemapModel(design); validateDraft(design, draft); sitemapText(name);
  requireSitemap(draft.journey.steps.length >= 2, 'SITEMAP_JOURNEY', 'Add at least two journey steps.');
  return { id: draft.journey.id, name, steps: structuredClone(draft.journey.steps) };
}
