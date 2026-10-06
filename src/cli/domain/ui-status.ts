import type { ReportRead, E2eEvidence, GalleryEvidence } from './ui-status-evidence.ts';
import { summarizeE2e, summarizeGallery } from './ui-status-evidence.ts';
import type { UiDefinition, UiInteraction, UiJourney } from './ui-status-input.ts';
import { scanAcceptanceTest, scanSpec, scanStub, mentions, type AcceptanceTestFacts, type SpecFile, type SpecFacts, type StubFacts } from './ui-status-source.ts';

/** generated: nothing to implement; todo: a stub or test still pending; implemented: static source shows neither. */
export type UiState = 'generated' | 'todo' | 'implemented';
type FileState<Facts> = { path: string; exists: false } | ({ path: string; exists: true } & Facts);
export interface InteractionStatus {
  id: string; surfaceId: string; nodeId: string | null; label: string; event: string | null; verification: string;
  state: UiState; reasons: string[];
  stub: FileState<StubFacts> | null; acceptanceTest: FileState<AcceptanceTestFacts> | null; specs: string[];
  declared?: { testIds?: string[]; evidence?: Array<Record<string, unknown>> };
}
export interface StateCounts { total: number; generated: number; todo: number; implemented: number }
export interface SurfaceStatus {
  id: string; kind: 'page' | 'component'; label: string; ownerId: string | null; component: string | null;
  state: UiState; interactions: StateCounts; interactionIds: string[]; specs: string[];
  declaredAcceptance?: Record<string, unknown>;
  declared?: { testIds?: string[]; evidence?: Array<Record<string, unknown>> };
}
interface JourneyStepStatus { id: string; surface: string; spec: string | null }
export interface JourneyStatus { id: string; name: string; steps: number; stepsWithSpec: number; coverage: 'none' | 'partial' | 'complete'; details: JourneyStepStatus[] }
interface UiStatusInput {
  sources: { traceability: ReportRead['state']; project: ReportRead['state'] };
  definitions: readonly UiDefinition[]; interactions: readonly UiInteraction[]; journeys: readonly UiJourney[];
  /** Linked source text by project-relative path; null when the file is absent or unreadable. */
  files: Readonly<Record<string, string | null>>;
  specs: readonly SpecFile[];
  e2e: ReportRead; gallery: ReportRead;
}
export interface UiStatusReport {
  schemaVersion: 1;
  scope: 'static-ui-implementation-status';
  proof: 'static-source-analysis; no test was executed';
  behaviorAcceptance: 'not-run';
  sources: UiStatusInput['sources'];
  totals: { surfaces: StateCounts; interactions: StateCounts; journeys: { total: number; steps: number; stepsWithSpec: number }; specFiles: number };
  surfaces: SurfaceStatus[];
  interactions: InteractionStatus[];
  journeys: JourneyStatus[];
  evidence: { e2e: E2eEvidence; gallery: GalleryEvidence; surfacesWithoutGalleryEntry: string[] };
}
const noCounts = (): StateCounts => ({ total: 0, generated: 0, todo: 0, implemented: 0 });
const tally = (states: readonly UiState[]): StateCounts => states.reduce((counts, state) => ({ ...counts, total: counts.total + 1, [state]: counts[state] + 1 }), noCounts());

