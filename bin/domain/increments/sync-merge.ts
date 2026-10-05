/**
 * Pure three-way merge of a published pull request: local view (L), sync record (B, hashes only) and the remote
 * title/body/state (R, parsed with parseRemoteBody). Per field and per task/amendment id it takes the changed side;
 * a change on both sides to different values is a conflict resolved only by `--prefer` or an explicit resolution.
 * Published documents are edit-locked except tasks and amendments, so a local-only edit of the title or a frozen
 * region is refused (`PR_LOCKED_REGION_EDITED`). Merged or closed remotes are synced pull-only (`PR_TERMINAL` for any
 * local change). The remote is authoritative for status, head and base. Syncing the result again is a no-op.
 */
import { idNumber, normalizeText } from './remote-model.ts';
import type { RemoteAmendment, RemotePullRequestView, RemoteState, RemoteTask } from './remote-model.ts';
import type { HostingPlatform, PullRequestStatus } from './model.ts';
import { composeRemoteBody, parseRemoteBody, renderManagedBlock, requireBodyFits } from './remote-body.ts';
import type { BodyOptions, ParsedAmendment, ParsedRemoteBody, ParsedTask } from './remote-body.ts';
import { isTerminalState, statusFromRemote } from './remote-state.ts';
import { amendmentHash, frozenRegions, regionText, textHash } from './sync-record.ts';
import type { FrozenRegion, Hashing, SyncRecord } from './sync-record.ts';

export type Side = 'local' | 'remote';
type Decision = 'unchanged' | 'pull' | 'push' | 'conflict';
export interface Conflict { key: string; kind: string; code: string; local: string | null; remote: string | null; allowed: Side[] }
export interface SyncWarning { code: string; message: string }
interface ItemReport { pulled: string[]; pushed: string[]; imported: string[]; restored: string[]; removed: string[] }
export interface MergeReport {
  title: Decision;
  regions: Record<FrozenRegion, Decision>;
  tasks: ItemReport;
  amendments: ItemReport;
  status: { before: PullRequestStatus; after: PullRequestStatus };
}
export interface RemoteSnapshot { title: string; body: string; state: RemoteState; head: string; base: string }
export interface SyncInput {
  local: RemotePullRequestView;
  localStatus: PullRequestStatus;
  record: SyncRecord;
  remote: RemoteSnapshot;
  platform: HostingPlatform;
  body: BodyOptions;
  hashing: Hashing;
  /** UTC date (YYYY-MM-DD) for amendments added remotely without one. */
  today: string;
  prefer?: Side;
  resolutions?: Record<string, Side>;
}
export interface SyncOutcome {
  status: 'unchanged' | 'changed' | 'blocked';
  view: RemotePullRequestView;
  localStatus: PullRequestStatus;
  localChanged: boolean;
  remotePatch: { title?: string; body?: string } | null;
  conflicts: Conflict[];
  warnings: SyncWarning[];
  report: MergeReport;
  unmanagedChars: number;
  pullOnly: boolean;
}
interface Merge {
  hashing: Hashing;
  pullOnly: boolean;
  conflicts: Conflict[];
  warnings: SyncWarning[];
  choose(key: string, kind: string, local: string | null, remote: string | null, allowed?: Side[], refusal?: string): Side | null;
}
const both: Side[] = ['local', 'remote'];
const excerpt = (text: string | null): string | null => text === null ? null : text.length > 200 ? text.slice(0, 199) + '…' : text;
const emptyItems = (): ItemReport => ({ pulled: [], pushed: [], imported: [], restored: [], removed: [] });

function createMerge(input: SyncInput, pullOnly: boolean): Merge {
  const conflicts: Conflict[] = [], warnings: SyncWarning[] = [];
  function choose(key: string, kind: string, local: string | null, remote: string | null, allowed = both, refusal = 'PR_SYNC_CONFLICT'): Side | null {
    const permitted = pullOnly ? allowed.filter(side => side === 'remote') : allowed;
    const chosen = input.resolutions?.[key] ?? input.prefer;
    if (chosen && permitted.includes(chosen)) return chosen;
    const code = pullOnly && allowed.includes('local') ? 'PR_TERMINAL' : allowed.length === 1 ? refusal : 'PR_SYNC_CONFLICT';
    conflicts.push({ key, kind, code, local: excerpt(local), remote: excerpt(remote), allowed: permitted });
    return null;
  }
  return { hashing: input.hashing, pullOnly, conflicts, warnings, choose };
}
/** Keeps a local-only change: always outside pull-only mode, otherwise only when a conflict leaves it unresolved. */
function keepLocal(merge: Merge, key: string, local: string, remote: string | null): boolean {
  return !merge.pullOnly || merge.choose(`${key}:terminal`, 'terminal', local, remote, ['remote'], 'PR_TERMINAL') !== 'remote';
}

