/** Human views of `ci --list` and `ci --job`. The JSON result stays the authority; commands are printed exactly as written. */
import { bold, duration, marker, nextLine, rows, type Mark, type Style } from './terminal-style.ts';
import type { Result } from '../../adapters/framework/contracts.ts';
type Data = Record<string, unknown>;
const record = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const list = (value: unknown): Data[] => Array.isArray(value) ? value.map(record) : [];
const words = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : [];
function matrixLabel(matrix: Data): string {
  if (matrix.computed) return `matrix ${words(matrix.axes).join(',') || 'computed'} (computed)`;
  return typeof matrix.combinations === 'number' ? `matrix ${words(matrix.axes).join(',')} x${matrix.combinations}` : 'no matrix';
}
function jobLine(job: Data, width: number): string {
  const steps = record(job.steps), local = job.reproducible ? 'reproducible' : `not fully reproducible (${words(job.reasons).length} reason(s))`;
  const run = job.executable ? 'executable' : 'execute refused';
  return `    ${String(job.reference).padEnd(width)}  ${String(job.runsOn)}; ${matrixLabel(record(job.matrix))}; ${String(steps.run)} run steps; ${local}; ${run}\n`;
}
function filterLabel(filter: Data): string {
  const parts = [words(filter.branches).length ? `branches ${words(filter.branches).join(',')}` : '', words(filter.paths).length ? `${words(filter.paths).length} path filters` : '',
    words(filter.pathsIgnore).length ? `${words(filter.pathsIgnore).length} ignored paths` : ''];
  return `${String(filter.event)}: ${parts.filter(Boolean).join(', ')}`;
}
function workflowBlock(workflow: Data): string {
  const jobs = list(workflow.jobs), width = Math.max(0, ...jobs.map(job => String(job.reference).length));
  const filters = list(workflow.filters).map(filterLabel);
  const schedule = words(workflow.schedules).length ? `; schedule ${words(workflow.schedules).join(' | ')}` : '';
  return `  ${String(workflow.stem)}  ${String(workflow.name)}  [${words(workflow.triggers).join(', ')}${schedule}${filters.length ? `; ${filters.join(', ')}` : ''}]\n${jobs.map(job => jobLine(job, width)).join('')}`;
}
export function ciListView(style: Style, value: Result): string {
  const data = record(value.data), summary = record(data.summary);
  const head = rows([['Directory', String(data.directory)], ['Workflows', String(summary.workflows)], ['Jobs', `${String(summary.jobs)} (${String(summary.reproducible)} reproducible, ${String(summary.executable)} executable)`]]);
  const next = typeof data.next === 'string' ? data.next : null;
  return head + list(data.workflows).map(workflowBlock).join('') + nextLine(style, next);
}
const stepMark: Record<string, Mark> = { passed: 'pass', failed: 'fail', skipped: 'skip', 'not-run': 'info' };
function stepHeader(style: Style, step: Data, executed: boolean): string {
  const timing = executed && (step.status === 'passed' || step.status === 'failed') ? `  ${duration(Number(step.durationMs))}` : '';
  const exit = step.status === 'failed' && step.exitCode !== null && step.exitCode !== undefined ? `  exit ${String(step.exitCode)}` : '';
  const tag = step.kind === 'run' ? String(step.disposition) : String(step.kind);
  return `  ${marker(style, stepMark[String(step.status)] ?? 'info')} ${String(step.index).padStart(2)}. [${tag}] ${String(step.name)}${timing}${exit}\n`;
}
function commandBlock(step: Data): string {
  if (step.command === undefined) return '';
  const env = Object.entries(record(step.env)).map(([key, item]) => `${key}=${String(item)}`);
  const header = `        in ${String(step.workingDirectory ?? '.')} with ${String(step.shell ?? 'bash')}${env.length ? `; env ${env.join(' ')}` : ''}\n`;
  const flagged = words(step.unresolved).length ? `        unresolved: ${words(step.unresolved).map(item => '${{ ' + item + ' }}').join(', ')}\n` : '';
  return header + flagged + String(step.command).trimEnd().split('\n').map(line => `        $ ${line}\n`).join('');
}
function reasonLine(step: Data): string {
  return typeof step.reason === 'string' && step.status !== 'not-run' ? `        ${step.reason}\n` : '';
}
function failedOutput(style: Style, steps: Data[]): string {
  return steps.filter(step => step.status === 'failed' && step.outputTail !== undefined)
    .map(step => `${bold(style, `--- step ${String(step.index)} (${String(step.code)}) last output ---`)}\n${String(step.outputTail).split('\n').map(line => `  ${line}\n`).join('')}\n`).join('');
}
function jobHeader(data: Data): string {
  const runner = record(data.runner), matrix = record(data.matrix);
  const combination = Object.entries(record(matrix.combination)).map(([key, item]) => `${key}=${String(item)}`).join(',');
  return rows([['Job', `${String(data.workflow)}/${String(data.job)}  ${String(data.name)}`], ['File', String(data.file)],
    ['Runs on', `${String(data.runsOn)} (this machine: ${String(runner.local)})`], ['Matrix', combination ? `${combination} (${String(matrix.mode)})` : null],
    ['Mode', `${String(data.mode)}, execution ${String(data.execution)}`]]);
}
export function ciJobView(style: Style, value: Result): string {
  const data = record(value.data), steps = list(data.steps), executed = data.execution === 'executed';
  let text = executed ? failedOutput(style, steps) : '';
  text += jobHeader(data);
  const notes = words(data.notes);
  if (notes.length) text += `${bold(style, 'Notes')}\n${notes.map(note => `  ${marker(style, 'warn')} ${note}\n`).join('')}`;
  text += `${bold(style, 'Steps')}\n` + steps.map(step => stepHeader(style, step, executed) + (executed ? reasonLine(step) : step.disposition === 'run' ? commandBlock(step) : reasonLine(step))).join('');
  const summary = record(data.summary);
  if (executed) text += `  Summary  ${String(summary.passed)} passed, ${String(summary.failed)} failed, ${String(summary.skipped)} skipped, ${String(summary.notRun)} not run in ${duration(Number(summary.durationMs))}\n`;
  const next = value.diagnostics[0]?.next ?? (typeof data.next === 'string' ? data.next : null);
  return text + nextLine(style, next);
}
