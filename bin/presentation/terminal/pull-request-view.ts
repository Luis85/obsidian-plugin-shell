/**
 * Human views of the pr family: the local list and show, the `pr publish` preview (remote action, whether the
 * head must be pushed, the ordered steps, the body size against the platform limit) and the `pr sync` merge with
 * its conflicts. An uncertain remote write (exit 2) gets its own failure view. The JSON result stays the authority.
 */
import { bold, marker, nextLine, rows, type Style } from './terminal-style.ts';
import type { Result } from '../../adapters/framework/contracts.ts';
import { branches, checkbox, clip, list, problemLines, record, section, table, text, words, type Data } from './increment-view.ts';

const yesNo = (value: unknown) => value ? 'yes' : 'no';
const remoteLabel = (number: unknown, url: unknown, state?: unknown) => number ? `#${text(number)}${state ? ` ${text(state)}` : ''}${url ? ` ${text(url)}` : ''}` : '';
const idOf = (path: unknown) => text(path).split('/').pop()!.replace(/\.md$/, '');

function pullRequestList(style: Style, data: Data): string {
  const pulls = list(data.pullRequests);
  const body = pulls.map(pull => [text(pull.id), text(pull.kind), text(pull.status), text(pull.increment), branches(pull.head, pull.base),
    `${text(record(pull.tasks).done)}/${text(record(pull.tasks).total)}`, remoteLabel(pull.number, pull.url) || '-']);
  return rows([['Folder', text(data.folder)]]) + (pulls.length ? table(['ID', 'KIND', 'STATUS', 'INCREMENT', 'BRANCHES', 'TASKS', 'REMOTE'], body) : '  No pull requests planned yet.\n')
    + nextLine(style, pulls[0] ? `pr show ${text(pulls[0].id)}` : null);
}
function publication(binding: Data): string {
  if (!binding.number) return 'not published (local document only)';
  return `${text(binding.platform)} ${text(binding.repository)} ${remoteLabel(binding.number, binding.url)}; last synced ${text(binding.lastSyncedAt) || 'never'}`;
}
function pullRequestShow(style: Style, data: Data): string {
  const pull = record(data.pullRequest), problems = list(record(data.validation).problems), scope = record(pull.scope), tasks = list(pull.tasks);
  const head = `${bold(style, text(pull.title))} (${text(pull.id)})\n` + rows([['Kind', text(pull.kind)], ['Increment', text(pull.increment)], ['Status', text(pull.status)],
    ['Branches', branches(pull.head, pull.base)], ['Delivers', words(pull.delivers).join(', ') || (pull.kind === 'kickoff' ? 'every criterion (kick-off)' : 'none')],
    ['Issues', words(pull.issues).join(', ') || 'none'], ['Remote', publication(record(pull.binding))], ['Path', text(pull.path)]]);
  const scopeText = [...words(scope.in).map(item => `  in   ${clip(item)}\n`), ...words(scope.out).map(item => `  out  ${clip(item)}\n`)].join('');
  const amendments = list(pull.amendments).map(entry => `  ${text(entry.id)} · ${text(entry.date)}\n`).join('');
  return head + section(style, 'Scope', scopeText)
    + section(style, `Tasks (${tasks.filter(task => task.checked).length}/${tasks.length} done)`, tasks.map(task => `  ${checkbox(task.checked)} ${text(task.id)}  ${clip(task.text, 64)}\n`).join(''))
    + section(style, 'Documents', words(pull.documents).map(item => `  ${item}\n`).join('')) + section(style, 'Amendments', amendments)
    + section(style, `Problems (${problems.length})`, problemLines(style, problems)) + nextLine(style, typeof data.next === 'string' ? data.next : null);
}
function readinessLine(readiness: Data): string | null {
  if (!readiness.platform) return null;
  return `cli ${text(readiness.cli)}, sign-in ${text(readiness.auth)}${readiness.defaultBranch ? `, default branch ${text(readiness.defaultBranch)}` : ''}`;
}
function headLine(remote: Data, push: unknown): string {
  if (!remote.needsPush) return `${text(remote.head)} is on the remote`;
  return `${text(remote.head)} is not on the remote; apply pushes it (${text(push) || 'git push -u origin <head>'})`;
}
function actionLine(remote: Data): string {
  const existing = record(remote.existing);
  return remote.action === 'adopt' ? `adopt ${remoteLabel(existing.number, existing.url, existing.state)} (it already carries this document's marker)` : 'create a draft pull request';
}
function bodyLine(rendered: Data): string {
  const size = Number(rendered.bodyChars), limit = Number(rendered.limit);
  return `${size} of ${limit} characters (${Math.round((size / limit) * 100)}%), sha256 ${text(rendered.bodySha256).slice(0, 12)}`;
}
/** The `pr publish` preview or its applied result. */
export function publishView(style: Style, value: Result): string {
  const data = record(value.data), remote = record(data.remote), rendered = record(data.rendered), pull = record(data.pullRequest), increment = record(data.increment);
  const changes = list(data.changes).map(change => `    ${text(change.status).padEnd(6)}  ${text(change.path)}\n`).join('');
  const applied = value.status === 'applied';
  let out = rows([['Plan hash', text(data.planHash)], ['Pull request', `${text(pull.id)} (${text(pull.path)}), increment ${text(pull.increment)}`],
    ['Platform', `${text(remote.platform)} ${text(remote.repository)}`], ['Readiness', readinessLine(record(remote.readiness))], ['Branches', branches(remote.head, remote.base)],
    ['Head branch', headLine(remote, data.push)], ['Action', actionLine(remote)], ['Steps', words(remote.steps).join(' → ')], ['Title', clip(rendered.title, 80)], ['Body', bodyLine(rendered)],
    ['Increment', increment.statusBefore === increment.statusAfter ? `${text(increment.statusBefore)} (unchanged)` : `${text(increment.statusBefore)} → ${text(increment.statusAfter)}`],
    ['Published', applied ? `${remoteLabel(remote.number, remote.url, remote.state)}${data.pushed ? '; head pushed' : ''}` : null]]);
  out += `  Local records${applied ? ' written' : ' on apply'}\n${changes}`;
  out += section(style, 'Warnings', problemLines(style, list(data.warnings)));
  const next = applied ? `pr sync ${text(pull.id)} (after reviewers edit the pull request; marking it ready and merging happen on the platform)`
    : `review the steps above, then rerun with --apply ${text(data.planHash)} (or --yes); only that writes the hosting platform`;
  return out + nextLine(style, next);
}
const decisionNames: Array<[string, string]> = [['summary', 'Summary'], ['scope', 'Scope'], ['documents', 'Documents'], ['notes', 'Notes']];
function itemLine(report: Data): string {
  const parts = ['pulled', 'pushed', 'imported', 'restored', 'removed'].map(kind => [kind, words(report[kind])] as const).filter(([, ids]) => ids.length);
  return parts.map(([kind, ids]) => `${kind} ${ids.join(', ')}`).join('; ') || 'unchanged';
}
function mergeRows(merge: Data, data: Data): Array<[string, string | null]> {
  const regions = record(merge.regions), status = record(merge.status), write = record(data.remoteWrite);
  return [['Title', text(merge.title)], ...decisionNames.map(([key, label]): [string, string] => [label, text(regions[key])]),
    ['Tasks', itemLine(record(merge.tasks))], ['Amendments', itemLine(record(merge.amendments))],
    ['Status', status.before === status.after ? `${text(status.before)} (unchanged)` : `${text(status.before)} → ${text(status.after)}`],
    ['Remote write', `title ${yesNo(write.title)}, body ${yesNo(write.body)}`], ['Local write', yesNo(data.localWrite)]];
}
function conflictLines(style: Style, conflicts: Data[]): string {
  return conflicts.map(conflict => `  ${marker(style, 'fail')} ${text(conflict.key)}  (${text(conflict.kind)})\n`
    + `         local:  ${conflict.local === null ? '(absent)' : clip(conflict.local, 70)}\n         remote: ${conflict.remote === null ? '(absent)' : clip(conflict.remote, 70)}\n`
    + `         resolve: ${words(conflict.allowed).join(' or ')}\n`).join('');
}
function syncNext(value: Result, data: Data, id: string, conflicts: Data[]): string | null {
  if (value.status === 'blocked') {
    const allowed = [...new Set(conflicts.flatMap(conflict => words(conflict.allowed)))].join('|');
    return `pr sync ${id} --prefer ${allowed || 'local|remote'} (every conflict), or --resolutions '{"<key>":"local|remote"}' per key`;
  }
  if (value.status === 'planned') return `rerun with --apply ${text(data.planHash)} (or --yes) to write exactly this merge`;
  return null;
}
/** The `pr sync` three-way merge: what moves in which direction, and the conflicts that block it. */
export function syncView(style: Style, value: Result): string {
  const data = record(value.data), remote = record(data.remote), merge = record(data.merge), conflicts = list(data.conflicts);
  const id = idOf(list(data.changes)[0]?.path);
  let out = rows([['Plan hash', text(data.planHash)], ['Remote', `${remoteLabel(remote.number, remote.url, remote.state)}${data.pullOnly ? ' (merged or closed: pull only)' : ''}`],
    ['Unmanaged', Number(remote.unmanagedChars) ? `${text(remote.unmanagedChars)} characters outside the managed block (kept, never imported)` : null]]);
  out += section(style, 'Merge', rows(mergeRows(merge, data)));
  if (value.status === 'unchanged') out += '  Nothing to sync: the document and the pull request agree.\n';
  out += section(style, `Conflicts (${conflicts.length})`, conflictLines(style, conflicts));
  out += section(style, 'Warnings', problemLines(style, list(data.warnings)));
  return out + nextLine(style, syncNext(value, data, id, conflicts));
}
/** A failed remote write with an unknown outcome (exit 2): never retried; the rerun rediscovers and resumes. */
export function uncertainView(style: Style, value: Result): string {
  const data = record(value.data);
  return rows([['Outcome', `uncertain at step ${text(data.step)}: the hosting platform may already hold the write`], ['Exit code', '2 (nothing was retried)'],
    ['Recovery', text(data.recovery)]]) + `  ${marker(style, 'warn')} Inspect the pull request on the platform before rerunning the same command.\n`;
}
type ReadView = (style: Style, data: Data) => string;
const readViews: Record<string, ReadView> = { 'pr list': pullRequestList, 'pr show': pullRequestShow };
/** The local list and show views of the pr family; undefined for other commands. */
export function pullRequestReadView(style: Style, value: Result): string | undefined {
  const view = readViews[value.command];
  return view ? view(style, record(value.data)) : undefined;
}
