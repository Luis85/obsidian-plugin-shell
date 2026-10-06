/**
 * Human views of the increment and issue read commands: list, show, validate and the Definition of Ready/Done
 * check. The JSON result stays the authority; these views pick its decision-relevant facts (status, branch,
 * pull requests, failing rule ids with their hints, the refinement brief) and end with a `Next:` line.
 */
import { bold, marker, nextLine, rows, type Mark, type Style } from './terminal-style.ts';
import type { Result } from '../../adapters/framework/contracts.ts';

export type Data = Record<string, unknown>;
export const record = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
export const list = (value: unknown): Data[] => Array.isArray(value) ? value.map(record) : [];
export const words = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : [];
export const text = (value: unknown): string => value === null || value === undefined ? '' : String(value);
/** One line of at most `width` characters; longer text ends with an ellipsis (the JSON keeps it whole). */
export const clip = (value: unknown, width = 72): string => {
  const line = text(value).split('\n')[0]!;
  return line.length > width || text(value).includes('\n') ? `${line.slice(0, width - 1)}…` : line;
};
/** An aligned table with a header row; at most 50 rows, the rest is counted. */
export function table(headers: readonly string[], body: readonly string[][], indent = '  '): string {
  const shown = body.slice(0, 50), widths = headers.map((header, column) => Math.max(header.length, ...shown.map(cells => (cells[column] ?? '').length)));
  const line = (cells: readonly string[]) => indent + cells.map((cell, column) => cell.padEnd(widths[column]!)).join('  ').trimEnd() + '\n';
  return line(headers) + shown.map(line).join('') + (body.length > shown.length ? `${indent}… ${body.length - shown.length} more (see --json)\n` : '');
}
/** A titled block; empty when there is nothing to show. */
export const section = (style: Style, title: string, body: string): string => body ? `${bold(style, title)}\n${body}` : '';
export const checkbox = (done: unknown): string => done ? '[x]' : '[ ]';
/** Problems as `! CODE  message (line n)`, at most 20. */
export function problemLines(style: Style, problems: Data[], mark: Mark = 'warn'): string {
  const shown = problems.slice(0, 20).map(item => `  ${marker(style, mark)} ${text(item.code)}  ${text(item.message)}${item.line ? ` (line ${text(item.line)})` : ''}\n`).join('');
  return shown + (problems.length > 20 ? `  … ${problems.length - 20} more (see --json)\n` : '');
}
export const branches = (head: unknown, base: unknown): string => head || base ? `${text(head) || '?'} → ${text(base) || '?'}` : 'not set';
/** `2: kickoff New, change Draft #12`, or `none`. */
function pullRequestSummary(pulls: Data[]): string {
  if (!pulls.length) return 'none';
  return `${pulls.length}: ` + pulls.map(pull => `${text(pull.kind)} ${text(pull.status)}${pull.number ? ` #${text(pull.number)}` : ''}`).join(', ');
}
const counted = (items: Data[], done: (item: Data) => boolean) => items.length ? `${items.filter(done).length}/${items.length}` : '0';

function incrementList(style: Style, data: Data): string {
  const increments = list(data.increments);
  const body = increments.map(item => [text(item.id), text(item.status), text(item.size), text(item.owner) || '-', text(item.branch) || '-',
    pullRequestSummary(list(item.pullRequests)), String(list(item.issues).length), String(item.problems ?? 0)]);
  const drift = problemLines(style, list(data.drift));
  const first = increments[0];
  const next = first ? `increment show ${text(first.id)}` : 'increment new <id> --title "<title>" --dry-run';
  return rows([['Folder', text(data.folder)]]) + (increments.length ? table(['ID', 'STATUS', 'SIZE', 'OWNER', 'BRANCH', 'PULL REQUESTS', 'ISSUES', 'PROBLEMS'], body) : '  No increments yet.\n')
    + section(style, 'Path drift', drift) + nextLine(style, next);
}
function acceptanceLines(items: Data[]): string {
  return items.map(item => {
    const evidence = words(item.evidence);
    return `  ${checkbox(item.checked)} ${text(item.id)}  ${clip(text(item.text).replace(/\s*Evidence:.*$/, ''), 64)}${evidence.length ? `\n        evidence: ${evidence.join(', ')}` : ''}\n`;
  }).join('');
}
function scopeLines(scope: Data): string {
  const items = [...words(scope.in).map(item => `  in   ${clip(item)}\n`), ...words(scope.out).map(item => `  out  ${clip(item)}\n`)];
  return items.join('');
}
function pullRequestTable(pulls: Data[]): string {
  if (!pulls.length) return '';
  return table(['ID', 'KIND', 'STATUS', 'BRANCHES', 'REMOTE'], pulls.map(pull => [text(pull.id), text(pull.kind), text(pull.status), branches(pull.head, pull.base), pull.url ? `#${text(pull.number)} ${text(pull.url)}` : '-']));
}
function linkSummary(links: Data[]): string | null {
  if (!links.length) return null;
  const broken = links.filter(link => link.status !== 'resolved');
  return broken.length ? `${links.length - broken.length} resolved, ${broken.length} not: ${broken.map(link => `${text(link.target)} (${text(link.status)})`).join(', ')}` : `${links.length} resolved`;
}
function incrementShow(style: Style, data: Data): string {
  const item = record(data.increment), problems = list(record(data.validation).problems), transitions = words(data.transitions);
  let out = `${bold(style, text(item.title))} (${text(item.id)})\n` + rows([
    ['Status', `${text(item.status)}${transitions.length ? `; can move to ${transitions.join(', ')}` : ' (final)'}`], ['Owner', text(item.owner) || 'not set'],
    ['Size', text(item.size)], ['E2E', text(item.e2e)], ['Branch', branches(item.branch, item.base)], ['Path', text(item.path)],
    ['Refs', words(item.refs).join(', ') || 'none'], ['Issues', words(item.issues).join(', ') || 'none'], ['Links', linkSummary(list(item.links))],
    ['Ready shape', data.readiness ? 'yes (structure; the gate decides)' : 'no; run the Definition of Ready check']]);
  out += section(style, 'Scope', scopeLines(record(item.scope)));
  out += section(style, 'Acceptance criteria', acceptanceLines(list(item.acceptance)));
  out += section(style, 'Pull requests', pullRequestTable(list(item.pullRequests)));
  out += section(style, `Problems (${problems.length})`, problemLines(style, problems));
  return out + nextLine(style, typeof data.next === 'string' ? data.next : null);
}
function validation(style: Style, value: Result, data: Data): string {
  const documents = list(data.documents), failing = documents.filter(doc => list(doc.problems).length);
  const body = documents.map(doc => [text(doc.kind), text(doc.id), text(doc.path), String(list(doc.problems).length)]);
  const outcome = `  ${marker(style, failing.length || list(data.drift).length ? 'fail' : 'pass')} ${documents.length} documents, ${text(data.problems)} problems\n`;
  const next = value.status === 'blocked' ? 'fix the problems listed below (path:line), then validate again' : null;
  return outcome + (documents.length ? table(['KIND', 'ID', 'PATH', 'PROBLEMS'], body) : '') + nextLine(style, next);
}
function issueList(style: Style, data: Data): string {
  const issues = list(data.issues);
  const body = issues.map(item => [text(item.id), text(item.status), text(item.increment), `${text(record(item.criteria).done)}/${text(record(item.criteria).total)}`, words(item.pullRequests).join(', ') || '-', clip(item.title, 48)]);
  return rows([['Folder', text(data.folder)]]) + (issues.length ? table(['ID', 'STATUS', 'INCREMENT', 'CRITERIA', 'PULL REQUESTS', 'TITLE'], body) : '  No issues yet.\n')
    + nextLine(style, issues[0] ? `issue show ${text(issues[0].id)}` : null);
}
function issueShow(style: Style, data: Data): string {
  const item = record(data.issue), problems = list(record(data.validation).problems), criteria = list(item.acceptance);
  return `${bold(style, text(item.title))} (${text(item.id)})\n` + rows([['Status', text(item.status)], ['Increment', text(item.increment)],
    ['Pull requests', words(item.pullRequests).join(', ') || 'none'], ['Criteria', criteria.length ? `${counted(criteria, criterion => Boolean(criterion.checked))} done` : 'none'], ['Path', text(item.path)]])
    + section(style, 'Criteria', criteria.map(criterion => `  ${checkbox(criterion.checked)} ${text(criterion.id)}  ${clip(criterion.text, 64)}\n`).join(''))
    + section(style, `Problems (${problems.length})`, problemLines(style, problems)) + nextLine(style, `increment show ${text(item.increment)}`);
}
type ReadView = (style: Style, data: Data, value: Result) => string;
const readViews: Record<string, ReadView> = {
  'increment list': incrementList, 'increment show': incrementShow, 'increment validate': (style, data, value) => validation(style, value, data),
  'pr validate': (style, data, value) => validation(style, value, data), 'issue list': issueList, 'issue show': issueShow,
};
/** The list, show and validate views of the increment and issue families (and `pr validate`); undefined for other commands. */
export function incrementReadView(style: Style, value: Result): string | undefined {
  const view = readViews[value.command];
  return view ? view(style, record(value.data), value) : undefined;
}

const gateName: Record<string, string> = { ready: 'Definition of Ready', done: 'Definition of Done' };
const handoffId = (path: unknown) => text(path).split('/').pop()!.replace(/\.md$/, '');
function ruleBlock(style: Style, rule: Data, mark: Mark): string {
  const details = words(rule.details), shown = details.slice(0, 3).map(item => `         - ${clip(item, 90)}\n`).join('');
  return `  ${marker(style, mark)} ${text(rule.id)}  ${text(rule.title)}: ${text(rule.message)}\n` + (rule.hint ? `         fix: ${text(rule.hint)}\n` : '')
    + shown + (details.length > 3 ? `         … ${details.length - 3} more (see --json)\n` : '');
}
function tally(rules: Data[]): string {
  const counts = new Map<string, number>();
  for (const rule of rules) counts.set(text(rule.status), (counts.get(text(rule.status)) ?? 0) + 1);
  return [...counts].map(([status, count]) => `${count} ${status}`).join(', ') || 'none';
}
const blocks = (rule: Data) => rule.status === 'fail' && rule.severity !== 'warning';
function refinementLines(refinement: Data): string {
  const questions = list(refinement.questions);
  if (!questions.length) return '';
  const skills = words(refinement.skills);
  return (skills.length ? `  Skills: ${skills.join(', ')}\n` : '')
    + questions.map(item => `  ${text(item.rule)} ${text(item.title)}\n` + words(item.questions).map(question => `    - ${question}\n`).join('')).join('');
}
function checkNext(gate: string, passed: boolean, id: string): string {
  if (!passed) return `fix the failing rules (fix: lines above), then rerun node bin/app increment check ${id}${gate === 'done' ? ' --gate done' : ''}`;
  return gate === 'ready' ? `increment status ${id} Ready --dry-run` : `increment complete ${id} --dry-run`;
}
function structuralCheck(style: Style, value: Result, data: Data): string {
  const problems = list(data.problems), id = handoffId(data.handoff), passed = value.status === 'ok';
  return rows([['Gate', 'Definition of Ready (structural: delivery scripts, configuration or a base commit unavailable)'], ['Result', passed ? 'ready' : 'not ready'], ['Handoff', text(data.handoff)]])
    + problemLines(style, problems, 'fail') + nextLine(style, checkNext('ready', passed, id));
}
/** The Definition of Ready or Done report of `increment check`: failing rules with hints, warnings and the refinement brief. */
export function incrementCheckView(style: Style, value: Result): string {
  const data = record(value.data);
  if (data.source === 'structural') return structuralCheck(style, value, data);
  const rules = list(data.rules), gate = text(data.gate), passed = value.status === 'ok', base = record(data.base), scope = record(data.scope);
  const failing = rules.filter(blocks), warnings = rules.filter(rule => rule.status === 'warn' || (rule.status === 'fail' && !blocks(rule)));
  const paths = words(record(data.generated).paths);
  let out = rows([['Gate', gateName[gate] ?? gate], ['Result', `${passed ? 'passed' : 'not passed'} (${text(data.status)})`], ['Handoff', text(data.handoff)],
    ['Base', base.ref ? `${text(base.ref)} (${text(base.sha).slice(0, 12)})` : null], ['Scope', scope.kind ? `${text(scope.kind)}${scope.pullRequest ? ` ${text(scope.pullRequest)}` : ''}` : null],
    ['Rules', tally(rules)]]);
  out += section(style, `Failing (${failing.length})`, failing.map(rule => ruleBlock(style, rule, 'fail')).join(''));
  out += section(style, `Warnings (${warnings.length})`, warnings.map(rule => ruleBlock(style, rule, 'warn')).join(''));
  out += section(style, 'Refinement brief', refinementLines(record(data.refinement)));
  out += section(style, 'Would generate', paths.map(path => `  ${path}\n`).join(''));
  return out + nextLine(style, checkNext(gate, passed, handoffId(data.handoff)));
}

function branchStep(branch: Data): string | null {
  if (!branch.status) return null;
  if (branch.status !== 'planned') return `${text(branch.name)}: ${text(branch.status)}${branch.reason ? ` (${text(branch.reason)})` : ''}`;
  const fetch = record(branch.fetch);
  return `create ${text(branch.name)} from ${text(branch.start)} at ${text(branch.commit).slice(0, 12)}${fetch.branch ? ` after fetching ${text(fetch.remote)}/${text(fetch.branch)}` : ''}${branch.switch ? ', then switch to it' : ''}`;
}
const statusChange = (before: unknown, after: unknown) => before === null || before === undefined ? `${text(after)} (new document)` : before === after ? text(after) : `${text(before)} → ${text(after)}`;
function createdLine(created: Data): string | null {
  const parts = Object.entries(created).filter(([key]) => key !== 'stubs').map(([key, path]) => `${key} ${text(path)}`);
  const stubs = words(created.stubs);
  if (stubs.length) parts.push(`${stubs.length} acceptance test stub${stubs.length === 1 ? '' : 's'}`);
  return parts.length ? parts.join('; ') : null;
}
/** The document facts of an increment, pr or issue plan: status change, branches, created documents and the branch step. */
export function deliveryPlanDetails(style: Style, value: Result): string {
  const summary = record(record(value.data).summary), document = record(summary.document);
  const edits = list(summary.edits).map(edit => `${text(edit.section)} ${text(edit.action)}${edit.itemId ? ` ${text(edit.itemId)}` : ''}`);
  return rows([['Document', `${text(document.kind)} ${text(document.id)}`], ['Status', statusChange(summary.statusBefore, summary.statusAfter)], ['Kind', text(summary.kind) || null],
    ['Branches', summary.head || summary.base ? branches(summary.head, summary.base) : null], ['Delivers', words(summary.delivers).join(', ') || null],
    ['Edits', edits.join('; ') || null], ['Creates', createdLine(record(summary.created))], ['Branch step', branchStep(record(summary.branch))]])
    + section(style, 'Warnings', problemLines(style, list(summary.warnings)));
}
/** True for a reviewed plan of the increment, pr or issue families (not the remote `pr publish`/`pr sync`). */
export const isDeliveryPlan = (value: Result): boolean => /^(?:increment|pr|issue) /.test(value.command) && !['pr publish', 'pr sync'].includes(value.command)
  && typeof record(value.data).planHash === 'string' && Boolean(record(record(value.data).summary).document);