/** Title and frozen regions: locked after publish, so only the remote may change them alone. */
function mergeLocked(merge: Merge, key: string, local: string, remote: string, base: string): { side: Side; decision: Decision } {
  const changedLocally = merge.hashing.hash(local) !== base, changedRemotely = merge.hashing.hash(remote) !== base;
  if (local === remote || (!changedLocally && !changedRemotely)) return { side: 'local', decision: 'unchanged' };
  if (!changedLocally) return { side: 'remote', decision: 'pull' };
  const chosen = changedRemotely ? merge.choose(key, 'both-changed', local, remote)
    : merge.choose(`${key}:local-edit-locked`, 'local-edit-locked', local, remote, ['remote'], 'PR_LOCKED_REGION_EDITED');
  return chosen === null ? { side: 'local', decision: 'conflict' } : { side: chosen, decision: chosen === 'local' ? 'push' : 'pull' };
}
type Content = Pick<RemotePullRequestView, 'title' | FrozenRegion>;
function mergeContent(merge: Merge, local: RemotePullRequestView, remote: Content, record: SyncRecord) {
  const content: Content = { title: local.title, summary: local.summary, scope: local.scope, documents: local.documents, notes: local.notes };
  const title = mergeLocked(merge, 'title', regionText(local, 'title', merge.hashing), regionText(remote, 'title', merge.hashing), record.title);
  if (title.side === 'remote') content.title = remote.title.trim();
  const regions = {} as Record<FrozenRegion, Decision>;
  for (const region of frozenRegions) {
    const result = mergeLocked(merge, `region:${region}`, regionText(local, region, merge.hashing), regionText(remote, region, merge.hashing), record.regions[region]);
    regions[region] = result.decision;
    if (result.side === 'remote') Object.assign(content, { [region]: remote[region] });
  }
  return { content, title: title.decision, regions };
}

interface Item { id: string; text: string; done: boolean; date: string }
interface Base { text: string; checked: boolean | null }
interface ItemKind { label: 'task' | 'amendment'; prefix: 'T' | 'A'; key: (item: Item) => string }
const taskKind: ItemKind = { label: 'task', prefix: 'T', key: item => item.text };
const amendmentKind: ItemKind = { label: 'amendment', prefix: 'A', key: item => `${item.date}\n${item.text}` };
function itemHash(merge: Merge, kind: ItemKind, item: Item): string {
  return kind.label === 'task' ? textHash(item.text, merge.hashing) : amendmentHash({ date: item.date, markdown: item.text }, merge.hashing);
}
/** Both sides and the base hold the id: done flags never conflict, text merges three-way. */
function mergeKept(merge: Merge, kind: ItemKind, local: Item, remote: Item, base: Base | null, report: ItemReport): Item {
  const key = `${kind.label}:${local.id}`;
  const done = mergeDone(merge, key, local, remote, base);
  const localHash = itemHash(merge, kind, local), remoteHash = itemHash(merge, kind, remote);
  const side = localHash === remoteHash ? 'local' : textSide(merge, `${key}:text`, [kind.key(local), kind.key(remote)], [localHash, remoteHash], base);
  if (side === 'remote' || done !== local.done) report.pulled.push(local.id);
  else if (localHash !== remoteHash || done !== remote.done) report.pushed.push(local.id);
  return { ...(side === 'local' ? local : remote), done };
}
/** Differing texts: take the only changed side, ask for a resolution when both changed, refuse local in pull-only. */
function textSide(merge: Merge, key: string, texts: [string, string], hashes: [string, string], base: Base | null): Side {
  const changedLocally = base === null || hashes[0] !== base.text, changedRemotely = base === null || hashes[1] !== base.text;
  if (!changedRemotely) return keepLocal(merge, key, texts[0], texts[1]) ? 'local' : 'remote';
  if (!changedLocally) return 'remote';
  return merge.choose(key, 'both-changed', texts[0], texts[1]) ?? 'local';
}
/** Done flags never conflict: a local change since the base wins, otherwise the remote value is taken. */
function mergeDone(merge: Merge, key: string, local: Item, remote: Item, base: Base | null): boolean {
  if (local.done === remote.done || base === null || base.checked === null || local.done === base.checked) return remote.done;
  return keepLocal(merge, `${key}:done`, String(local.done), String(remote.done)) ? local.done : remote.done;
}
/** One side lost an id the base still has (or a new local id never reached the remote). */
function mergeOneSided(merge: Merge, kind: ItemKind, local: Item | undefined, remote: Item | undefined, base: Base | null, report: ItemReport): Item | null {
  const id = (local ?? remote)!.id, key = `${kind.label}:${id}`;
  if (!base) return newItem(merge, key, kind, local, remote, report);
  if (local) {
    const side = merge.choose(`${key}:deleted-remotely`, 'deleted-remotely', kind.key(local), null);
    if (side !== null) report[side === 'local' ? 'restored' : 'removed'].push(id);
    return side === 'remote' ? null : local;
  }
  const side = merge.choose(`${key}:deleted-locally`, 'deleted-locally', null, kind.key(remote!));
  if (side !== null) report[side === 'remote' ? 'restored' : 'removed'].push(id);
  return side === 'remote' ? remote! : null;
}
/** An id only one side has ever seen: a local addition is pushed (unless pull-only), a remote one imported. */
function newItem(merge: Merge, key: string, kind: ItemKind, local: Item | undefined, remote: Item | undefined, report: ItemReport): Item | null {
  if (remote) { report.imported.push(remote.id); return remote; }
  if (!keepLocal(merge, key, kind.key(local!), null)) return null;
  report.pushed.push(local!.id);
  return local!;
}
interface Incoming { id: string | null; text: string; done: boolean; date: string }
/** Remote items without an id (or with a duplicate id) get the next free id, unless their text matches an item the
 * remote no longer lists by id, which is then kept under its old id. */
