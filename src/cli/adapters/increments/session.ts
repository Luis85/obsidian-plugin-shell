/**
 * One planning session over the delivery workspace: documents are read from disk, edits are kept in memory and
 * every edited Increment gets its generated pull-request and issue lists recomputed from the documents as they
 * will be after the plan. The result is one reviewed file plan; nothing is written here.
 */
import { createFilePlan } from '#shared/platform/file-plan.ts';
import { OperationError, type Context } from '../framework/contracts.ts';
import { parseIncrement } from '../../domain/increments/increment-document.ts';
import { parsePullRequest } from '../../domain/increments/pull-request-document.ts';
import { parseIssue } from '../../domain/increments/issue-document.ts';
import { setIssues, setPullRequests } from '../../domain/increments/generated-lists.ts';
import type { IncrementModel, IssueModel, IssueRow, PullRequestModel, PullRequestRow } from '../../domain/increments/model.ts';
import type { EditSummary } from '../../domain/increments/increment-document.ts';
import { DeliveryWorkspace, type DocumentKind, type StoredDocument } from './repository.ts';

export interface PlanSummary {
  document: { kind: DocumentKind; id: string; path: string };
  statusBefore: string | null; statusAfter: string | null;
  edits: EditSummary[];
}
type Warning = { code: string; message: string };
export interface SessionPlan { plan: Awaited<ReturnType<typeof createFilePlan>>; summary: PlanSummary & { warnings: Warning[] }; conflicts: string[]; steps?: unknown[]; prepare?: () => Promise<unknown>; finalize?: () => Promise<unknown> }
const parsers = { increment: parseIncrement, pullRequest: parsePullRequest, issue: parseIssue } as const;
type Models = { increment: IncrementModel; pullRequest: PullRequestModel; issue: IssueModel };

export class Session {
  private readonly writes = new Map<string, string>();
  private readonly touched = new Set<string>();
  readonly warnings: Warning[] = [];
  readonly ws: DeliveryWorkspace;
  private constructor(ws: DeliveryWorkspace) { this.ws = ws; }
  static async open(context: Context, write = true): Promise<Session> {
    const ws: DeliveryWorkspace = await DeliveryWorkspace.open(context);
    if (write) ws.requireNoDrift();
    return new Session(ws);
  }
  async text(path: string): Promise<string | null> { return this.writes.has(path) ? this.writes.get(path)! : this.ws.read(path); }
  write(path: string, text: string): void { this.writes.set(path, text); }
  /** A document as it will be after the plan; refuses a missing one with <KIND>_NOT_FOUND. */
  async get<K extends DocumentKind>(kind: K, id: string | undefined): Promise<StoredDocument<Models[K]>> {
    const stored = await this.ws.one(kind, id, parsers[kind] as (text: string) => Models[K]);
    const text = (await this.text(stored.path))!;
    return { ...stored, text, model: (parsers[kind] as (text: string) => Models[K])(text) };
  }
  async exists(kind: DocumentKind, id: string): Promise<boolean> { return (await this.text(this.ws.path(kind, id))) !== null; }
  /** Every document of a kind as it will be after the plan, including new ones. */
  async all<K extends DocumentKind>(kind: K): Promise<StoredDocument<Models[K]>[]> {
    const stored = kind === 'increment' ? await this.ws.increments() : kind === 'pullRequest' ? await this.ws.pullRequests() : await this.ws.issues();
    const prefix = this.ws.path(kind, '').slice(0, -3), parse = parsers[kind] as (text: string) => Models[K];
    const known = new Set(stored.map(doc => doc.path));
    const added = [...this.writes.keys()].filter(path => path.startsWith(prefix) && !path.slice(prefix.length).includes('/') && path.endsWith('.md') && !known.has(path));
    const docs = [...stored.map(doc => doc.path), ...added].sort();
    return Promise.all(docs.map(async path => { const text = (await this.text(path))!; return { id: path.slice(prefix.length, -3), path, text, model: parse(text) }; }));
  }
  /** Marks an Increment whose generated lists must be recomputed before planning. */
  touch(incrementId: string): void { if (incrementId) this.touched.add(incrementId); }
  warn(code: string, message: string): void { if (!this.warnings.some(item => item.code === code && item.message === message)) this.warnings.push({ code, message }); }

  private async refresh(incrementId: string): Promise<void> {
    const path = this.ws.path('increment', incrementId), text = await this.text(path);
    if (text === null) return;
    const model = parseIncrement(text);
    const lists = listed(model.pullRequests, await this.all('pullRequest'), incrementId), issueLists = listed(model.issues, await this.all('issue'), incrementId);
    const keeps = (key: string, ids: string[]) => ids.length > 0 || Object.hasOwn(model.frontmatter, key);
    let next = !keeps('pullRequests', lists.ids) ? text
      : setPullRequests(text, lists.ids, lists.ids.map(id => pullRequestRow(id, lists.docs.get(id), this.ws.path('pullRequest', id))));
    if (this.ws.allows('issues') && keeps('issues', issueLists.ids)) next = setIssues(next, issueLists.ids, issueLists.ids.map(id => issueRow(id, issueLists.docs.get(id), this.ws.path('issue', id))));
    else if (!this.ws.allows('issues') && issueLists.ids.length) this.warn('DELIVERY_SCHEMA_UNSUPPORTED', 'delivery.json handoff.optionalKeys does not list issues, so the Increment does not list its issues; each Issue still names its Increment.');
    if (next !== text) this.write(path, next);
  }
  /** The reviewed file plan of every edit, with the touched Increments refreshed. */
  async plan<Summary extends PlanSummary>(summary: Summary, extra: { steps?: unknown[]; prepare?: () => Promise<unknown>; finalize?: () => Promise<unknown> } = {}): Promise<SessionPlan> {
    for (const id of this.touched) await this.refresh(id);
    const entries = [];
    for (const [path, text] of this.writes) if (text !== await this.ws.read(path)) entries.push({ path, content: text });
    if (!entries.length && !extra.steps?.length) throw new OperationError('INCREMENT_UNCHANGED', 'Nothing to change: the documents already say this.');
    return { plan: await createFilePlan(this.ws.root, entries), summary: { ...summary, warnings: this.warnings }, conflicts: [], ...extra };
  }
}
/** Ids an Increment lists: its current order first, then documents naming it; ids moved to another increment drop out. */
function listed<M extends { increment: string }>(current: readonly string[], docs: readonly StoredDocument<M>[], incrementId: string): { ids: string[]; docs: Map<string, StoredDocument<M>> } {
  const byId = new Map(docs.map(doc => [doc.id, doc]));
  const owned = docs.filter(doc => doc.model.increment === incrementId).map(doc => doc.id);
  const kept = current.filter(id => !byId.has(id) || byId.get(id)!.model.increment === incrementId);
  return { ids: [...kept, ...owned.filter(id => !kept.includes(id))], docs: byId };
}
function pullRequestRow(id: string, doc: StoredDocument<PullRequestModel> | undefined, path: string): PullRequestRow {
  if (!doc) return { id, title: id, status: 'missing', path };
  const binding = doc.model.binding;
  return { id, title: doc.model.title || id, status: doc.model.status || 'New', path: doc.path, ...(binding ? { number: binding.number, url: binding.url } : {}) };
}
function issueRow(id: string, doc: StoredDocument<IssueModel> | undefined, path: string): IssueRow {
  return doc ? { id, title: doc.model.title || id, status: doc.model.status || 'New', path: doc.path } : { id, title: id, status: 'missing', path };
}
