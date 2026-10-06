/**
 * The sync record: the base snapshot of the last successful publish or sync, kept in a machine-owned file committed
 * next to the document (`.workbench/pull-requests/<id>.sync.json`). It stores hashes of normalized, canonical text
 * only: a three-way merge that takes the changed side needs to know *whether* a side changed, never the base text.
 * Hashes are over normalizeText (LF, trimmed line ends and ends) after the injected canonical form (resolved
 * wikilinks), so local wikilinks and remote blob links compare equal once converted back.
 */
import { insistRemote, isAmendmentId, isTaskId, normalizeText } from './remote-model.ts';
import type { LinkTarget, RemotePullRequestView, RemoteState, TextHash } from './remote-model.ts';
import type { HostingPlatform, PullRequestStatus } from './model.ts';
import { parseRemoteBody } from './remote-body.ts';

export type FrozenRegion = 'summary' | 'scope' | 'documents' | 'notes';
export const frozenRegions: readonly FrozenRegion[] = Object.freeze(['summary', 'scope', 'documents', 'notes']);
export interface Hashing { hash: TextHash; canonical?: (markdown: string) => string }
export interface SyncRecord {
  schemaVersion: 1;
  id: string;
  platform: HostingPlatform;
  repository: string;
  number: number;
  remoteRevision: string;
  bodySha256: string;
  derived: string;
  title: string;
  regions: Record<FrozenRegion, string>;
  tasks: Record<string, { text: string; checked: boolean }>;
  taskOrder: string[];
  amendments: Record<string, string>;
  state: PullRequestStatus;
  head: string;
  base: string;
  syncedAt: string;
}
type Content = Pick<RemotePullRequestView, 'title' | 'summary' | 'scope' | 'documents' | 'notes'>;

export const syncRecordPath = (id: string): string => `.workbench/pull-requests/${id}.sync.json`;
const canonicalOf = (hashing: Hashing) => (text: string): string => normalizeText(hashing.canonical ? hashing.canonical(text) : text);
/** The comparable text of a frozen region (or the title) of a view. */
export function regionText(view: Content, region: FrozenRegion | 'title', hashing: Hashing): string {
  const canonical = canonicalOf(hashing);
  switch (region) {
    case 'title': return normalizeText(view.title);
    case 'summary': return canonical(view.summary);
    case 'notes': return canonical(view.notes);
    case 'scope': return [...view.scope.in.map(item => `in: ${canonical(item)}`), ...view.scope.out.map(item => `out: ${canonical(item)}`)].join('\n');
    default: return view.documents.map(entry => canonical(`[[${entry.target}${entry.label ? '|' + entry.label : ''}]]`)).join('\n');
  }
}
export const textHash = (text: string, hashing: Hashing): string => hashing.hash(canonicalOf(hashing)(text));
export const amendmentHash = (amendment: { date: string; markdown: string }, hashing: Hashing): string =>
  hashing.hash(`${amendment.date.trim()}\n${canonicalOf(hashing)(amendment.markdown)}`);
/** sha256 of the canonical remote fields; adapters report it as `revision` so a plan can detect remote drift. */
export function remoteRevision(fields: { title: string; body: string; state: RemoteState; head: string; base: string }, hash: TextHash): string {
  return hash(JSON.stringify([fields.title, fields.body.replace(/\r\n?/g, '\n'), fields.state, fields.head, fields.base]));
}
export interface RecordInput {
  view: RemotePullRequestView;
  state: PullRequestStatus;
  platform: HostingPlatform;
  repository: string;
  number: number;
  remoteRevision: string;
  /** The remote body as written (or read back), whose managed block becomes the base. */
  body: string;
  links: LinkTarget;
  syncedAt: string;
}
/** The base snapshot after a successful publish or sync, from the merged view and the remote body as written. */
export function createSyncRecord(input: RecordInput, hashing: Hashing): SyncRecord {
  const { view } = input, parsed = parseRemoteBody(input.body, input.links);
  insistRemote(parsed.status === 'ok' && parsed.span, 'PR_REMOTE_MARKERS_MISSING', 'The written body has no managed block to record.');
  const regions = Object.fromEntries(frozenRegions.map(region => [region, hashing.hash(regionText(view, region, hashing))])) as Record<FrozenRegion, string>;
  return { schemaVersion: 1, id: view.id, platform: input.platform, repository: input.repository, number: input.number,
    remoteRevision: input.remoteRevision, bodySha256: hashing.hash(input.body.slice(parsed.span.start, parsed.span.end)),
    derived: hashing.hash(parsed.derived), title: hashing.hash(regionText(view, 'title', hashing)), regions,
    tasks: Object.fromEntries(view.tasks.map(task => [task.id, { text: textHash(task.text, hashing), checked: task.done }])),
    taskOrder: view.tasks.map(task => task.id),
    amendments: Object.fromEntries(view.amendments.map(entry => [entry.id, amendmentHash(entry, hashing)])),
    state: input.state, head: view.head, base: view.base, syncedAt: input.syncedAt };
}
/** Stable bytes: fixed key order, two-space JSON and a final newline. */
export function serializeSyncRecord(record: SyncRecord): string {
  const ordered = { schemaVersion: 1, id: record.id, platform: record.platform, repository: record.repository, number: record.number,
    remoteRevision: record.remoteRevision, bodySha256: record.bodySha256, derived: record.derived, title: record.title,
    regions: Object.fromEntries(frozenRegions.map(region => [region, record.regions[region]])), tasks: record.tasks, taskOrder: record.taskOrder,
    amendments: record.amendments, state: record.state, head: record.head, base: record.base, syncedAt: record.syncedAt };
  return JSON.stringify(ordered, null, 2) + '\n';
}
/** Digest stored as the binding's base snapshot. */
export const recordDigest = (record: SyncRecord, hash: TextHash): string => hash(serializeSyncRecord(record));

