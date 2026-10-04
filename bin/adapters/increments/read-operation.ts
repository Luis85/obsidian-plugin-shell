/**
 * Read commands of the increment, pr and issue families: list, show, validate and the Definition of Ready/Done
 * check. Nothing is written and no hosting platform is contacted; `pr show` reads the local document only.
 */
import { result, OperationError, type Context, type Request, type Result } from '../framework/contracts.ts';
import { validateIncrement } from '../../domain/increments/increment-document.ts';
import { validatePullRequest } from '../../domain/increments/pull-request-document.ts';
import { validateIssue } from '../../domain/increments/issue-document.ts';
import { incrementLinkDrift } from '../../domain/increments/generated-lists.ts';
import { allowedIncrementTransitions, incrementStatus } from '../../domain/increments/transitions.ts';
import { extractWikilinks, resolveWikilink } from '../../domain/increments/wikilinks.ts';
import type { IncrementModel, Problem } from '../../domain/increments/model.ts';
import { DeliveryWorkspace, type StoredDocument } from './repository.ts';
import { blocking, requireGate, runGate, type Gate } from './delivery-gates.ts';
import { readinessProblems } from '../../domain/increments/increment-document.ts';
import { option } from './inputs.ts';

type Read = (request: Request, ws: DeliveryWorkspace) => Promise<Result>;
const pick = <T extends { model: { status: string } }>(docs: T[], request: Request) => {
  const status = option(request, 'status');
  return status === undefined ? docs : docs.filter(doc => doc.model.status.toLowerCase() === status.toLowerCase());
};
const pullRequestFacts = (doc: { id: string; path: string; model: { status: string; kind: string; head: string | null; base: string | null; binding: { number: number; url: string } | null } }) =>
  ({ id: doc.id, path: doc.path, status: doc.model.status, kind: doc.model.kind, head: doc.model.head, base: doc.model.base,
    ...(doc.model.binding ? { number: doc.model.binding.number, url: doc.model.binding.url } : {}) });

async function incrementProblems(ws: DeliveryWorkspace, doc: StoredDocument<IncrementModel>, files: string[]): Promise<Problem[]> {
  const pulls = (await ws.pullRequests()).map(item => ({ id: item.id, increment: item.model.increment })), issues = (await ws.issues()).map(item => ({ id: item.id, increment: item.model.increment }));
  return [...validateIncrement(doc.text, { schema: ws.schema, path: doc.path, files }), ...incrementLinkDrift(doc.model, pulls), ...incrementLinkDrift(doc.model, issues, 'issues')];
}
const incrementList: Read = async (request, ws) => {
  const files = await ws.files(), pulls = await ws.pullRequests(), issues = await ws.issues();
  const increments = await Promise.all(pick(await ws.increments(), request).map(async doc => ({
    id: doc.id, title: doc.model.title, status: doc.model.status, size: doc.model.size, owner: doc.model.owner, path: doc.path, branch: doc.model.branch,
    pullRequests: pulls.filter(pull => pull.model.increment === doc.id).map(pullRequestFacts),
    issues: issues.filter(issue => issue.model.increment === doc.id).map(issue => ({ id: issue.id, status: issue.model.status })),
    problems: (await incrementProblems(ws, doc, files)).length })));
  return result(request.command, { folder: ws.folders.increments, increments, drift: ws.drift() });
};
const incrementShow: Read = async (request, ws) => {
  const doc = await ws.increment(request.args[0]), files = await ws.files(), problems = await incrementProblems(ws, doc, files);
  const status = incrementStatus(doc.model.status), model = doc.model;
  const links = extractWikilinks(doc.text).map(link => ({ target: link.path, status: resolveWikilink(files, link.path).status }));
  const pulls = (await ws.pullRequests()).filter(pull => pull.model.increment === doc.id).map(pullRequestFacts);
  const next = problems.length ? `node bin/app increment validate ${doc.id}` : status === 'New' || status === 'Refining' ? `node bin/app increment check ${doc.id} --gate ready` : `node bin/app pr list --increment ${doc.id}`;
  return result(request.command, { increment: { ...model, path: doc.path, links, pullRequests: pulls }, validation: { problems },
    readiness: readinessProblems(doc.text, { schema: ws.schema, path: doc.path, files }).length === 0, transitions: status ? [...allowedIncrementTransitions(status)] : [], next });
};
/** Every Increment, PullRequest and Issue (or one Increment and its documents) with its problems; blocked when any. */
const incrementValidate: Read = async (request, ws) => {
  const files = await ws.files(), id = request.args[0];
  const increments = id ? [await ws.increment(id)] : await ws.increments();
  const owns = (increment: string) => !id || increment === id;
  const acceptanceOf = (incrementId: string) => increments.find(doc => doc.id === incrementId)?.model ?? null;
  const documents = [
    ...await Promise.all(increments.map(async doc => ({ kind: 'increment', id: doc.id, path: doc.path, problems: await incrementProblems(ws, doc, files) }))),
    ...(await ws.pullRequests()).filter(doc => owns(doc.model.increment)).map(doc => ({ kind: 'pullRequest', id: doc.id, path: doc.path,
      problems: validatePullRequest(doc.text, { path: doc.path, files, increment: acceptanceOf(doc.model.increment), schema: ws.schema }) })),
    ...(await ws.issues()).filter(doc => owns(doc.model.increment)).map(doc => ({ kind: 'issue', id: doc.id, path: doc.path,
      problems: validateIssue(doc.text, { path: doc.path, files, increment: acceptanceOf(doc.model.increment), schema: ws.schema }) })),
  ];
  return validationResult(request.command, documents, ws.drift());
};
function validationResult(command: string, documents: { kind: string; id: string; path: string; problems: Problem[] }[], drift: Problem[]): Result {
  const failing = documents.filter(doc => doc.problems.length);
  const outcome = result(command, { documents, drift, problems: failing.reduce((sum, doc) => sum + doc.problems.length, 0) + drift.length }, failing.length || drift.length ? 'blocked' : 'ok');
  return { ...outcome, diagnostics: [...drift, ...failing.flatMap(doc => doc.problems.slice(0, 5).map(problem => ({ ...problem, message: `${doc.path}${problem.line ? `:${problem.line}` : ''}: ${problem.message}` })))].slice(0, 50) };
}
/** The Definition of Ready or Done for one Increment; blocked with the refinement brief when it does not pass. */
const incrementCheck: Read = async (request, ws) => {
  const doc = await ws.increment(request.args[0]), raw = option(request, 'gate') ?? 'ready';
  if (raw !== 'ready' && raw !== 'done') throw new OperationError('INVALID_OPTION', '--gate takes ready or done.');
  const gate: Gate = raw;
  const report = gate === 'done' ? await requireGate(ws, doc.path, gate, option(request, 'base')) : await runGate(ws, doc.path, gate, option(request, 'base'));
  if (!report) return structuralCheck(request.command, doc, ws, await ws.files());
  const failed = blocking(report), passed = failed.length === 0;
  const generated = Object.keys(report.generated.files ?? {});
  const outcome = result(request.command, { ...report, source: 'definition-of-' + gate, generated: { ...report.generated, files: undefined, handoffText: undefined, paths: generated } }, passed ? 'ok' : 'blocked');
  return { ...outcome, diagnostics: failed.map(rule => ({ code: gate === 'ready' ? 'INCREMENT_NOT_READY' : 'INCREMENT_NOT_DONE', message: `${rule.id} ${rule.title}: ${rule.message}`, ...(rule.hint ? { next: rule.hint } : {}) })) };
};
function structuralCheck(command: string, doc: StoredDocument<IncrementModel>, ws: DeliveryWorkspace, files: string[]): Result {
  const problems = readinessProblems(doc.text, { schema: ws.schema, path: doc.path, files });
  const outcome = result(command, { gate: 'ready', status: problems.length ? 'not-ready' : 'ready', handoff: doc.path, source: 'structural', problems }, problems.length ? 'blocked' : 'ok');
  return { ...outcome, diagnostics: problems.slice(0, 50).map(problem => ({ code: problem.code, message: problem.message })) };
}

