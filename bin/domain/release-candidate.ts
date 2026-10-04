import { object } from './data.ts';
import { hasControls, requireSketch } from './errors.ts';
import { collectionReleaseVersion } from './collection-reference.ts';
import { isCollectionDate, type CollectionIssue, type CollectionValues } from './collection-record.ts';
/**
 * A release candidate: one folder per version (`<paths.releaseCandidates>/<version>/README.md`) whose frontmatter
 * (`type: ReleaseCandidate`) names the selected increments and a status workflow. Framework-free; adapters read and
 * write the README through the collection engine's frontmatter, patch and marker utilities.
 */
export type CandidateStatusId = 'draft' | 'frozen' | 'qualified' | 'released' | 'abandoned';
/**
 * `editable`: increments may be added or removed. `increments`: the status the candidate's increments move to when the
 * candidate enters this status (released ships them; abandoning returns them to ready).
 */
interface CandidateStatus { id: CandidateStatusId; label: string; transitions: CandidateStatusId[]; editable: boolean; increments?: 'shipped' | 'ready' }
const candidateStatuses: readonly CandidateStatus[] = Object.freeze([
  { id: 'draft', label: 'Draft', transitions: ['frozen', 'abandoned'], editable: true },
  { id: 'frozen', label: 'Frozen', transitions: ['draft', 'qualified', 'abandoned'], editable: false },
  { id: 'qualified', label: 'Qualified', transitions: ['released', 'frozen', 'abandoned'], editable: false },
  { id: 'released', label: 'Released', transitions: [], editable: false, increments: 'shipped' },
  { id: 'abandoned', label: 'Abandoned', transitions: [], editable: false, increments: 'ready' },
]);
const candidateType = 'ReleaseCandidate';
export interface CandidateRecord {
  version: string; status: CandidateStatusId; created: string; updated: string; frozen?: string; released?: string;
  targetDate?: string; owner?: string; increments: string[];
}
export type CandidateReading = { kind: 'ignored' } | { kind: 'future'; issues: CollectionIssue[] } | { kind: 'candidate'; record?: CandidateRecord; issues: CollectionIssue[] };
export const candidateStatus = (id: string) => candidateStatuses.find(status => status.id === id);
/** Strict `major.minor.patch` or `major.minor.patch-rc.N`, without leading zeros. */
export function readCandidateVersion(value: unknown): string {
  requireSketch(typeof value === 'string' && collectionReleaseVersion.test(value), 'CANDIDATE_VERSION', 'A candidate version is x.y.z or x.y.z-rc.N, such as 1.0.0 or 1.0.0-rc.1, without leading zeros.');
  return value;
}
const issue = (code: string, message: string, severity: CollectionIssue['severity'] = 'error'): CollectionIssue => ({ severity, code, message });
const incrementPattern = (prefix: string) => new RegExp(`^${prefix}\\d{3,9}$`);
function owner(value: unknown): string {
  requireSketch(typeof value === 'string' && value.trim().length > 0 && value.length <= 120 && !hasControls(value), 'CANDIDATE_VALUE', 'owner needs single-line text of 1–120 characters.');
  return value.trim();
}
function incrementIds(value: unknown, prefix: string): string[] {
  requireSketch(Array.isArray(value) && value.length <= 200, 'CANDIDATE_VALUE', 'increments must be a list of at most 200 increment ids.');
  const ids = value.map(item => String(item));
  requireSketch(value.every(item => typeof item === 'string' && incrementPattern(prefix).test(item)), 'CANDIDATE_VALUE', `increments must name ids like ${prefix}0001.`);
  requireSketch(new Set(ids).size === ids.length, 'CANDIDATE_VALUE', 'increments must not repeat an id.');
  return ids;
}
const optionalDate = (value: unknown, key: string) => {
  requireSketch(value === undefined || isCollectionDate(value), 'CANDIDATE_VALUE', `${key} must be a date written as YYYY-MM-DD.`);
  return value;
};
/** Every stored property, each problem an issue so one bad value never hides the others. */
function recordParts(properties: Record<string, unknown>, prefix: string, issues: CollectionIssue[]): Partial<CandidateRecord> {
  const parts: Partial<CandidateRecord> = {};
  const attempt = (read: () => void) => { try { read(); } catch (error) { issues.push(issue('CANDIDATE_VALUE', error instanceof Error ? error.message : 'Invalid value.')); } };
  attempt(() => { parts.version = readCandidateVersion(properties.version); });
  attempt(() => {
    const status = candidateStatus(String(properties.status));
    requireSketch(status, 'CANDIDATE_VALUE', `status must be one of ${candidateStatuses.map(item => item.id).join(', ')}.`);
    parts.status = status.id;
  });
  for (const [key, name] of [['created', 'created'], ['updated', 'updated']] as const)
    attempt(() => { requireSketch(isCollectionDate(properties[name]), 'CANDIDATE_VALUE', `${name} must be a date written as YYYY-MM-DD.`); parts[key] = String(properties[name]); });
  for (const [key, name] of [['frozen', 'frozen'], ['released', 'released'], ['targetDate', 'target-date']] as const)
    attempt(() => { const value = optionalDate(properties[name], name); if (value !== undefined) parts[key] = value; });
  attempt(() => { if (properties.owner !== undefined) parts.owner = owner(properties.owner); });
  attempt(() => { parts.increments = incrementIds(properties.increments ?? [], prefix); });
  return parts;
}
/** One README's frontmatter: ignored when it is not a release candidate, read-only when newer, otherwise a record plus issues. */
export function readCandidateRecord(properties: Record<string, unknown>, incrementPrefix: string): CandidateReading {
  if (properties.type !== candidateType) return { kind: 'ignored' };
  const version = properties.schema_version;
  if (typeof version === 'number' && version > 1) return { kind: 'future', issues: [issue('CANDIDATE_FUTURE', `schema_version ${version} is newer than this tool; the candidate is preserved and read-only.`)] };
  const issues: CollectionIssue[] = version === undefined || version === 1 ? [] : [issue('CANDIDATE_VALUE', 'schema_version must be 1.')];
  const record = completeRecord(recordParts(properties, incrementPrefix, issues));
  return issues.length || !record ? { kind: 'candidate', issues } : { kind: 'candidate', record, issues };
}
/** The record when every required part was read. */
function completeRecord(parts: Partial<CandidateRecord>): CandidateRecord | undefined {
  const { version, status, created, updated, increments } = parts;
  if (!version || !status || !created || !updated || !increments) return undefined;
  return { ...parts, version, status, created, updated, increments };
}
/** The README frontmatter of a record in a stable order. */
export function candidateFrontmatter(record: CandidateRecord): CollectionValues {
  const values: CollectionValues = { type: candidateType, version: record.version, status: record.status, created: record.created, updated: record.updated };
  if (record.frozen) values.frozen = record.frozen;
  if (record.released) values.released = record.released;
  if (record.targetDate) values['target-date'] = record.targetDate;
  if (record.owner) values.owner = record.owner;
  return { ...values, increments: [...record.increments], schema_version: 1 };
}
/** Optional keys a change may remove. */
export const candidateOptionalKeys: readonly string[] = ['frozen', 'released', 'target-date', 'owner'];
export interface CandidateInput { version?: string; targetDate?: string; owner?: string; increments: string[]; goal?: string }
/** `candidate new --input`: version (or --version), targetDate, owner, increments and an optional goal for the authored section. */
export function readCandidateInput(value: unknown, incrementPrefix: string): CandidateInput {
  const raw = object(value), allowed = ['version', 'targetDate', 'owner', 'increments', 'goal'];
  const unknown = Object.keys(raw).filter(key => !allowed.includes(key));
  requireSketch(!unknown.length, 'CANDIDATE_INPUT', `Unknown input ${unknown.join(', ')}; use ${allowed.join(', ')}.`);
  const blank = (item: unknown) => item === undefined || item === '';
  requireSketch(blank(raw.goal) || (typeof raw.goal === 'string' && raw.goal.length <= 4000 && !hasControls(raw.goal, true)), 'CANDIDATE_INPUT', 'goal needs text of at most 4000 characters.');
  return { ...(blank(raw.version) ? {} : { version: readCandidateVersion(raw.version) }), ...(blank(raw.targetDate) ? {} : { targetDate: String(optionalDate(raw.targetDate, 'targetDate')) }),
    ...(blank(raw.owner) ? {} : { owner: owner(raw.owner) }), increments: incrementIds(raw.increments ?? [], incrementPrefix), ...(blank(raw.goal) ? {} : { goal: String(raw.goal).trim() }) };
}
/** A new draft candidate. */
export function candidateCreate(input: CandidateInput & { version: string }, asOf: string): CandidateRecord {
  return { version: input.version, status: 'draft', created: asOf, updated: asOf, increments: [...input.increments],
    ...(input.targetDate ? { targetDate: input.targetDate } : {}), ...(input.owner ? { owner: input.owner } : {}) };
}
/** Adding or removing increments is allowed only while the candidate is a draft. */
export function candidateEditable(record: CandidateRecord): void {
  requireSketch(candidateStatus(record.status)!.editable, 'CANDIDATE_LOCKED', `${record.version} is ${record.status}; only a draft candidate changes its increments (move it back to draft first).`);
}
/** A checked status change with its dates: frozen is dated on freezing and cleared on returning to draft; released is dated once. */
export function candidateTransition(record: CandidateRecord, to: string, asOf: string): CandidateRecord {
  const next = candidateStatus(to), current = candidateStatus(record.status)!;
  requireSketch(next, 'CANDIDATE_STATUS', `--to must be one of ${candidateStatuses.map(item => item.id).join(', ')}.`);
  requireSketch(current.transitions.includes(next.id), 'CANDIDATE_TRANSITION', `${record.status} → ${to} is not allowed; from ${record.status} use ${current.transitions.join(', ') || 'no other status'}.`);
  requireSketch(next.id !== 'frozen' || record.increments.length > 0, 'CANDIDATE_EMPTY', 'Add at least one increment before freezing the candidate.');
  const result: CandidateRecord = { ...record, status: next.id, updated: asOf };
  if (next.id === 'frozen' && record.status === 'draft') result.frozen = asOf;
  if (next.id === 'draft') delete result.frozen;
  if (next.id === 'released') result.released = asOf;
  return result;
}
