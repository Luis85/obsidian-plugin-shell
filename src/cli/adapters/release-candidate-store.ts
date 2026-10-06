import { posix } from 'node:path';
import { SketchError } from '../domain/errors.ts';
import { collectionRoot } from '../domain/user-settings.ts';
import { collectionField } from '../domain/collection-definition.ts';
import { mergeCollectionBlock } from '../domain/collection-register.ts';
import type { CollectionIssue, CollectionValue, CollectionValues } from '../domain/collection-record.ts';
import { readCandidateRecord, type CandidateRecord } from '../domain/release-candidate.ts';
import { candidateBlockNames, type CandidateIncrementView, type CandidateRiskView } from '../domain/release-candidate-docs.ts';
import { candidateFindings, type CandidateBlockState, type CandidateEntry, type CandidateIncrementState } from '../domain/release-candidate-check.ts';
import { hash } from './framework/files.ts';
import { loadSettings } from './user-settings.ts';
import { parseCollectionNote, scanCollectionFolder, type CollectionFile } from './collection-notes.ts';
import { openCollection, readCollection, type CollectionContext, type CollectionNote, type CollectionSnapshot } from './collection-store.ts';
/** Release candidates of one project: the configured folder, the release item collection and the reference date. */
export interface CandidateContext { root: string; folder: string; asOf: string; increments: CollectionContext }
/** One `<folder>/<version>/README.md`: `future` is a newer schema (read-only), `unreadable` cannot be parsed. */
export interface CandidateNote extends CandidateEntry { state: 'candidate' | 'future' | 'unreadable'; content: string | null; beforeHash: string }
export interface CandidateSnapshot { candidates: CandidateNote[]; ignored: string[]; inventory: string }
/** A release item note as candidates use it; `values` holds the note's (or a planned change's) frontmatter values. */
export interface CandidateIncrementItem { id: string; path: string; valid: boolean; status: string; title: string; values: CollectionValues; note: CollectionNote }
/** Everything a candidate command reads: candidates, release items and the linked risk notes. */
export interface CandidateWorld { context: CandidateContext; snapshot: CandidateSnapshot; increments: CollectionSnapshot; items: CandidateIncrementItem[]; risks: Map<string, CandidateRiskView>; riskFolder: string }
export async function openCandidates(root: string, asOf?: string): Promise<CandidateContext> {
  const increments = await openCollection(root, 'release-item', asOf), settings = (await loadSettings(root)).settings;
  return { root, folder: collectionRoot(settings.paths, 'releaseCandidates'), asOf: increments.asOf, increments };
}
const readmePattern = (folder: string) => new RegExp(`^${folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([^/]+)/README\\.md$`);
/** How each generated block reads; the engine's own marker merge decides, so check and regeneration always agree. */
function candidateBlockStates(body: string): Record<string, CandidateBlockState> {
  const states: Record<string, CandidateBlockState> = {};
  for (const name of candidateBlockNames) {
    if (!body.includes(`<!-- ${name}:start`) && !body.includes(`<!-- ${name}:end -->`)) { states[name] = 'missing'; continue; }
    try { mergeCollectionBlock(name, body, '', hash); states[name] = 'ok'; }
    catch (error) { if (!(error instanceof SketchError)) throw error; states[name] = error.code === 'COLLECTION_REGISTER_EDITED' ? 'edited' : 'broken'; }
  }
  return states;
}
function unreadable(file: CollectionFile, folder: string, message: string): CandidateNote {
  return { path: file.path, folder, state: 'unreadable', content: file.content, beforeHash: file.beforeHash, blocks: {},
    issues: [{ severity: 'error', code: 'CANDIDATE_UNREADABLE', message: `${message}; the file is preserved.` }] };
}
function noteOf(context: CandidateContext, file: CollectionFile, folder: string): CandidateNote | null {
  if (file.content === null) return unreadable(file, folder, file.problem ?? 'unreadable');
  let parts: ReturnType<typeof parseCollectionNote>;
  try { parts = parseCollectionNote(file.content); }
  catch (error) { if (!(error instanceof SketchError)) throw error; return unreadable(file, folder, error.message); }
  if (!parts) return null;
  const reading = readCandidateRecord(parts.properties, context.increments.loaded.definition.idPrefix);
  if (reading.kind === 'ignored') return null;
  const base = { path: file.path, folder, content: file.content, beforeHash: file.beforeHash, issues: reading.issues, blocks: candidateBlockStates(parts.body) };
  return reading.kind === 'future' ? { ...base, state: 'future' } : { ...base, state: 'candidate', ...(reading.record ? { record: reading.record } : {}) };
}
/** Every `<version>/README.md` of type ReleaseCandidate; other Markdown is ignored and never changed. */
export async function readCandidates(context: CandidateContext): Promise<CandidateSnapshot> {
  const files = await scanCollectionFolder(context.root, context.folder), pattern = readmePattern(context.folder);
  const candidates: CandidateNote[] = [], ignored: string[] = [];
  for (const file of files) {
    const folder = pattern.exec(file.path)?.[1], note = folder === undefined ? null : noteOf(context, file, folder);
    if (note) candidates.push(note); else ignored.push(file.path);
  }
  return { candidates, ignored, inventory: hash(JSON.stringify(files.map(file => [file.path, file.beforeHash]))) };
}
function itemOf(note: CollectionNote): CandidateIncrementItem {
  const record = note.record, valid = Boolean(record) && !note.issues.some(item => item.severity === 'error');
  return { id: record?.id || note.rawId || '', path: note.path, valid, status: record?.status ?? '', title: record?.title ?? '', values: { ...record?.values }, note };
}
/** One valid risk note as candidate documents show it, with its status label, open flag and level label. */
function riskView(risk: CollectionContext, note: CollectionNote & { record: NonNullable<CollectionNote['record']> }): CandidateRiskView {
  const definition = risk.loaded.definition, record = note.record, status = definition.statuses.find(item => item.id === record.status);
  const levels = definition.vocabularies[collectionField(definition, 'level')?.vocabulary ?? ''] ?? [], level = String(record.values.level ?? '');
  return { id: record.id, found: true, title: record.title, status: status?.label ?? record.status, level, levelLabel: levels.find(item => item.id === level)?.label ?? level,
    open: status?.open === true, href: note.path, from: [] };
}
async function riskViews(context: CandidateContext): Promise<{ folder: string; risks: Map<string, CandidateRiskView> }> {
  let risk: CollectionContext;
  try { risk = await openCollection(context.root, 'risk', context.asOf); }
  catch (error) { if (error instanceof SketchError) return { folder: 'the risk register', risks: new Map() }; throw error; }
  const notes = (await readCollection(risk)).notes.filter((note): note is CollectionNote & { record: NonNullable<CollectionNote['record']> } =>
    Boolean(note.record) && !note.issues.some(issue => issue.severity === 'error'));
  return { folder: risk.folder, risks: new Map(notes.map(note => [note.record.id, riskView(risk, note)])) };
}
export async function candidateWorld(context: CandidateContext): Promise<CandidateWorld> {
  const [snapshot, increments, risk] = await Promise.all([readCandidates(context), readCollection(context.increments), riskViews(context)]);
  return { context, snapshot, increments, items: increments.notes.map(itemOf), risks: risk.risks, riskFolder: risk.folder };
}
const listOf = (value: CollectionValue | undefined): string[] => Array.isArray(value) ? value : [];
/** The check's view of release items, with planned changes applied. */
function candidateIncrementStates(items: readonly CandidateIncrementItem[]): CandidateIncrementState[] {
  return items.map(item => ({ id: item.id, path: item.path, valid: item.valid, status: item.status, acceptance: listOf(item.values.acceptance).length, sources: listOf(item.values.sources).length,
    updated: String(item.values.updated ?? ''), risks: listOf(item.values.risks), ...(typeof item.values.candidate === 'string' ? { candidate: item.values.candidate } : {}) }));
}
/** Every finding over the world, with `replace` standing in for one candidate's planned record and fresh blocks. */
export function candidateWorldFindings(world: CandidateWorld, items: readonly CandidateIncrementItem[], replace?: { path: string; record: CandidateRecord }): CollectionIssue[] {
  const fresh = Object.fromEntries(candidateBlockNames.map(name => [name, 'ok' as const]));
  const candidates = world.snapshot.candidates.filter(note => note.path !== replace?.path);
  if (replace) candidates.push({ path: replace.path, folder: replace.record.version, record: replace.record, issues: [], blocks: fresh, state: 'candidate', content: null, beforeHash: '' });
  return candidateFindings({ candidates, increments: candidateIncrementStates(items), risks: world.risks, asOf: world.context.asOf, riskFolder: world.riskFolder });
}
const relative = (from: string, to: string) => posix.relative(posix.dirname(from), to);
/** The documented release items of a record (in its order), the ids without a valid note, and the risks they link. */
export function candidateViews(world: CandidateWorld, items: readonly CandidateIncrementItem[], record: CandidateRecord, readme: string):
  { increments: CandidateIncrementView[]; missing: string[]; risks: CandidateRiskView[] } {
  const definition = world.context.increments.loaded.definition, byId = new Map(items.filter(item => item.valid).map(item => [item.id.toLowerCase(), item]));
  const kinds = definition.vocabularies[collectionField(definition, 'kind')?.vocabulary ?? ''] ?? [];
  const found = record.items.map(id => byId.get(id.toLowerCase())).filter(item => item !== undefined);
  const increments = found.map(item => ({ id: item.id, title: item.title, status: definition.statuses.find(status => status.id === item.status)?.label ?? item.status,
    kind: String(item.values.kind ?? ''), kindLabel: kinds.find(kind => kind.id === item.values.kind)?.label ?? String(item.values.kind ?? ''),
    summary: String(item.values.summary ?? ''), sources: listOf(item.values.sources), acceptance: listOf(item.values.acceptance), risks: listOf(item.values.risks), href: relative(readme, item.path) }));
  const risks = new Map<string, CandidateRiskView>();
  for (const increment of increments) for (const id of increment.risks) {
    const known = world.risks.get(id), view = risks.get(id) ?? (known ? { ...known, href: relative(readme, known.href), from: [] } : { id, found: false, title: '', status: '', level: '', levelLabel: '', open: false, href: '', from: [] });
    risks.set(id, { ...view, from: [...view.from, increment.id] });
  }
  return { increments, missing: record.items.filter(id => !byId.has(id.toLowerCase())), risks: [...risks.values()] };
}