const pullRequestList: Read = async (request, ws) => {
  const increment = option(request, 'increment');
  const docs = pick(await ws.pullRequests(), request).filter(doc => !increment || doc.model.increment === increment);
  return result(request.command, { folder: ws.folders.pullRequests, pullRequests: docs.map(doc => ({ ...pullRequestFacts(doc), title: doc.model.title, increment: doc.model.increment,
    tasks: { total: doc.model.tasks.length, done: doc.model.tasks.filter(task => task.checked).length } })) });
};
const pullRequestShow: Read = async (request, ws) => {
  const doc = await ws.pullRequest(request.args[0]), files = await ws.files();
  const increment = doc.model.increment ? (await ws.increments()).find(item => item.id === doc.model.increment)?.model ?? null : null;
  return result(request.command, { pullRequest: { ...doc.model, path: doc.path }, remote: 'not-contacted',
    validation: { problems: validatePullRequest(doc.text, { path: doc.path, files, increment, schema: ws.schema }) },
    next: doc.model.binding ? `node bin/app pr sync ${doc.id}` : `node bin/app pr publish ${doc.id} --dry-run` });
};
const pullRequestValidate: Read = async (request, ws) => {
  const files = await ws.files(), increments = await ws.increments(), id = request.args[0];
  const docs = id ? [await ws.pullRequest(id)] : await ws.pullRequests();
  return validationResult(request.command, docs.map(doc => ({ kind: 'pullRequest', id: doc.id, path: doc.path,
    problems: validatePullRequest(doc.text, { path: doc.path, files, increment: increments.find(item => item.id === doc.model.increment)?.model ?? null, schema: ws.schema }) })), ws.drift());
};
const issueList: Read = async (request, ws) => {
  const increment = option(request, 'increment');
  const docs = pick(await ws.issues(), request).filter(doc => !increment || doc.model.increment === increment);
  return result(request.command, { folder: ws.folders.issues, issues: docs.map(doc => ({ id: doc.id, path: doc.path, title: doc.model.title, status: doc.model.status,
    increment: doc.model.increment, pullRequests: doc.model.pullRequests, criteria: { total: doc.model.acceptance.length, done: doc.model.acceptance.filter(item => item.checked).length } })) });
};
const issueShow: Read = async (request, ws) => {
  const doc = await ws.issue(request.args[0]), files = await ws.files();
  const increment = (await ws.increments()).find(item => item.id === doc.model.increment)?.model ?? null;
  return result(request.command, { issue: { ...doc.model, path: doc.path }, validation: { problems: validateIssue(doc.text, { path: doc.path, files, increment, schema: ws.schema }) } });
};

const reads: Record<string, Read> = {
  'increment list': incrementList, 'increment show': incrementShow, 'increment validate': incrementValidate, 'increment check': incrementCheck,
  'pr list': pullRequestList, 'pr show': pullRequestShow, 'pr validate': pullRequestValidate,
  'issue list': issueList, 'issue show': issueShow,
};
export const isIncrementRead = (request: Request, effect: string): boolean => effect === 'read' && Object.hasOwn(reads, request.command);
export async function incrementRead(request: Request, context: Context): Promise<Result> {
  return reads[request.command]!(request, await DeliveryWorkspace.open(context));
}