function stubState(path: string | null, files: UiStatusInput['files']): { facts: FileState<StubFacts> | null; reasons: string[] } {
  if (!path) return { facts: null, reasons: [] };
  const source = files[path];
  if (source === null || source === undefined) return { facts: { path, exists: false }, reasons: ['stub-missing'] };
  const scan = scanStub(source);
  return { facts: { path, exists: true, ...scan }, reasons: scan.throwsNotImplemented ? ['stub-throws-not-implemented'] : [] };
}
function testReasons(scan: AcceptanceTestFacts): string[] {
  if (scan.todo > 0) return ['test-has-todo'];
  if (scan.skipped > 0) return ['test-has-skipped'];
  return scan.active === 0 ? ['test-has-no-active-case'] : [];
}
function testState(path: string | null, files: UiStatusInput['files']): { facts: FileState<AcceptanceTestFacts> | null; reasons: string[] } {
  if (!path) return { facts: null, reasons: [] };
  const source = files[path];
  if (source === null || source === undefined) return { facts: { path, exists: false }, reasons: ['test-missing'] };
  const scan = scanAcceptanceTest(source);
  return { facts: { path, exists: true, ...scan }, reasons: testReasons(scan) };
}
/** Unlinked business hooks stay todo: absence of files is never evidence of implementation. */
function stateOf(interaction: UiInteraction, reasons: string[]): { state: UiState; reasons: string[] } {
  const linked = interaction.implementation !== null || interaction.test !== null;
  if (!linked) return interaction.verification === 'business-todo' ? { state: 'todo', reasons: ['hook-not-linked'] } : { state: 'generated', reasons: [] };
  return { state: reasons.length ? 'todo' : 'implemented', reasons };
}
/** Optional testIds/evidence written by the traceability producer; surfaced as declared, never as proof. */
function declared(source: Pick<UiInteraction, 'testIds' | 'evidence'>): InteractionStatus['declared'] | undefined {
  const value = { ...(source.testIds ? { testIds: source.testIds } : {}), ...(source.evidence ? { evidence: source.evidence } : {}) };
  return Object.keys(value).length ? value : undefined;
}
function interactionStatus(interaction: UiInteraction, input: UiStatusInput, specs: readonly SpecFacts[]): InteractionStatus {
  const stub = stubState(interaction.implementation, input.files), test = testState(interaction.test, input.files);
  const { state, reasons } = stateOf(interaction, [...stub.reasons, ...test.reasons]);
  const extra = declared(interaction);
  return { id: interaction.id, surfaceId: interaction.definitionId, nodeId: interaction.nodeId, label: interaction.label, event: interaction.event,
    verification: interaction.verification, state, reasons, stub: stub.facts, acceptanceTest: test.facts,
    specs: specs.filter(spec => mentions(spec.text, interaction.id)).map(spec => spec.path), ...(extra ? { declared: extra } : {}) };
}
/** A surface is todo while any interaction is, implemented once at least one is and none are pending, otherwise generated. */
function surfaceState(counts: StateCounts): UiState {
  if (counts.todo > 0) return 'todo';
  return counts.implemented > 0 ? 'implemented' : 'generated';
}
function surfaceStatus(definition: UiDefinition, interactions: readonly InteractionStatus[], specs: readonly SpecFacts[]): SurfaceStatus {
  const own = interactions.filter(item => item.surfaceId === definition.id), counts = tally(own.map(item => item.state));
  const mentioned = specs.filter(spec => mentions(spec.text, definition.id)).map(spec => spec.path);
  const paths = [...new Set([...mentioned, ...own.flatMap(item => item.specs)])].sort(), extra = declared(definition);
  return { id: definition.id, kind: definition.kind, label: definition.label, ownerId: definition.ownerId, component: definition.component,
    state: surfaceState(counts), interactions: counts, interactionIds: own.map(item => item.id), specs: paths,
    ...(definition.acceptance ? { declaredAcceptance: definition.acceptance } : {}), ...(extra ? { declared: extra } : {}) };
}
function journeyStatus(journey: UiJourney, specs: readonly SpecFacts[]): JourneyStatus {
  const details = journey.steps.map(step => {
    const title = `[${journey.id}/${step.id}]`;
    return { id: step.id, surface: step.surface, spec: specs.find(spec => spec.titles.some(item => item.includes(title)))?.path ?? null };
  });
  const matched = details.filter(step => step.spec !== null).length;
  return { id: journey.id, name: journey.name, steps: details.length, stepsWithSpec: matched, details,
    coverage: matched === 0 ? 'none' : matched === details.length ? 'complete' : 'partial' };
}
/** Pure status computation from plain inputs. Anything not proven by the inputs is todo or not-run. */
export function computeUiStatus(input: UiStatusInput): UiStatusReport {
  const specs = input.specs.map(scanSpec);
  const interactions = input.interactions.map(item => interactionStatus(item, input, specs));
  const surfaces = input.definitions.map(item => surfaceStatus(item, interactions, specs));
  const journeys = input.journeys.map(item => journeyStatus(item, specs));
  const ids = [...surfaces.map(item => item.id), ...interactions.map(item => item.id)];
  const gallery = summarizeGallery(input.gallery), shown = new Set(gallery.surfaces);
  return { schemaVersion: 1, scope: 'static-ui-implementation-status', proof: 'static-source-analysis; no test was executed',
    behaviorAcceptance: 'not-run', sources: input.sources,
    totals: { surfaces: tally(surfaces.map(item => item.state)), interactions: tally(interactions.map(item => item.state)),
      journeys: { total: journeys.length, steps: journeys.reduce((sum, item) => sum + item.steps, 0), stepsWithSpec: journeys.reduce((sum, item) => sum + item.stepsWithSpec, 0) },
      specFiles: specs.length },
    surfaces, interactions, journeys,
    evidence: { e2e: summarizeE2e(input.e2e, ids), gallery, surfacesWithoutGalleryEntry: gallery.recognized ? surfaces.filter(item => !shown.has(item.id) && !shown.has(item.ownerId ?? '')).map(item => item.id) : [] } };
}