function assignIds(merge: Merge, kind: ItemKind, incoming: Incoming[], local: Item[], baseIds: string[]): { identified: Item[]; fresh: Item[] } {
  const seen = new Set<string>(), identified: Item[] = [], anonymous: Incoming[] = [];
  for (const item of incoming) {
    if (item.id && !seen.has(item.id)) { seen.add(item.id); identified.push({ ...item, id: item.id }); continue; }
    if (item.id) merge.warnings.push({ code: 'PR_REMOTE_ID_DUPLICATE', message: `The remote body repeats ${item.id}; the repeat was imported under a new id.` });
    anonymous.push(item);
  }
  let next = Math.max(0, ...[...local.map(item => item.id), ...baseIds, ...seen].map(idNumber)) + 1;
  const fresh: Item[] = [];
  for (const item of anonymous) {
    const match = local.find(candidate => !seen.has(candidate.id) && itemHash(merge, kind, candidate) === itemHash(merge, kind, { ...item, id: candidate.id }));
    if (match) { seen.add(match.id); identified.push({ ...item, id: match.id }); continue; }
    fresh.push({ ...item, id: `${kind.prefix}-${next++}` });
  }
  return { identified, fresh };
}
function mergeItems(merge: Merge, kind: ItemKind, local: Item[], incoming: Incoming[], base: Map<string, Base>, report: ItemReport): Item[] {
  const { identified, fresh } = assignIds(merge, kind, incoming, local, [...base.keys()]);
  const remoteById = new Map(identified.map(item => [item.id, item])), localById = new Map(local.map(item => [item.id, item]));
  const order = [...local.map(item => item.id), ...identified.map(item => item.id).filter(id => !localById.has(id))];
  const merged: Item[] = [];
  for (const id of order) {
    const localItem = localById.get(id), remoteItem = remoteById.get(id), baseItem = base.get(id) ?? null;
    const item = localItem && remoteItem ? mergeKept(merge, kind, localItem, remoteItem, baseItem, report) : mergeOneSided(merge, kind, localItem, remoteItem, baseItem, report);
    if (item) merged.push(item);
  }
  for (const item of fresh) { report.imported.push(item.id); merged.push(item); }
  return merged;
}
const taskItems = (tasks: Array<RemoteTask | ParsedTask>): Incoming[] => tasks.map(task => ({ id: task.id, text: task.text, done: task.done, date: '' }));
const amendmentItems = (amendments: Array<RemoteAmendment | ParsedAmendment>, today: string): Incoming[] =>
  amendments.map(entry => ({ id: entry.id, text: entry.markdown, done: false, date: entry.date || today }));

function remoteContent(parsed: ParsedRemoteBody, local: RemotePullRequestView, remoteTitle: string, today: string) {
  if (parsed.status !== 'ok') return { content: { title: remoteTitle, summary: local.summary, scope: local.scope, documents: local.documents, notes: local.notes },
    tasks: taskItems(local.tasks), amendments: amendmentItems(local.amendments, today) };
  return { content: { title: remoteTitle, summary: parsed.summary, scope: parsed.scope, documents: parsed.documents, notes: parsed.notes },
    tasks: taskItems(parsed.tasks), amendments: amendmentItems(parsed.amendments, today) };
}
function markersProblem(merge: Merge, parsed: ParsedRemoteBody, id: string): ParsedRemoteBody | null {
  const problem = parsed.status !== 'ok' ? parsed.problem : parsed.id !== id ? `the managed block belongs to ${parsed.id}` : null;
  if (problem === null) return parsed;
  const side = merge.choose('body:markers', 'markers', null, problem, ['local'], 'PR_REMOTE_MARKERS_MISSING');
  return side === 'local' ? { ...parsed, status: 'malformed', problem } : null;
}

