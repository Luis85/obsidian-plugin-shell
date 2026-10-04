/**
 * Planners of the `issue …` commands: local Issue documents an Increment is broken down into. A new issue is
 * listed by its Increment when delivery.json allows the `issues` key; no issue tracker is contacted.
 */
import { OperationError, type Context, type Request } from '../framework/contracts.ts';
import { changeIssueStatus, editIssue, nextIssueId, parseIssue, renderIssue, type IssueOp } from '../../domain/increments/issue-document.ts';
import { issueSections } from '../../domain/increments/model.ts';
import { insistDelivery } from '../../domain/increments/errors.ts';
import { requireIncrementEditable } from '../../domain/increments/transitions.ts';
import type { EditSummary } from '../../domain/increments/increment-document.ts';
import { Session, type SessionPlan } from './session.ts';
import { checkedOption, fragmentInput, inputRaw, option } from './inputs.ts';

type Planner = (request: Request, context: Context) => Promise<SessionPlan>;
const document = (session: Session, id: string) => ({ kind: 'issue' as const, id, path: session.ws.path('issue', id) });

async function newIssue(request: Request, context: Context): Promise<SessionPlan> {
  const session = await Session.open(context), ws = session.ws, increment = await session.get('increment', request.args[0]);
  requireIncrementEditable(increment.model.status);
  const id = option(request, 'id') ?? nextIssueId(increment.id, (await session.all('issue')).map(doc => doc.id), ws.schema);
  if (await session.exists('issue', id)) throw new OperationError('ISSUE_EXISTS', `${ws.path('issue', id)} already exists.`, `node bin/app issue show ${id}`);
  const fragment = await fragmentInput(request, context, issueSections, 'ISSUE_DOCUMENT_INVALID');
  const title = option(request, 'title') ?? fragment?.title ?? increment.model.title, summary = option(request, 'summary');
  session.write(ws.path('issue', id), renderIssue({ id, title, increment: increment.id, ...(summary ? { summary } : {}), fragment }, ws.schema));
  session.touch(increment.id);
  return session.plan({ document: document(session, id), statusBefore: null, statusAfter: 'New', edits: [{ section: 'document', action: 'add' }], increment: increment.id });
}
async function editPlan(request: Request, context: Context, ops: (session: Session, acceptance: readonly string[] | undefined) => Promise<IssueOp[]>): Promise<SessionPlan> {
  const session = await Session.open(context), doc = await session.get('issue', request.args[0]);
  const increment = doc.model.increment && await session.exists('increment', doc.model.increment) ? (await session.get('increment', doc.model.increment)).model.acceptance : null;
  let text = doc.text;
  const edits: EditSummary[] = [];
  for (const op of await ops(session, increment?.map(item => item.id))) { const result = editIssue(text, op); text = result.text; edits.push(...result.edits); }
  session.write(doc.path, text); session.touch(doc.model.increment);
  return session.plan({ document: document(session, doc.id), statusBefore: doc.model.status, statusAfter: parseIssue(text).status, edits });
}
const second = (request: Request) => request.args[1] ?? '';
const editIssuePlan: Planner = (request, context) => editPlan(request, context, async () => {
  const ops: IssueOp[] = [], title = option(request, 'title'), summary = option(request, 'summary'), section = option(request, 'section');
  if (title !== undefined) ops.push({ kind: 'title', value: title });
  if (summary !== undefined) ops.push({ kind: 'section', name: 'Summary', body: summary });
  if (section) {
    const body = await inputRaw(request, context);
    insistDelivery(body !== null, 'ISSUE_DOCUMENT_INVALID', '--section needs --input with the new section body.');
    ops.push({ kind: 'section', name: section, body });
  } else {
    const fragment = await fragmentInput(request, context, issueSections, 'ISSUE_DOCUMENT_INVALID');
    if (fragment) ops.push({ kind: 'fragment', fragment });
  }
  insistDelivery(ops.length, 'ISSUE_DOCUMENT_INVALID', 'Supply --title, --summary, --section with --input, or --input.');
  return ops;
});
/** Status changes go through the issue table; Done and Cancelled are reopened by their status, never edited. */
async function statusPlan(request: Request, context: Context): Promise<SessionPlan> {
  const session = await Session.open(context), doc = await session.get('issue', request.args[0]);
  const text = changeIssueStatus(doc.text, second(request));
  session.write(doc.path, text); session.touch(doc.model.increment);
  return session.plan({ document: document(session, doc.id), statusBefore: doc.model.status, statusAfter: parseIssue(text).status, edits: [{ section: 'frontmatter', action: 'set', itemId: 'status' }] });
}
/** `AC-n` references the Increment's criterion and takes its text; anything else is an own criterion (IC-n). */
const acAddPlan: Planner = (request, context) => editPlan(request, context, async (session, acceptance) => {
  const value = second(request).trim();
  if (!/^AC-\d+$/.test(value)) return [{ kind: 'ac-add', text: value }];
  const issue = await session.get('issue', request.args[0]), increment = await session.get('increment', issue.model.increment);
  const criterion = increment.model.acceptance.find(item => item.id === value);
  return [{ kind: 'ac-add', ref: value, ...(acceptance ? { acceptance } : {}), text: criterion?.text.replace(/\s*Evidence:.*$/s, '') ?? value }];
});
const acSetPlan: Planner = (request, context) => editPlan(request, context, async () => {
  const checked = checkedOption(request), body = option(request, 'text');
  insistDelivery(checked !== undefined || body !== undefined, 'ISSUE_DOCUMENT_INVALID', 'Supply --status or --text.');
  return [{ kind: 'ac-set', id: second(request), ...(checked === undefined ? {} : { checked }), ...(body === undefined ? {} : { text: body }) }];
});

export const issuePlanners: Record<string, Planner> = {
  'issue new': newIssue,
  'issue edit': editIssuePlan,
  'issue status': statusPlan,
  'issue ac add': acAddPlan,
  'issue ac set': acSetPlan,
};
