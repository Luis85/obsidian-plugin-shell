/** Maker results: the reviewed plan, then the planned or actually executed project checks and the next step. */
import type { Result } from '../../adapters/framework/contracts.ts';
import { bold, duration, marker, nextLine, type Mark, type Style } from './terminal-style.ts';

type Data = Record<string, unknown>;
const record = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
const records = (value: unknown): Data[] => Array.isArray(value) ? value.map(record) : [];
const marks: Record<string, Mark> = { passed: 'pass', failed: 'fail', skipped: 'skip', 'not-run': 'info' };

function checkLine(style: Style, check: Data, width: number): string {
  const status = String(check.status);
  const ran = status === 'passed' || status === 'failed';
  const detail = ran ? duration(Number(check.durationMs)) : status === 'skipped' ? `skipped (${String(check.reason ?? 'not run')})` : 'not run';
  return `  ${marker(style, marks[status] ?? 'info')} ${String(check.id).padEnd(width)}  ${detail}\n      ${String(check.command)}\n`;
}
function failureTails(style: Style, checks: Data[]): string {
  return checks.filter(check => check.status === 'failed' && check.outputTail)
    .map(check => `${bold(style, `--- ${String(check.id)} (${String(check.code)}) last output ---`)}\n${String(check.outputTail).split('\n').map(line => `  ${line}\n`).join('')}`).join('');
}
/** True when a make result carries its check list (dry-run, apply or failure). */
export function isMakerResult(value: Result): boolean {
  return value.command === 'make' && Array.isArray(record(record(value.data).summary).checks);
}
export function makerChecksView(style: Style, value: Result): string {
  const summary = record(record(value.data).summary), checks = records(summary.checks);
  const width = Math.max(0, ...checks.map(check => String(check.id).length));
  const title = value.status === 'planned' ? 'Planned checks (run after apply)' : 'Checks';
  let text = `${bold(style, title)}\n` + checks.map(check => checkLine(style, check, width)).join('') + failureTails(style, checks);
  if (value.status === 'failed') return text + 'The written source is kept for inspection.\n';
  if (value.status === 'applied' || value.status === 'unchanged') text += nextLine(style, `${String(summary.next)} (full gate; not run by make)`);
  return text;
}
