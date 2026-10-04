import { createFilePlan } from '../../scripts/shared/file-plan.ts';
import { requireSketch } from '../domain/errors.ts';
import { mergeCollectionBlock } from '../domain/collection-register.ts';
import { collectionManagedUpdate, type CollectionChange, type CollectionManagedChange } from '../domain/collection-record.ts';
import { candidateCreate, candidateEditable, candidateFrontmatter, candidateOptionalKeys, candidateStatus, candidateTransition, readCandidateRecord,
  type CandidateInput, type CandidateRecord } from '../domain/release-candidate.ts';
import { candidateBlockNames, candidateDocs, candidateReadmeBody } from '../domain/release-candidate-docs.ts';
import { hash } from './framework/files.ts';
import { prepared, type Entry, type Prepared } from './storage.ts';
import { parseCollectionNote, patchCollectionNote, renderCollectionNote } from './collection-notes.ts';
import { readCollection } from './collection-store.ts';
import { candidateViews, candidateWorld, candidateWorldFindings, readCandidates, type CandidateContext, type CandidateIncrementItem, type CandidateNote, type CandidateWorld } from './release-candidate-store.ts';
/** The candidate README of a version, the readable note there (if any) and the world it was read from. */
interface Target { world: CandidateWorld; path: string; note?: CandidateNote & { record: CandidateRecord } }
export async function candidateTarget(context: CandidateContext, version: string, existing = true): Promise<Target> {
  const world = await candidateWorld(context), path = `${context.folder}/${version}/README.md`;
  const notes = world.snapshot.candidates.filter(note => note.path === path || note.record?.version === version);
  if (!existing) {
    requireSketch(!notes.length, 'CANDIDATE_EXISTS', `Release candidate ${version} already exists in ${notes[0]?.path ?? path}; nothing was overwritten.`);
    return { world, path };
  }
  const note = notes.find(item => item.path === path);
  requireSketch(note, 'CANDIDATE_NOT_FOUND', `No release candidate ${version} in ${path}.`);
  const errors = note.issues.filter(item => item.severity === 'error');
  requireSketch(note.state === 'candidate' && note.record && !errors.length, 'CANDIDATE_INVALID', `${path} cannot be changed until it is valid: ${errors.map(item => item.message).join(' ')}`);
  requireSketch(note.record.version === version, 'CANDIDATE_INVALID', `${path} holds version ${note.record.version}; a candidate folder is named after its version.`);
  return { world, path, note: { ...note, record: note.record } };
}
/** One increment move made by the candidate plan, through the engine's managed change of that note. */
interface IncrementMove { item: CandidateIncrementItem; change: CollectionChange }
function move(world: CandidateWorld, item: CandidateIncrementItem, change: CollectionManagedChange): IncrementMove {
  const { definition, hook } = world.context.increments.loaded;
  return { item, change: collectionManagedUpdate(definition, hook, item.note.record!, change, world.context.asOf) };
}
function candidateIncrement(world: CandidateWorld, id: string): CandidateIncrementItem {
  const matches = world.items.filter(item => item.id.toLowerCase() === id.toLowerCase());
  requireSketch(matches.length, 'CANDIDATE_INCREMENT_NOT_FOUND', `No Increment note with id ${id} in ${world.context.increments.folder}.`);
  requireSketch(matches.length === 1, 'COLLECTION_DUPLICATE_ID', `${id} is used by ${matches.map(item => item.path).join(' and ')}; give one note another id first.`);
  const item = matches[0]!, errors = item.note.issues.filter(issue => issue.severity === 'error');
  requireSketch(item.valid, 'COLLECTION_NOTE_INVALID', `${item.path} cannot be changed until it is valid: ${errors.map(issue => issue.message).join(' ')}`);
  return item;
}
/** A ready increment that no candidate holds moves to included in this version. */
function candidateInclude(world: CandidateWorld, id: string, version: string): IncrementMove {
  const item = candidateIncrement(world, id);
  requireSketch(item.status === 'ready' && item.values.candidate === undefined, 'CANDIDATE_INCREMENT_NOT_READY',
    `${item.id} is ${item.status}${typeof item.values.candidate === 'string' ? ` in candidate ${item.values.candidate}` : ''}; only ready increments that no candidate holds can be added.`);
  return move(world, item, { status: 'included', set: { candidate: version } });
}
/** An increment this version included returns to ready without a candidate. */
function candidateRelease(world: CandidateWorld, item: CandidateIncrementItem): IncrementMove {
  return move(world, item, { status: 'ready', set: { candidate: null } });
}
const changed = (item: CandidateIncrementItem, change: CollectionChange): CandidateIncrementItem => {
  const { status, ...values } = change.values;
  for (const key of change.removed) delete values[key];
  return { ...item, status: String(status), values };
};
/** The README after the change: frontmatter patched in place (unrelated keys kept), generated blocks merged, authored text untouched. */
function readmeContent(target: Target, record: CandidateRecord, blocks: Record<string, string>, goal?: string): string {
  const front = candidateFrontmatter(record);
  if (!target.note) return renderCollectionNote(target.path, front, candidateReadmeBody(record.version, goal, blocks, hash));
  const current = target.note.content!, { properties } = parseCollectionNote(current)!, remove = candidateOptionalKeys.filter(key => front[key] === undefined);
  // Unchanged frontmatter keeps its exact bytes (YAML formatting and comments); only real changes are patched.
  const same = Object.entries(front).every(([key, value]) => JSON.stringify(properties[key]) === JSON.stringify(value)) && !remove.some(key => Object.hasOwn(properties, key));
  const patched = same ? current : patchCollectionNote(current, front, remove);
  const { body } = parseCollectionNote(patched)!;
  let next = body;
  for (const name of candidateBlockNames) next = mergeCollectionBlock(name, next, blocks[name]!, hash);
  return patched.slice(0, patched.length - body.length) + next;
}
function verifyReadme(content: string, record: CandidateRecord, prefix: string): void {
  const parts = parseCollectionNote(content), reading = parts ? readCandidateRecord(parts.properties, prefix) : undefined;
  const canonical = (value: object | undefined) => JSON.stringify(Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b)));
  requireSketch(reading?.kind === 'candidate' && canonical(reading.record) === canonical(record), 'CANDIDATE_CANDIDATE', 'The candidate README would not read back exactly; nothing was written.');
}
function guard(context: CandidateContext, candidates: string, increments: string): () => Promise<void> {
  return async () => {
    const [now, notes] = await Promise.all([readCandidates(context), readCollection(context.increments)]);
    requireSketch(now.inventory === candidates && notes.inventory === increments, 'MAKER_STALE', `${context.folder} or ${context.increments.folder} changed after review; plan again.`);
  };
}
/** A reviewed candidate plan with the increment moves it makes, for previews. */
export interface CandidatePlan extends Prepared { moved: Array<{ id: string; path: string; status: string }> }
interface Change { kind: string; record: CandidateRecord; moves: IncrementMove[]; goal?: string }
/** One reviewed plan: the README and every moved increment note, applied together or not at all. */
async function candidatePlan(target: Target, spec: Change): Promise<CandidatePlan> {
  const { world } = target, { context } = world, moves = new Map(spec.moves.map(entry => [entry.item.id.toLowerCase(), entry]));
  const items = world.items.map(item => { const entry = moves.get(item.id.toLowerCase()); return entry ? changed(item, entry.change) : item; });
  const findings = candidateWorldFindings(world, items, { path: target.path, record: spec.record });
  const errors = findings.filter(item => item.severity === 'error' && item.id === spec.record.version).length;
  const views = candidateViews(world, items, spec.record, target.path);
  const blocks = candidateDocs({ record: spec.record, ...views, asOf: context.asOf, riskFolder: world.riskFolder, errors });
  const readme = readmeContent(target, spec.record, blocks, spec.goal);
  verifyReadme(readme, spec.record, context.increments.loaded.definition.idPrefix);
  const entries: Entry[] = [{ path: target.path, content: readme }, ...spec.moves.map(entry => ({ path: entry.item.path, content: patchCollectionNote(entry.item.note.content!, entry.change.values, entry.change.removed) }))];
  const plan = await createFilePlan(context.root, entries);
  const expected = [target.note?.beforeHash ?? null, ...spec.moves.map(entry => entry.item.note.beforeHash)];
  requireSketch(plan.changes.every((item, index) => item.beforeHash === expected[index]), 'MAKER_STALE', 'A candidate or increment note changed while planning; nothing was overwritten.');
  const identity = { kind: spec.kind, version: spec.record.version, asOf: context.asOf, candidates: world.snapshot.inventory, increments: world.increments.inventory };
  const moved = spec.moves.map(entry => ({ id: entry.item.id, path: entry.item.path, status: entry.change.status }));
  const data = { version: spec.record.version, path: target.path, candidateStatus: spec.record.status, increments: spec.record.increments, moved, content: readme };
  return { ...prepared(plan, data, identity), validate: guard(context, world.snapshot.inventory, world.increments.inventory), moved };
}
export async function candidateCreatePlan(context: CandidateContext, input: CandidateInput & { version: string }): Promise<CandidatePlan> {
  const target = await candidateTarget(context, input.version, false), record = candidateCreate(input, context.asOf);
  return candidatePlan(target, { kind: 'candidate-create', record, moves: input.increments.map(id => candidateInclude(target.world, id, input.version)), ...(input.goal ? { goal: input.goal } : {}) });
}
export async function candidateAddPlan(context: CandidateContext, version: string, id: string): Promise<Prepared> {
  const target = await candidateTarget(context, version), record = target.note!.record;
  candidateEditable(record);
  requireSketch(!record.increments.some(item => item.toLowerCase() === id.toLowerCase()), 'CANDIDATE_INCREMENT_LISTED', `${id} is already in ${version}.`);
  const entry = candidateInclude(target.world, id, version);
  return candidatePlan(target, { kind: 'candidate-add', record: { ...record, updated: context.asOf, increments: [...record.increments, entry.item.id] }, moves: [entry] });
}
export async function candidateRemovePlan(context: CandidateContext, version: string, id: string): Promise<Prepared> {
  const target = await candidateTarget(context, version), record = target.note!.record;
  candidateEditable(record);
  const listed = record.increments.find(item => item.toLowerCase() === id.toLowerCase());
  requireSketch(listed, 'CANDIDATE_INCREMENT_NOT_LISTED', `${id} is not in ${version}; it lists ${record.increments.join(', ') || 'no increments'}.`);
  const exists = target.world.items.some(item => item.id.toLowerCase() === id.toLowerCase());
  const item = exists ? candidateIncrement(target.world, id) : undefined;
  const moves = item && item.values.candidate === version ? [candidateRelease(target.world, item)] : [];
  return candidatePlan(target, { kind: 'candidate-remove', record: { ...record, updated: context.asOf, increments: record.increments.filter(entry => entry !== listed) }, moves });
}
/** Increments follow a released (shipped) or abandoned (back to ready) candidate in the same plan. */
function followers(world: CandidateWorld, record: CandidateRecord, to: string): IncrementMove[] {
  const effect = candidateStatus(to)?.increments;
  if (!effect) return [];
  const linked = record.increments.map(id => world.items.find(item => item.valid && item.id.toLowerCase() === id.toLowerCase())).filter(item => item !== undefined && item.values.candidate === record.version);
  return linked.map(item => effect === 'shipped' ? move(world, item!, { status: 'shipped' }) : candidateRelease(world, item!));
}
export async function candidateStatusPlan(context: CandidateContext, version: string, to: string): Promise<Prepared> {
  const target = await candidateTarget(context, version), record = candidateTransition(target.note!.record, to, context.asOf);
  if (['frozen', 'qualified', 'released'].includes(record.status)) {
    const blocking = candidateWorldFindings(target.world, target.world.items, { path: target.path, record: target.note!.record }).filter(item => item.severity === 'error' && item.id === version);
    requireSketch(!blocking.length, 'CANDIDATE_BLOCKED', `${version} cannot become ${record.status} while candidate check reports errors: ${blocking.map(item => item.message).join(' ')}`);
  }
  return candidatePlan(target, { kind: 'candidate-status', record, moves: followers(target.world, target.note!.record, record.status) });
}
/** Regenerates the generated blocks only; frontmatter and authored text stay as they are. Released and abandoned candidates are records. */
export async function candidateDocsPlan(context: CandidateContext, version: string): Promise<Prepared> {
  const target = await candidateTarget(context, version), record = target.note!.record;
  requireSketch(!['released', 'abandoned'].includes(record.status), 'CANDIDATE_LOCKED', `${version} is ${record.status}; its documents are a record and are not regenerated.`);
  return candidatePlan(target, { kind: 'candidate-docs', record, moves: [] });
}
