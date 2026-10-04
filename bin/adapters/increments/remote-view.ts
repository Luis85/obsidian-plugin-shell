/**
 * The remote-facing view of a PullRequest document (domain remote-model.ts documents the mapping) and the inverse:
 * writing a merged view back into the document with the domain's span edits, so re-reading it yields the same view.
 */
import { appendAmendment, replacePullRequestRegion, setPullRequestField, setPullRequestStatus, writeTasks } from '../../domain/increments/pull-request-document.ts';
import { parseWikilink, resolveWikilink } from '../../domain/increments/wikilinks.ts';
import { OperationError } from '../framework/contracts.ts';
import type { IncrementModel, PullRequestModel } from '../../domain/increments/model.ts';
import type { LinkResolver, PullRequestStatus, RemoteDocumentLink, RemotePullRequestView } from '../../domain/increments/remote-model.ts';
import type { StoredDocument } from './repository.ts';

const statuses: readonly PullRequestStatus[] = ['New', 'Draft', 'Ready', 'Merged', 'Closed'];
export function pullRequestStatus(value: string): PullRequestStatus {
  const status = statuses.find(item => item === value);
  if (!status) throw new OperationError('PR_DOCUMENT_INVALID', `Unknown pull-request status "${value}".`);
  return status;
}
function documentLink(item: string): RemoteDocumentLink[] {
  const match = /^\[\[([^[\]\n]+)\]\]$/.exec(item.trim());
  if (!match) return [];
  const link = parseWikilink(match[1]!);
  return [{ target: link.path + (link.heading ? `#${link.heading}` : ''), label: link.alias ?? '' }];
}
/** The view of a PullRequest and its Increment; head and base must be set. */
export function pullRequestView(pull: StoredDocument<PullRequestModel>, increment: StoredDocument<IncrementModel>): RemotePullRequestView {
  const model = pull.model, delivers = model.kind === 'kickoff' || !model.delivers.length ? null : model.delivers;
  if (!model.head || !model.base) throw new OperationError('PR_HEAD_REQUIRED', `${pull.path} needs head and base branches before it is published.`, `node bin/app pr edit ${pull.id} --head <branch> --base <branch>`);
  return {
    id: model.id, title: model.title, kind: model.kind, increment: { id: increment.id, title: increment.model.title, path: increment.path }, planPath: pull.path,
    summary: model.regions.summary, scope: { in: [...model.scope.in], out: [...model.scope.out] },
    acceptance: increment.model.acceptance.filter(item => !delivers || delivers.includes(item.id)).map(item => ({ id: item.id, text: item.text, done: item.checked })),
    tasks: model.tasks.map(task => ({ id: task.id, text: task.text, done: task.checked })), documents: model.documents.flatMap(documentLink),
    notes: model.regions.notes, amendments: model.amendments.map(entry => ({ id: entry.id, date: entry.date, markdown: entry.body })), head: model.head, base: model.base,
  };
}
/** Resolves a wikilink target to a repository path, or null when it is missing or ambiguous. */
export const linkResolver = (files: readonly string[]): LinkResolver => target => {
  const resolved = resolveWikilink(files, target);
  return resolved.status === 'resolved' ? resolved.path : null;
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const scopeText = (scope: RemotePullRequestView['scope']) => ['### In scope', '', ...scope.in.map(item => `- ${item}`), '', '### Out of scope', '', ...scope.out.map(item => `- ${item}`)].join('\n');
const documentsText = (documents: readonly RemoteDocumentLink[]) => documents.map(entry => `- [[${entry.target}${entry.label ? `|${entry.label}` : ''}]]`).join('\n');
/** Writes the fields of `after` that differ from `before`; amendments are append-only. */
export function writeView(text: string, before: RemotePullRequestView, after: RemotePullRequestView): string {
  let next = text;
  if (after.title !== before.title) next = setPullRequestField(next, 'title', after.title);
  if (after.summary !== before.summary) next = replacePullRequestRegion(next, 'summary', after.summary);
  if (!same(after.scope, before.scope)) next = replacePullRequestRegion(next, 'scope', scopeText(after.scope));
  if (!same(after.documents, before.documents)) next = replacePullRequestRegion(next, 'documents', documentsText(after.documents));
  if (after.notes !== before.notes) next = replacePullRequestRegion(next, 'notes', after.notes);
  if (!same(after.tasks, before.tasks)) next = writeTasks(next, after.tasks.map(task => ({ id: task.id, checked: task.done, text: task.text })));
  const known = new Set(before.amendments.map(entry => entry.id));
  for (const entry of after.amendments.filter(item => !known.has(item.id))) next = appendAmendment(next, { id: entry.id, date: entry.date, body: entry.markdown }).text;
  for (const key of ['head', 'base'] as const) if (after[key] !== before[key]) next = setPullRequestField(next, key, after[key]);
  return next;
}
/** Writes the local status the platform reports. */
export const writeStatus = (text: string, before: string, after: PullRequestStatus): string => after === before ? text : setPullRequestStatus(text, after);
