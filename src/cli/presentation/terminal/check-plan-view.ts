/** Human view of `check --plan`: one compact table of required gates, then flags and notes. The JSON stays the authority. */
import type { Result } from '../../adapters/framework/contracts.ts';
import { bold, marker, nextLine, rows, type Style } from './terminal-style.ts';

type Data = Record<string, unknown>;
const record = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const list = (value: unknown): Data[] => Array.isArray(value) ? value.map(record) : [];
const text = (value: unknown): string => typeof value === 'string' ? value : '';
function becauseOf(gate: Data): string {
  const reasons = list(gate.why), first = reasons[0];
  if (!first) return '';
  const paths = Array.isArray(first.paths) ? first.paths.map(String) : [];
  const more = reasons.length > 1 ? ` (+${reasons.length - 1} more)` : '';
  const full = `${paths[0] ? `${paths[0]} -> ` : ''}${text(first.detail)}${more}`;
  return full.length > 110 ? `${full.slice(0, 107)}...` : full;
}
function estimateOf(gate: Data): string {
  return typeof gate.estimateSeconds === 'number' ? `${gate.estimateSeconds}s` : '-';
}
function ciOf(gate: Data): string {
  const running = list(gate.ci).filter(item => item.runs === true).map(item => text(item.workflow));
  return running.length ? running.join(',') : '-';
}
function gateRow(gate: Data, index: number): string[] {
  const needs = Array.isArray(gate.needs) && gate.needs.length ? ` [needs ${gate.needs.join('+')}]` : '';
  const how = gate.viaCheck === true ? ' (in check)' : '';
  return [String(index + 1), `${text(gate.id)}${gate.required === false ? ' (optional)' : ''}`, `${text(gate.command)}${how}${needs}`, estimateOf(gate), ciOf(gate), becauseOf(gate)];
}
function table(header: string[], body: string[][]): string {
  const widths = header.map((title, column) => Math.max(title.length, ...body.map(row => (row[column] ?? '').length)));
  return [header, ...body].map(row => '  ' + row.map((cell, column) => column === row.length - 1 ? cell : cell.padEnd(widths[column] ?? 0)).join('  ').trimEnd() + '\n').join('');
}
function baseLine(base: Data): string | null {
  if (!base.ref) return null;
  const commit = text(base.commit);
  return `${text(base.ref)} (${text(base.source)}${commit ? `, merge-base ${commit.slice(0, 10)}` : ''})${base.note ? ` - ${text(base.note)}` : ''}`;
}
function changesLine(changes: Data, classes: string): string {
  if (changes.source !== 'git') return `git unavailable${changes.reason ? ` (${text(changes.reason)})` : ''}`;
  return `${String(changes.paths)} changed paths (${String(changes.files)} code files)${classes ? `; ${classes}` : ''}`;
}
function footer(style: Style, data: Data): string {
  let out = '';
  for (const flag of list(data.flags)) out += `\n${marker(style, 'warn')} ${bold(style, text(flag.message))}${Array.isArray(flag.paths) ? ` (${flag.paths.slice(0, 3).join(', ')})` : ''}\n`;
  for (const note of Array.isArray(data.notes) ? data.notes : []) out += `  note: ${String(note)}\n`;
  return out + nextLine(style, text(data.next));
}
export function checkPlanView(style: Style, value: Result): string {
  const data = record(value.data), changes = record(data.changes), estimate = record(data.estimate);
  const classes = Array.isArray(data.classification) ? data.classification.join(', ') : '';
  let out = rows([['Scope', `${text(data.scope)}, plan (nothing was run; not verify)`], ['Base', baseLine(record(data.base))], ['Changes', changesLine(changes, classes)]]);
  out += '\n' + table(['#', 'Gate', 'Command', 'Est', 'CI', 'Because'], list(data.gates).map(gateRow));
  if (typeof estimate.seconds === 'number' && estimate.seconds > 0) out += `  Measured suites: about ${estimate.seconds}s${estimate.complete === true ? '' : ' (more gates are not measured)'}\n`;
  return out + footer(style, data);
}