const recordKeys = ['schemaVersion', 'id', 'platform', 'repository', 'number', 'remoteRevision', 'bodySha256', 'derived', 'title', 'regions',
  'tasks', 'taskOrder', 'amendments', 'state', 'head', 'base', 'syncedAt'];
const statuses: readonly string[] = ['New', 'Draft', 'Ready', 'Merged', 'Closed'];
function plain(value: unknown, keys?: readonly string[]): Record<string, unknown> {
  insistRemote(value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)),
    'PR_SYNC_RECORD_INVALID', 'The sync record must be a JSON object.');
  const record = value as Record<string, unknown>;
  if (keys) insistRemote(Object.keys(record).length === keys.length && keys.every(key => Object.hasOwn(record, key)), 'PR_SYNC_RECORD_INVALID', 'The sync record has missing or unknown fields.');
  return record;
}
function short(value: unknown, max = 256): string {
  insistRemote(typeof value === 'string' && value.length > 0 && value.length <= max, 'PR_SYNC_RECORD_INVALID', 'The sync record holds an invalid string.');
  return value;
}
function hashMap<T>(value: unknown, valid: (key: string) => boolean, entry: (item: unknown) => T): Record<string, T> {
  const record = plain(value);
  insistRemote(Object.keys(record).every(valid), 'PR_SYNC_RECORD_INVALID', 'The sync record holds an invalid item id.');
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, entry(item)]));
}
function taskEntry(item: unknown): { text: string; checked: boolean } {
  const task = plain(item, ['text', 'checked']);
  insistRemote(typeof task.checked === 'boolean', 'PR_SYNC_RECORD_INVALID', 'A recorded task needs a boolean checked flag.');
  return { text: short(task.text), checked: task.checked };
}
/** Validates untrusted record bytes; corrupt or future records are refused, never repaired. */
export function parseSyncRecord(text: string): SyncRecord {
  let value: unknown;
  try { value = JSON.parse(text); } catch { insistRemote(false, 'PR_SYNC_RECORD_INVALID', 'The sync record is not JSON.'); }
  const record = plain(value, recordKeys);
  insistRemote(record.schemaVersion === 1, 'PR_SYNC_RECORD_INVALID', 'Unsupported sync record schemaVersion.');
  insistRemote(record.platform === 'github' || record.platform === 'azure-devops', 'PR_SYNC_RECORD_INVALID', 'Unknown platform in the sync record.');
  insistRemote(Number.isSafeInteger(record.number) && (record.number as number) > 0, 'PR_SYNC_RECORD_INVALID', 'The sync record needs a pull-request number.');
  insistRemote(statuses.includes(record.state as string), 'PR_SYNC_RECORD_INVALID', 'Unknown status in the sync record.');
  const order = record.taskOrder;
  insistRemote(Array.isArray(order) && order.every(id => typeof id === 'string' && isTaskId(id)), 'PR_SYNC_RECORD_INVALID', 'Invalid task order.');
  const regions = plain(record.regions, frozenRegions);
  return { schemaVersion: 1, id: short(record.id), platform: record.platform, repository: short(record.repository), number: record.number as number,
    remoteRevision: short(record.remoteRevision), bodySha256: short(record.bodySha256), derived: short(record.derived), title: short(record.title),
    regions: Object.fromEntries(frozenRegions.map(region => [region, short(regions[region])])) as Record<FrozenRegion, string>,
    tasks: hashMap(record.tasks, isTaskId, taskEntry), taskOrder: [...order as string[]],
    amendments: hashMap(record.amendments, isAmendmentId, item => short(item)), state: record.state as PullRequestStatus,
    head: short(record.head), base: short(record.base), syncedAt: short(record.syncedAt, 64) };
}
