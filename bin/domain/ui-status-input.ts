/** Tolerant readers that turn parsed JSON into typed UI-status inputs. Unknown shapes are dropped, never trusted. */
type Json = unknown;
export interface UiDefinition {
  id: string; kind: 'page' | 'component'; label: string; component: string | null; ownerId: string | null;
  /** Optional per-surface acceptance block, test ids and evidence; copied verbatim, never interpreted. */
  acceptance: Record<string, unknown> | null;
  testIds: string[] | null; evidence: Array<Record<string, unknown>> | null;
}
export interface UiInteraction {
  id: string; definitionId: string; nodeId: string | null; label: string; event: string | null; verification: string;
  implementation: string | null; test: string | null;
  testIds: string[] | null; evidence: Array<Record<string, unknown>> | null;
}
interface UiJourneyStep { id: string; surface: string }
export interface UiJourney { id: string; name: string; steps: UiJourneyStep[] }

const LIMITS = { definitions: 5000, interactions: 20000, journeys: 500, steps: 2000, items: 50 };
const isRecord = (value: Json): value is Record<string, Json> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: Json): string | null => typeof value === 'string' && value.length > 0 && value.length <= 4096 ? value : null;
const list = (value: Json, limit: number): Json[] => Array.isArray(value) ? value.slice(0, limit) : [];
const strings = (value: Json): string[] | null => Array.isArray(value) ? value.map(text).filter((item): item is string => item !== null).slice(0, LIMITS.items) : null;
const objects = (value: Json): Array<Record<string, unknown>> | null => Array.isArray(value) ? value.filter(isRecord).slice(0, LIMITS.items) : null;

/** Surface display names: page owners resolve through design.nodes, components through design.library. */
function labelIndex(project: Json): { nodes: Map<string, string>; library: Map<string, string> } {
  const design = isRecord(project) && isRecord(project.design) ? project.design : {};
  const index = (items: Json) => new Map(list(items, LIMITS.definitions).flatMap(item => {
    const id = isRecord(item) ? text(item.id) : null, label = isRecord(item) ? text(item.label) ?? text(item.name) : null;
    return id && label ? [[id, label] as [string, string]] : [];
  }));
  return { nodes: index(design.nodes), library: index(design.library) };
}
function surfaceLabel(item: Record<string, Json>, labels: ReturnType<typeof labelIndex>): string | undefined {
  const ownerId = text(item.ownerId), libraryId = text(item.libraryId);
  const named = item.kind === 'page' ? labels.nodes.get(ownerId ?? '') : labels.library.get(libraryId ?? '');
  return named ?? libraryId ?? ownerId ?? undefined;
}
const isSurfaceKind = (kind: Json): kind is UiDefinition['kind'] => kind === 'page' || kind === 'component';
/** The optional top-level `surfaces[]` block: matched to a definition by definitionIds, else by owner node id. */
function declaration(traceability: Json, id: string, ownerId: string | null): Record<string, Json> | null {
  const entries = (isRecord(traceability) ? list(traceability.surfaces, LIMITS.definitions) : []).filter(isRecord);
  const own = entries.find(entry => list(entry.definitionIds, LIMITS.items).includes(id)) ?? entries.find(entry => ownerId !== null && entry.id === ownerId);
  return own ?? null;
}
const plain = (value: Json): Record<string, Json> | null => isRecord(value) ? value : null;
function definition(item: Json, labels: ReturnType<typeof labelIndex>, traceability: Json): UiDefinition[] {
  const id = isRecord(item) ? text(item.id) : null;
  if (!isRecord(item) || !id || !isSurfaceKind(item.kind)) return [];
  const ownerId = text(item.ownerId), declared = declaration(traceability, id, ownerId) ?? {};
  return [{ id, kind: item.kind, label: surfaceLabel(item, labels) ?? id, component: text(item.component), ownerId,
    acceptance: plain(item.acceptance) ?? plain(declared.acceptance),
    testIds: strings(item.testIds ?? declared.testIds), evidence: objects(item.evidence ?? declared.evidence) }];
}
export function readDefinitions(traceability: Json, project: Json): UiDefinition[] {
  const labels = labelIndex(project), items = isRecord(traceability) ? list(traceability.definitions, LIMITS.definitions) : [];
  const seen = new Set<string>();
  return items.flatMap(item => definition(item, labels, traceability)).filter(entry => !seen.has(entry.id) && seen.add(entry.id));
}
function interaction(item: Json): UiInteraction[] {
  const id = isRecord(item) ? text(item.id) : null, definitionId = isRecord(item) ? text(item.definitionId) : null;
  if (!isRecord(item) || !id || !definitionId) return [];
  return [{ id, definitionId, nodeId: text(item.nodeId), label: text(item.label) ?? id, event: text(item.event),
    verification: text(item.verification) ?? 'unknown', implementation: text(item.implementation), test: text(item.test),
    testIds: strings(item.testIds), evidence: objects(item.evidence) }];
}
export function readInteractions(traceability: Json): UiInteraction[] {
  const items = isRecord(traceability) ? list(traceability.interactions, LIMITS.interactions) : [];
  const seen = new Set<string>();
  return items.flatMap(interaction).filter(entry => !seen.has(entry.id) && seen.add(entry.id));
}
function journey(item: Json): UiJourney[] {
  const id = isRecord(item) ? text(item.id) : null;
  if (!isRecord(item) || !id) return [];
  const steps = list(item.steps, LIMITS.steps).flatMap(step => {
    const stepId = isRecord(step) ? text(step.id) : null;
    return isRecord(step) && stepId ? [{ id: stepId, surface: text(step.surface) ?? '' }] : [];
  });
  return [{ id, name: text(item.name) ?? id, steps }];
}
/** Journeys live in the companion project at design.sitemap.journeys. */
export function readJourneys(project: Json): UiJourney[] {
  const design = isRecord(project) && isRecord(project.design) ? project.design : {};
  const sitemap = isRecord(design.sitemap) ? design.sitemap : {};
  return list(sitemap.journeys, LIMITS.journeys).flatMap(journey);
}
