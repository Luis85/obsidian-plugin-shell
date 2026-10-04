import type { CollectionIssue } from './collection-record.ts';
import type { CandidateRecord } from './release-candidate.ts';
import type { CandidateRiskView } from './release-candidate-docs.ts';
/** How a generated README block reads: intact, absent, edited by hand, or with duplicated or broken markers. */
export type CandidateBlockState = 'ok' | 'missing' | 'edited' | 'broken';
/** One candidate README as read: its folder name, the record (if readable), reading issues and block states. */
export interface CandidateEntry { path: string; folder: string; record?: CandidateRecord; issues: CollectionIssue[]; blocks: Record<string, CandidateBlockState> }
/** What a candidate check needs to know about one release item note. */
export interface CandidateIncrementState { id: string; path: string; valid: boolean; status: string; candidate?: string; acceptance: number; sources: number; updated: string; risks: string[] }
export interface CandidateCheckInput {
  candidates: readonly CandidateEntry[]; increments: readonly CandidateIncrementState[]; risks: ReadonlyMap<string, CandidateRiskView>; asOf: string; riskFolder: string;
}
const finding = (severity: CollectionIssue['severity'], code: string, message: string, path: string, id?: string): CollectionIssue => ({ severity, code, message, path, ...(id ? { id } : {}) });
/** The release item status a live candidate expects of its release items; abandoned candidates are historical records. */
const expectedStatus = (record: CandidateRecord) => record.status === 'released' ? 'shipped' : record.status === 'abandoned' ? undefined : 'included';
function entryFindings(entry: CandidateEntry): CollectionIssue[] {
  const id = entry.record?.version;
  const found: CollectionIssue[] = entry.issues.map(item => ({ ...item, path: entry.path, ...(id ? { id } : {}) }));
  if (entry.record && entry.record.version !== entry.folder)
    found.push(finding('error', 'CANDIDATE_FOLDER', `The folder ${entry.folder} holds version ${entry.record.version}; a candidate folder is named after its version.`, entry.path, id));
  for (const [name, state] of Object.entries(entry.blocks)) {
    if (state === 'missing') found.push(finding('warning', 'CANDIDATE_DOCS_MISSING', `The generated ${name} block is missing; candidate docs appends it.`, entry.path, id));
    if (state === 'edited' || state === 'broken') found.push(finding('error', 'CANDIDATE_DOCS_EDITED', `The generated ${name} block was ${state === 'edited' ? 'edited by hand' : 'duplicated or broken'}; move authored text outside the markers or restore the block.`, entry.path, id));
  }
  return found;
}
function linkFindings(entry: CandidateEntry & { record: CandidateRecord }, increments: ReadonlyMap<string, CandidateIncrementState>): CollectionIssue[] {
  const { record, path } = entry, expected = expectedStatus(record), found: CollectionIssue[] = [];
  if (!expected) return found;
  for (const id of record.items) {
    const increment = increments.get(id.toLowerCase());
    if (!increment) found.push(finding('error', 'CANDIDATE_INCREMENT_MISSING', `${id} is listed but no valid release item note has that id.`, path, record.version));
    else if (increment.candidate !== record.version || increment.status !== expected)
      found.push(finding('error', 'CANDIDATE_INCREMENT_UNLINKED', `${id} is ${increment.status}${increment.candidate ? ` in ${increment.candidate}` : ' without a candidate'}; ${record.status} candidate ${record.version} expects ${expected} in ${record.version}.`, path, record.version));
  }
  return found;
}
type Warn = (code: string, message: string) => void;
function incrementWarnings(record: CandidateRecord, increment: CandidateIncrementState, input: CandidateCheckInput, warn: Warn): void {
  if (!increment.acceptance) warn('CANDIDATE_NO_ACCEPTANCE', `${increment.id} has no acceptance criteria.`);
  if (!increment.sources) warn('CANDIDATE_NO_SOURCES', `${increment.id} names no sources.`);
  if (record.frozen && increment.updated > record.frozen) warn('CANDIDATE_CHANGED_AFTER_FREEZE', `${increment.id} changed on ${increment.updated}, after ${record.version} froze on ${record.frozen}.`);
  for (const id of increment.risks) riskFinding(input, input.risks.get(id), id, increment.id, warn);
}
/** Readiness warnings of a live, unreleased candidate and its release items. */
function qualityFindings(entry: CandidateEntry & { record: CandidateRecord }, input: CandidateCheckInput, increments: ReadonlyMap<string, CandidateIncrementState>): CollectionIssue[] {
  const { record, path } = entry, found: CollectionIssue[] = [];
  if (!expectedStatus(record) || record.status === 'released') return found;
  const warn: Warn = (code, message) => found.push(finding('warning', code, message, path, record.version));
  if (!record.items.length) warn('CANDIDATE_EMPTY', `${record.version} includes no release items yet.`);
  if (record.targetDate && record.targetDate < input.asOf) warn('CANDIDATE_OVERDUE', `${record.version} passed its target date ${record.targetDate}.`);
  for (const increment of record.items.map(id => increments.get(id.toLowerCase())).filter(item => item !== undefined)) incrementWarnings(record, increment, input, warn);
  return found;
}
function riskFinding(input: CandidateCheckInput, risk: CandidateRiskView | undefined, id: string, from: string, warn: Warn): void {
  if (!risk?.found) warn('CANDIDATE_RISK_MISSING', `${from} links ${id}, which is not a valid risk note in ${input.riskFolder}.`);
  else if (risk.open && ['high', 'critical'].includes(risk.level)) warn('CANDIDATE_RISK_OPEN', `${from} links ${id}, which is open at ${risk.level} level.`);
}
/** Release item id (lower case) → the live candidates that list it. */
function candidateListing(candidates: readonly CandidateEntry[]): Map<string, string[]> {
  const listing = new Map<string, string[]>();
  for (const record of candidates.map(entry => entry.record).filter(item => item !== undefined && expectedStatus(item) !== undefined))
    for (const id of record!.items) listing.set(id.toLowerCase(), [...listing.get(id.toLowerCase()) ?? [], record!.version]);
  return listing;
}
function orphanOf(increment: CandidateIncrementState, versions: readonly string[]): CollectionIssue[] {
  const error = (code: string, message: string) => finding('error', code, message, increment.path, increment.id), found: CollectionIssue[] = [];
  if (versions.length > 1) found.push(error('CANDIDATE_INCREMENT_SHARED', `${increment.id} is listed by ${versions.join(' and ')}; a release item belongs to one live candidate.`));
  if (increment.candidate && !versions.includes(increment.candidate)) found.push(error('CANDIDATE_INCREMENT_ORPHAN', `${increment.id} names candidate ${increment.candidate}, which does not list it.`));
  if (!increment.candidate && ['included', 'shipped'].includes(increment.status)) found.push(error('CANDIDATE_INCREMENT_ORPHAN', `${increment.id} is ${increment.status} without a candidate.`));
  return found;
}
/** Release items that point at a candidate that does not list them, or claim a managed status without a candidate. */
function orphanFindings(input: CandidateCheckInput): CollectionIssue[] {
  const listing = candidateListing(input.candidates);
  return input.increments.filter(item => item.valid).flatMap(increment => orphanOf(increment, listing.get(increment.id.toLowerCase()) ?? []));
}
/** Every candidate finding: README problems, broken links in both directions, and readiness warnings. Warnings never fail a check. */
export function candidateFindings(input: CandidateCheckInput): CollectionIssue[] {
  const increments = new Map(input.increments.filter(item => item.valid).map(item => [item.id.toLowerCase(), item]));
  const found = input.candidates.flatMap(entry => entryFindings(entry));
  for (const entry of input.candidates) {
    if (!entry.record) continue;
    const readable = { ...entry, record: entry.record };
    found.push(...linkFindings(readable, increments), ...qualityFindings(readable, input, increments));
  }
  return [...found, ...orphanFindings(input)];
}
