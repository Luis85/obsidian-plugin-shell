/**
 * Planners of the `increment …` commands. `increment new` plans the Increment, its kick-off pull request, the
 * corresponding Issue, acceptance test stubs and the increment branch as one reviewed plan; the other commands
 * are span edits of one Increment (plus the documents they link).
 */
import { OperationError, type Context, type Request } from '../framework/contracts.ts';
import { editIncrement, renderIncrement, type IncrementEdit } from '../../domain/increments/increment-document.ts';
import { kickoffPullRequest, editPullRequest } from '../../domain/increments/pull-request-document.ts';
import { issueDocument, kickoffDocument } from './kickoff.ts';
import { nextIssueId } from '../../domain/increments/issue-document.ts';
import { branchNames } from '../../domain/increments/branches.ts';
import { checkIncrementTransition, requireIncrementEditable } from '../../domain/increments/transitions.ts';
import { setFrontmatterValue } from '../../domain/increments/frontmatter.ts';
import { insistDelivery } from '../../domain/increments/errors.ts';
import { isDeliverySlug } from '../../domain/increments/model.ts';
import { planBranch, runBranch } from '../../application/increments/git-port.ts';
import { Session, type SessionPlan } from './session.ts';
import { planAcceptanceStubs } from './stubs.ts';
import { readiness } from './delivery-gates.ts';
import { branchRequest, branchStep, checkedOption, commaList, flag, fragmentInput, inputRaw, option, requireBranchPlan } from './inputs.ts';
import type { InputFragment } from '../../domain/increments/input-fragment.ts';

type Planner = (request: Request, context: Context) => Promise<SessionPlan>;
const document = (session: Session, id: string) => ({ kind: 'increment' as const, id, path: session.ws.path('increment', id) });

type Names = ReturnType<typeof branchNames>;
/** The Increment text from the template, the options and the --input fragment; branch keys only when delivery.json allows them. */
function incrementDocument(session: Session, request: Request, input: { id: string; title: string; fragment: InputFragment | null; names: Names }): string {
  const ws = session.ws, keys = ws.allows('branch') && ws.allows('base') ? { branch: input.names.increment, base: input.names.base } : {};
  if (!keys.branch) session.warn('DELIVERY_SCHEMA_UNSUPPORTED', 'delivery.json handoff.optionalKeys does not list branch and base; the branch names come from the configured patterns.');
  const given = Object.fromEntries((['owner', 'size', 'e2e'] as const).flatMap(key => { const value = option(request, key); return value === undefined ? [] : [[key, value]]; }));
  const from = option(request, 'from');
  return renderIncrement({ id: input.id, title: input.title, ...given, refs: from ? [from] : [], fragment: input.fragment, ...keys }, { schema: ws.schema, ...(ws.template ? { template: ws.template } : {}) });
}
/** The kick-off pull request and (unless --no-issue) the corresponding issue; returns their paths. */
async function companions(session: Session, request: Request, input: { id: string; title: string; path: string; names: Names }): Promise<{ pullRequest: string; issue: string | null }> {
  const ws = session.ws, schema = ws.schema;
  const kickoff = kickoffPullRequest({ id: input.id, title: input.title, path: input.path, branch: input.names.increment, base: input.names.base }, schema);
  if (await session.exists('pullRequest', kickoff.id)) throw new OperationError('PR_EXISTS', `${ws.path('pullRequest', kickoff.id)} already exists.`);
  session.write(ws.path('pullRequest', kickoff.id), kickoffDocument(kickoff, schema, input.names));
  const issue = flag(request, 'no-issue') ? null : nextIssueId(input.id, (await session.all('issue')).map(doc => doc.id), schema);
  if (issue) session.write(ws.path('issue', issue), issueDocument({ id: issue, title: input.title, increment: input.id, path: input.path }, schema));
  return { pullRequest: ws.path('pullRequest', kickoff.id), issue: issue ? ws.path('issue', issue) : null };
}
async function newIncrement(request: Request, context: Context): Promise<SessionPlan> {
  const session: Session = await Session.open(context), ws = session.ws, id = request.args[0] ?? '', schema = ws.schema;
  insistDelivery(isDeliverySlug(id, schema), 'INCREMENT_ID_INVALID', `"${id}" must match ${schema.handoff.slugPattern} with at most ${schema.handoff.maxSlugLength} characters.`);
  if (await session.exists('increment', id)) throw new OperationError('INCREMENT_EXISTS', `${ws.path('increment', id)} already exists.`, `node bin/app increment show ${id}`);
  const fragment = await fragmentInput(request, context, schema.handoff.sections, 'INCREMENT_INPUT_INVALID');
  const title = option(request, 'title') ?? fragment?.title;
  insistDelivery(title, 'INCREMENT_INPUT_INVALID', 'Supply --title (or a # title in --input).');
  const names = branchNames(schema.branches, id), path = ws.path('increment', id);
  session.write(path, incrementDocument(session, request, { id, title, fragment, names }));
  const linked = await companions(session, request, { id, title, path, names });
  session.touch(id);
  const stubs = await planAcceptanceStubs(session, id);
  const branch = requireBranchPlan(request, await planBranch(ws.git, branchRequest(request, names.increment, [`origin/${names.base}`, names.base])));
  return session.plan({ document: document(session, id), statusBefore: null, statusAfter: 'New', edits: [{ section: 'document', action: 'add' }],
    created: { increment: path, ...linked, stubs: stubs.created }, stubs, branch }, branchStep(branch, plan => runBranch(ws.git, plan)));
}