/** Plans one sync: the merged view, the local status and the remote patch (null when nothing must be written). */
export function syncPullRequest(input: SyncInput): SyncOutcome {
  const pullOnly = isTerminalState(input.remote.state), merge = createMerge(input, pullOnly);
  const raw = parseRemoteBody(input.remote.body, input.body.links);
  const parsed = markersProblem(merge, raw, input.local.id);
  const status = statusFromRemote(input.localStatus, input.remote.state, input.record.state);
  if (status.warning) merge.warnings.push({ code: status.warning, message: `The local status ${status.before} is replaced by the remote ${status.after}.` });
  const report: MergeReport = { title: 'unchanged', regions: { summary: 'unchanged', scope: 'unchanged', documents: 'unchanged', notes: 'unchanged' },
    tasks: emptyItems(), amendments: emptyItems(), status: { before: status.before, after: status.after } };
  if (!parsed) return finish(input, merge, input.local, raw, report, status.after);
  if (parsed.status === 'ok' && input.hashing.hash(parsed.derived) !== input.record.derived)
    merge.warnings.push({ code: 'PR_REMOTE_DERIVED_EDIT_DISCARDED', message: 'Edits to the generated header or acceptance criteria on the remote are replaced on the next write.' });
  const remote = remoteContent(parsed, input.local, input.remote.title, input.today);
  const content = mergeContent(merge, input.local, remote.content, input.record);
  Object.assign(report, { title: content.title, regions: content.regions });
  const taskBase = new Map(Object.entries(input.record.tasks).map(([id, entry]) => [id, { text: entry.text, checked: entry.checked }]));
  const tasks = mergeItems(merge, taskKind, taskItems(input.local.tasks).map(item => ({ ...item, id: item.id! })), remote.tasks, taskBase, report.tasks);
  const amendmentBase = new Map(Object.entries(input.record.amendments).map(([id, text]) => [id, { text, checked: null }]));
  const amendments = mergeItems(merge, amendmentKind, amendmentItems(input.local.amendments, input.today).map(item => ({ ...item, id: item.id! })),
    remote.amendments, amendmentBase, report.amendments);
  const view: RemotePullRequestView = { ...input.local, ...content.content, head: input.remote.head, base: input.remote.base,
    tasks: tasks.map(item => ({ id: item.id, text: item.text, done: item.done })),
    amendments: amendments.map(item => ({ id: item.id, date: item.date, markdown: item.text })) };
  return finish(input, merge, view, parsed, report, status.after);
}
/** Order-independent identity of a view's fields, so key order in callers' objects never reads as a change. */
function viewKey(view: RemotePullRequestView): string {
  return JSON.stringify([view.id, view.title, view.increment.id, view.increment.title, view.increment.path, view.planPath, view.summary, view.scope.in, view.scope.out,
    view.acceptance.map(entry => [entry.id, entry.text, entry.done]), view.tasks.map(task => [task.id, task.text, task.done]),
    view.documents.map(entry => [entry.target, entry.label]), view.notes, view.amendments.map(entry => [entry.id, entry.date, entry.markdown]), view.head, view.base]);
}
function finish(input: SyncInput, merge: Merge, view: RemotePullRequestView, parsed: ParsedRemoteBody, report: MergeReport, after: PullRequestStatus): SyncOutcome {
  const blocked = merge.conflicts.length > 0;
  const remotePatch = blocked || merge.pullOnly ? null : patchFor(input, view, parsed);
  const localChanged = !blocked && (viewKey(view) !== viewKey(input.local) || after !== input.localStatus);
  return { status: blocked ? 'blocked' : localChanged || remotePatch ? 'changed' : 'unchanged', view: blocked ? input.local : view,
    localStatus: blocked ? input.localStatus : after, localChanged, remotePatch, conflicts: merge.conflicts, warnings: merge.warnings, report,
    unmanagedChars: parsed.unmanagedChars, pullOnly: merge.pullOnly };
}
function patchFor(input: SyncInput, view: RemotePullRequestView, parsed: ParsedRemoteBody): { title?: string; body?: string } | null {
  const body = composeRemoteBody(input.remote.body, parsed, renderManagedBlock(view, input.body));
  const patch: { title?: string; body?: string } = {};
  if (normalizeText(view.title) !== normalizeText(input.remote.title)) patch.title = view.title;
  if (normalizeText(body) !== normalizeText(input.remote.body)) { requireBodyFits(body, input.platform); patch.body = body; }
  return patch.title === undefined && patch.body === undefined ? null : patch;
}
