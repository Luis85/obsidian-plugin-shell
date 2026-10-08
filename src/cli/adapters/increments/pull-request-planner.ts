/**
 * Planners of the local `pr …` commands. `pr new` plans a change pull request stacked on the increment branch
 * (and optionally its branch from the increment branch's latest commit); the edits follow the domain lock table,
 * so a published pull request only takes tasks and amendments. The Increment's generated list follows every edit.
 */
import { OperationError, type Context, type Request } from '../framework/contracts.ts';
import { changePullRequestStatus, editPullRequest, nextPullRequestId, parsePullRequest, renderPullRequest, type PullRequestOp } from '../../domain/increments/pull-request-document.ts';
import { editIssue } from '../../domain/increments/issue-document.ts';
import { branchNames, checkPullRequestBase, pullRequestBranches } from '../../domain/increments/branches.ts';
import { requireIncrementEditable } from '../../domain/increments/transitions.ts';
import { acceptanceStubPath, pullRequestSections } from '../../domain/increments/model.ts';
import { insistDelivery } from '../../domain/increments/errors.ts';
import type { EditSummary } from '../../domain/increments/increment-document.ts';
import { planBranch, runBranch } from '../../application/increments/git-port.ts';
import { requireIterationBranch } from './iteration-branch.ts';
import { Session, type SessionPlan } from './session.ts';
import { branchRequest, branchStep, checkedOption, commaList, flag, fragmentInput, inputRaw, option, requireBranchPlan } from './inputs.ts';

type Planner = (request: Request, context: Context) => Promise<SessionPlan>;
const editable = pullRequestSections.filter(name => name !== 'Amendments');
const document = (session: Session, id: string) => ({ kind: 'pullRequest' as const, id, path: session.ws.path('pullRequest', id) });

/** `--delivers` must name criteria of the increment. */
function delivered(request: Request, acceptance: readonly { id: string }[], incrementId: string): string[] {
  const delivers = commaList(option(request, 'delivers')), unknown = delivers.filter(item => !acceptance.some(criterion => criterion.id === item));
  insistDelivery(!unknown.length, 'PR_DOCUMENT_INVALID', `delivers names ${unknown.join(', ')}, which are not acceptance criteria of ${incrementId}.`);
  return delivers;
}
/** Head and base: explicit options or the change defaults; an explicit other base is a warning. */
function branchesOf(session: Session, request: Request, owner: { id: string; branch: string | null; base: string | null }, id: string): { head: string; base: string } {
  const schema = session.ws.schema, defaults = pullRequestBranches('change', owner, id, schema.branches), explicitBase = option(request, 'base');
  const base = explicitBase ?? defaults.base;
  for (const warning of checkPullRequestBase('change', base, owner, explicitBase !== undefined, schema.branches)) session.warn(warning.code, warning.message);
  return { head: option(request, 'head') ?? defaults.head, base };
}
async function newPullRequest(request: Request, context: Context): Promise<SessionPlan> {
  const session: Session = await Session.open(context), ws = session.ws, schema = ws.schema, increment = await session.get('increment', request.args[0]);
  requireIncrementEditable(increment.model.status);
  const id = option(request, 'id') ?? nextPullRequestId(increment.id, (await session.all('pullRequest')).map(doc => doc.id), schema);
  if (await session.exists('pullRequest', id)) throw new OperationError('PR_EXISTS', `${ws.path('pullRequest', id)} already exists.`, `node bin/app pr show ${id}`);
  const fragment = await fragmentInput(request, context, editable, 'PR_DOCUMENT_INVALID'), title = option(request, 'title') ?? fragment?.title;
  insistDelivery(title, 'PR_DOCUMENT_INVALID', 'Supply --title (or a # title in --input).');
  const owner = { id: increment.id, branch: increment.model.branch, base: increment.model.base };
  const { head, base } = branchesOf(session, request, owner, id), delivers = delivered(request, increment.model.acceptance, increment.id);
  await requireIterationBranch(session, increment.id, increment.model, { kind: 'change', head, base });
  const summary = option(request, 'summary');
  session.write(ws.path('pullRequest', id), renderPullRequest({ id, title, increment: { ...owner, title: increment.model.title, path: increment.path }, kind: 'change', head, base,
    branches: schema.branches, delivers, ...(summary ? { summary } : {}), fragment }, schema));
  session.touch(increment.id);
  const start = owner.branch ?? branchNames(schema.branches, increment.id).increment;
  const branch = requireBranchPlan(request, await planBranch(ws.git, branchRequest(request, head, [start, `origin/${start}`])));
  return session.plan({ document: document(session, id), statusBefore: null, statusAfter: 'New', edits: [{ section: 'document', action: 'add' }],
    kind: 'change', head, base, delivers, acceptance: delivers.map(ac => acceptanceStubPath(schema.acceptance, increment.id, ac)), branch },
  branchStep(branch, plan => runBranch(ws.git, plan)));
}