/** Applies Increment edits and plans stubs when criteria may have changed. */
async function editPlan(request: Request, context: Context, edits: (session: Session) => Promise<IncrementEdit[]>, stubs = false): Promise<SessionPlan> {
  const session: Session = await Session.open(context), doc = await session.get('increment', request.args[0]);
  let text = doc.text;
  const summary = [];
  for (const edit of await edits(session)) {
    const result = editIncrement(text, edit, { schema: session.ws.schema, files: await session.ws.files() });
    text = result.text; summary.push(...result.edits);
  }
  session.write(doc.path, text);
  const report = stubs ? await planAcceptanceStubs(session, doc.id) : undefined;
  return session.plan({ document: document(session, doc.id), statusBefore: doc.model.status, statusAfter: doc.model.status, edits: summary, ...(report ? { stubs: report } : {}) });
}
const fields = ['title', 'owner', 'size', 'e2e'] as const;
const editIncrementPlan: Planner = (request, context) => editPlan(request, context, async session => {
  const edits: IncrementEdit[] = fields.flatMap(key => { const value = option(request, key); return value === undefined ? [] : [{ kind: 'field' as const, key, value }]; });
  const section = option(request, 'section'), fragment = section ? null : await fragmentInput(request, context, session.ws.schema.handoff.sections, 'INCREMENT_INPUT_INVALID');
  if (section) {
    const body = await inputRaw(request, context);
    insistDelivery(body !== null, 'INCREMENT_INPUT_INVALID', '--section needs --input with the new section body.');
    edits.push({ kind: 'section', name: section, body });
  }
  if (fragment) edits.push({ kind: 'fragment', fragment });
  insistDelivery(edits.length, 'INCREMENT_INPUT_INVALID', 'Supply a field option, --section with --input, or --input with ## sections.');
  return edits;
}, true);
const text = (request: Request) => request.args[1] ?? '';
const scopePlan = (side: 'in' | 'out'): Planner => (request, context) => editPlan(request, context, async () => [{ kind: 'scope', side, text: text(request) }]);
const acAddPlan: Planner = (request, context) => editPlan(request, context, async () => [{ kind: 'ac-add', text: text(request) }], true);
const acSetPlan: Planner = (request, context) => editPlan(request, context, async () => {
  const checked = checkedOption(request), body = option(request, 'text'), evidence = option(request, 'evidence');
  insistDelivery(checked !== undefined || body !== undefined || evidence !== undefined, 'INCREMENT_INPUT_INVALID', 'Supply --status, --text or --evidence.');
  return [{ kind: 'ac-set', id: text(request), ...(checked === undefined ? {} : { checked }), ...(body === undefined ? {} : { text: body }), ...(evidence === undefined ? {} : { evidence: commaList(evidence) }) }];
});
const refAddPlan: Planner = (request, context) => editPlan(request, context, async () => [{ kind: 'ref-add', ref: text(request) }]);

async function statusPlan(request: Request, context: Context): Promise<SessionPlan> {
  const session: Session = await Session.open(context), doc = await session.get('increment', request.args[0]);
  const pulls = (await session.all('pullRequest')).filter(pull => pull.model.increment === doc.id);
  const kickoff = pulls.find(pull => pull.model.kind === 'kickoff')?.model.status;
  const changes = pulls.filter(pull => pull.model.kind !== 'kickoff').map(pull => pull.model.status);
  const target = text(request), ready = /^ready$/i.test(target.trim()) ? await readiness(session.ws, doc.path, doc.text) : null;
  const to = checkIncrementTransition(doc.model.status, target,
    { pullRequests: changes, ...(kickoff === undefined ? {} : { kickoff }), ...(ready ? { readiness: ready.problems } : {}) });
  session.write(doc.path, setFrontmatterValue(doc.text, 'status', to, { after: session.ws.schema.handoff.requiredKeys }));
  return session.plan({ document: document(session, doc.id), statusBefore: doc.model.status, statusAfter: to, edits: [{ section: 'frontmatter', action: 'set', itemId: 'status' }],
    ...(ready ? { readiness: ready.source } : {}) });
}
/** Moves a New pull request to another Increment; both Increments' lists are recomputed. */
async function attachPlan(request: Request, context: Context): Promise<SessionPlan> {
  const session: Session = await Session.open(context), target = await session.get('increment', request.args[0]), pull = await session.get('pullRequest', request.args[1]);
  requireIncrementEditable(target.model.status);
  const previous = pull.model.increment;
  if (previous === target.id) throw new OperationError('INCREMENT_UNCHANGED', `${pull.id} already belongs to ${target.id}.`);
  const op = { kind: 'increment' as const, id: target.id, title: target.model.title, path: target.path, ...(previous ? { previousPath: session.ws.path('increment', previous) } : {}) };
  const result = editPullRequest(pull.text, op);
  session.write(pull.path, result.text);
  session.touch(target.id); session.touch(previous);
  return session.plan({ document: document(session, target.id), statusBefore: target.model.status, statusAfter: target.model.status, edits: result.edits, moved: { pullRequest: pull.id, from: previous || null, to: target.id } });
}

export const incrementDocumentPlanners: Record<string, Planner> = {
  'increment new': newIncrement,
  'increment edit': editIncrementPlan,
  'increment status': statusPlan,
  'increment scope add': scopePlan('in'),
  'increment out-of-scope add': scopePlan('out'),
  'increment ac add': acAddPlan,
  'increment ac set': acSetPlan,
  'increment ref add': refAddPlan,
  'increment attach': attachPlan,
};
