/** Human views of `source list`, `source graph` and `source check`. The JSON result stays the authority. */
import type { Result } from '../../adapters/framework/contracts.ts';
import { bold, marker, nextLine, rows, runnable, type Style } from './terminal-style.ts';

type Data = Record<string, unknown>;
interface ProjectRow { name: string; kind: string; path: string; references: string[]; alias: string | null; dependents: string[]; platform?: string }
interface Finding { code: string; project?: string; message: string; next?: string }
const record = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
const list = (values: readonly string[]): string => values.length ? values.join(', ') : 'none';

export const isSourceView = (value: Result): boolean => value.command === 'source list' || value.command === 'source graph'
  || (value.command === 'source check' && Array.isArray(record(value.data).findings));

function listView(style: Style, data: Data): string {
  const projects = (data.projects ?? []) as ProjectRow[];
  const width = Math.max(4, ...projects.map(item => item.name.length)), pathWidth = Math.max(4, ...projects.map(item => item.path.length));
  const lines = projects.map(item => `  ${item.name.padEnd(width)}  ${(item.kind + (item.platform ? `/${item.platform}` : '')).padEnd(16)}  ${item.path.padEnd(pathWidth)}  refs: ${list(item.references)}${item.alias ? `  alias: ${item.alias}` : ''}\n`);
  return rows([['Manifest', `${String(data.file)} (${String(data.manifest)})`], ['Projects', projects.length]]) + (lines.length ? `${bold(style, 'Projects')}\n${lines.join('')}` : '')
    + nextLine(style, typeof data.next === 'string' ? data.next : null);
}
function graphView(style: Style, data: Data): string {
  const adjacency = record(data.adjacency) as Record<string, string[]>, dependents = record(data.dependents) as Record<string, string[]>;
  const order = Array.isArray(data.order) ? data.order as string[] : Object.keys(adjacency);
  const width = Math.max(4, ...order.map(name => name.length));
  let text = rows([['Manifest', String(data.manifest)], ['Build order', Array.isArray(data.order) ? (data.order as string[]).join(' -> ') : 'none (cycle)']]);
  if (Array.isArray(data.cycle)) text += `  ${marker(style, 'fail')} cycle: ${(data.cycle as string[]).join(' -> ')}\n`;
  text += `${bold(style, 'References (-> imports, <- used by)')}\n` + order.map(name => `  ${name.padEnd(width)}  -> ${list(adjacency[name] ?? [])}   <- ${list(dependents[name] ?? [])}\n`).join('');
  return text + nextLine(style, Array.isArray(data.cycle) ? 'source unlink <from> <to>' : 'source check');
}
function checkView(style: Style, data: Data): string {
  const findings = (data.findings ?? []) as Finding[];
  let text = rows([['Manifest', String(data.manifest)], ['Projects', Number(data.projects)], ['Findings', findings.length ? `${findings.length} (${Number(data.fixable)} fixable with --fix)` : 'none']]);
  if (!findings.length) return text + `  ${marker(style, 'pass')} Manifest, graph, tsconfigs, aliases, imports and gate scopes agree.\n`;
  const width = Math.max(...findings.map(item => item.code.length));
  text += findings.map(item => `  ${marker(style, 'fail')} ${item.code.padEnd(width)}  ${item.project ? `[${item.project}] ` : ''}${item.message}\n${item.next ? `      fix: ${runnable(item.next)}\n` : ''}`).join('');
  return text + nextLine(style, typeof data.next === 'string' ? data.next : null);
}
export function sourceView(style: Style, value: Result): string {
  const data = record(value.data);
  if (value.command === 'source list') return listView(style, data);
  if (value.command === 'source graph') return graphView(style, data);
  return checkView(style, data);
}