/** Applies pull-request ops in order and refreshes the owning Increment's list. */
async function editPlan(request: Request, context: Context, ops: (session: Session) => Promise<PullRequestOp[]>): Promise<SessionPlan> {
  const session: Session = await Session.open(context), doc = await session.get('pullRequest', request.args[0]);
  let text = doc.text;
  const edits: EditSummary[] = [];
  for (const op of await ops(session)) { const result = editPullRequest(text, op, await session.ws.files()); text = result.text; edits.push(...result.edits); }
  const updated = parsePullRequest(text), increment = await session.get('increment', doc.model.increment);
  await requireIterationBranch(session, increment.id, increment.model, updated);
  session.write(doc.path, text); session.touch(doc.model.increment);
  return session.plan({ document: document(session, doc.id), statusBefore: doc.model.status, statusAfter: doc.model.status, edits });
}
const second = (request: Request) => request.args[1] ?? '';
const fieldKeys = ['title', 'head', 'base'] as const;
const editPullRequestPlan: Planner = (request, context) => editPlan(request, context, async () => {
  const ops: PullRequestOp[] = fieldKeys.flatMap(key => { const value = option(request, key); return value === undefined ? [] : [{ kind: 'field' as const, key, value }]; });
  const summary = option(request, 'summary'), section = option(request, 'section');
  if (summary !== undefined) ops.push({ kind: 'section', name: 'Summary', body: summary });
  if (section) {
    const body = await inputRaw(request, context);
    insistDelivery(body !== null, 'PR_DOCUMENT_INVALID', '--section needs --input with the new section body.');
    ops.push({ kind: 'section', name: section, body });
  } else {
    const fragment = await fragmentInput(request, context, editable, 'PR_DOCUMENT_INVALID');
    if (fragment) ops.push({ kind: 'fragment', fragment });
  }
  insistDelivery(ops.length, 'PR_DOCUMENT_INVALID', 'Supply --title, --head, --base, --summary, --section with --input, or --input.');
  return ops;
});
const scopePlan = (side: 'in' | 'out'): Planner => (request, context) => editPlan(request, context, async () => [{ kind: 'scope', side, text: second(request) }]);
const taskAddPlan: Planner = (request, context) => editPlan(request, context, async () => [{ kind: 'task-add', text: second(request) }]);
const taskSetPlan: Planner = (request, context) => editPlan(request, context, async () => {
  const checked = checkedOption(request), body = option(request, 'text');
  insistDelivery(checked !== undefined || body !== undefined, 'PR_DOCUMENT_INVALID', 'Supply --status or --text.');
  return [{ kind: 'task-set', id: second(request), ...(checked === undefined ? {} : { checked }), ...(body === undefined ? {} : { text: body }) }];
});
const docAddPlan: Planner = (request, context) => editPlan(request, context, async () => {
  const label = option(request, 'label');
  return [{ kind: 'document', target: second(request), ...(label === undefined ? {} : { label }) }];
});
const notesPlan: Planner = (request, context) => editPlan(request, context, async () => {
  const body = await inputRaw(request, context);
  insistDelivery(body !== null, 'PR_DOCUMENT_INVALID', 'Supply the notes with --input <file|->.');
  return [{ kind: 'notes', body, replace: flag(request, 'replace') }];
});
const amendPlan: Planner = (request, context) => editPlan(request, context, async session => {
  const body = request.args[1] ?? await inputRaw(request, context);
  insistDelivery(body !== null && !(request.args[1] && request.options.input !== undefined), 'PR_DOCUMENT_INVALID', 'Supply the amendment as text or with --input, not both.');
  return [{ kind: 'amend', body, date: session.ws.now().toISOString().slice(0, 10) }];
});
async function statusPlan(request: Request, context: Context): Promise<SessionPlan> {
  const session: Session = await Session.open(context), doc = await session.get('pullRequest', request.args[0]);
  const text = changePullRequestStatus(doc.text, second(request));
  session.write(doc.path, text); session.touch(doc.model.increment);
  return session.plan({ document: document(session, doc.id), statusBefore: doc.model.status, statusAfter: parsePullRequest(text).status, edits: [{ section: 'frontmatter', action: 'set', itemId: 'status' }] });
}
/** Links an issue the pull request resolves: `issues` on the pull request and `pullRequests` on the issue. */
async function issueAddPlan(request: Request, context: Context): Promise<SessionPlan> {
  const session: Session = await Session.open(context), pull = await session.get('pullRequest', request.args[0]), issue = await session.get('issue', request.args[1]);
  if (issue.model.increment !== pull.model.increment) session.warn('ISSUE_INCREMENT_MISMATCH', `${issue.id} belongs to ${issue.model.increment}, ${pull.id} to ${pull.model.increment}.`);
  const linked = editPullRequest(pull.text, { kind: 'links', issues: [...new Set([...pull.model.issues, issue.id])] });
  session.write(pull.path, linked.text);
  session.write(issue.path, editIssue(issue.text, { kind: 'pull-requests', ids: [...new Set([...issue.model.pullRequests, pull.id])] }).text);
  session.touch(pull.model.increment);
  return session.plan({ document: document(session, pull.id), statusBefore: pull.model.status, statusAfter: pull.model.status, edits: linked.edits, issue: issue.path });
}

export const pullRequestPlanners: Record<string, Planner> = {
  'pr new': newPullRequest,
  'pr edit': editPullRequestPlan,
  'pr status': statusPlan,
  'pr task add': taskAddPlan,
  'pr task set': taskSetPlan,
  'pr doc add': docAddPlan,
  'pr scope add': scopePlan('in'),
  'pr out-of-scope add': scopePlan('out'),
  'pr notes': notesPlan,
  'pr amend': amendPlan,
  'pr issue add': issueAddPlan,
};
