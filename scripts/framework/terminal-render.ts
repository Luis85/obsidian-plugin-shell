/**
 * Human renderers for operation results. The JSON result stays the authority; these views never
 * print raw JSON and end with an actionable `Next:` line where one exists (https://clig.dev/#output).
 */
import type { Diagnostic, Result } from './contracts.ts';
import { helpText, type HelpData } from './terminal-help.ts';
import { bold, duration, marker, nextLine, rows, runnable, type Mark, type Style } from './terminal-style.ts';
export interface Rendered { text: string; diagnosticsShown: boolean }
type Data = Record<string, unknown>;
const record = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
function scalar(value: unknown): string {
  if (typeof value !== 'string') return String(value);
  const first = value.split('\n')[0]!;
  return value.includes('\n') || value.length > 100 ? `${first.slice(0, 80)}… (${value.length} chars; see --json)` : value;
}
function flatten(value: unknown, prefix: string, out: Array<[string, string]>, depth: number): void {
  if (value === null || typeof value !== 'object') { out.push([prefix, scalar(value)]); return; }
  if (Array.isArray(value)) {
    const simple = value.every(item => item === null || typeof item !== 'object');
    out.push([prefix, !value.length ? 'none' : simple && value.length <= 6 ? value.map(scalar).join(', ') : `${value.length} items`]); return;
  }
  const entries = Object.entries(value);
  if (depth >= 2 && prefix) { out.push([prefix, `${entries.length} fields`]); return; }
  for (const [key, item] of entries) flatten(item, prefix ? `${prefix}.${key}` : key, out, depth + 1);
}
function generic(data: unknown): string {
  if (data === null || data === undefined) return '';
  const out: Array<[string, string]> = []; flatten(data, '', out, 0);
  const shown = out.slice(0, 30);
  return rows(shown) + (out.length > shown.length ? `  … ${out.length - shown.length} more fields\n` : '') + 'Full result: add --json.\n';
}
function diagnosticsBlock(style: Style, diagnostics: Diagnostic[], mark: Mark = 'warn'): string {
  return diagnostics.map(item => `  ${marker(style, mark)} ${item.code}  ${item.message}\n${item.next ? `         fix: ${runnable(item.next)}\n` : ''}`).join('');
}
function statusView(style: Style, value: Result): string {
  const data = record(value.data), manifest = data.manifest ? record(data.manifest) : null, config = data.configuration ? record(data.configuration) : null;
  const plugin = manifest ? `${String(manifest.id)} ${String(manifest.version)} "${String(manifest.name)}" (minAppVersion ${String(manifest.minAppVersion)})` : 'no manifest.json';
  let text = rows([['Root', String(data.root)], ['Plugin', plugin], ['Configured', config ? 'yes (shell.config.json)' : 'no'],
    ['Design', data.imported ? data.designStale ? 'imported, changed since generation' : 'imported' : 'not imported'], ['Generated', data.generated ? 'yes' : 'no'],
    ['Dependencies', data.dependencies ? 'installed' : 'missing'], ['Node', process.version], ['Acceptance', typeof data.acceptanceObligations === 'number' ? `${data.acceptanceObligations} obligations pending` : null]]);
  const passes: string[] = [];
  if (data.dependencies) passes.push('Dependencies installed');
  if (config) passes.push('Project configured');
  if (data.designStale === false) passes.push('Generation matches the accepted design');
  text += `${bold(style, 'Checks')}\n` + passes.map(item => `  ${marker(style, 'pass')} ${item}\n`).join('') + diagnosticsBlock(style, value.diagnostics);
  const next = value.diagnostics.find(item => item.next)?.next ?? (typeof data.next === 'string' ? data.next : null);
  return text + nextLine(style, next);
}
function makersView(style: Style, makers: Data[]): string {
  if (makers.length === 1) {
    const maker = makers[0]!, options = (maker.options as string[]).filter(name => !['--dry-run', '--yes', '--no-interaction', '--json', '--help', '--list'].includes(name));
    return `${bold(style, String(maker.id))}: ${String(maker.description)}\n` + rows([['Status', String(maker.status)], ['Options', options.join(' ') || 'none'],
      ['Needs', (maker.prerequisites as string[]).join(', ')], ['Effects', (maker.sideEffects as string[]).join(', ')], ['Network', String(maker.network)]])
      + nextLine(style, `make ${String(maker.id)} <name> --dry-run`);
  }
  const width = Math.max(...makers.map(maker => String(maker.id).length));
  return makers.map(maker => `  ${String(maker.id).padEnd(width)}  ${String(maker.status).padEnd(11)}  ${String(maker.description)}\n`).join('')
    + '\nDescribe one: node shell.mjs make describe <recipe>\n' + nextLine(style, 'make feature <name> --dry-run');
}
const stepMark: Record<string, Mark> = { passed: 'pass', failed: 'fail', skipped: 'skip', 'not-run': 'info' };
function checkView(style: Style, value: Result): string {
  const data = record(value.data), steps = (data.steps ?? []) as Data[], summary = record(data.summary), changes = data.changes ? record(data.changes) : null;
  let text = '';
  for (const step of steps.filter(item => item.status === 'failed')) {
    text += `${bold(style, `--- ${String(step.id)} (${String(step.code)}) last output ---`)}\n${String(step.outputTail ?? '').split('\n').map(line => `  ${line}\n`).join('')}\n`;
  }
  text += rows([['Scope', `${String(data.scope)}, ${String(data.mode)} mode (not verify)`],
    ['Changes', changes ? `${changes.source === 'git' ? `${String(changes.files)} changed source files` : 'git unavailable'}${changes.reason ? ` (${String(changes.reason)})` : ''}` : null]]);
  const width = Math.max(0, ...steps.map(step => String(step.id).length)), commandWidth = Math.max(0, ...steps.map(step => String(step.command).length));
  for (const step of steps) {
    const timing = step.status === 'passed' || step.status === 'failed' ? duration(Number(step.durationMs)) : String(step.reason ?? 'not run');
    const exit = step.exitCode !== undefined && step.exitCode !== null && step.status === 'failed' ? `  exit ${String(step.exitCode)}` : '';
    text += `  ${marker(style, stepMark[String(step.status)] ?? 'info')} ${String(step.id).padEnd(width)}  ${String(step.command).padEnd(commandWidth)}  ${timing}${exit}`.trimEnd() + '\n';
  }
  if (value.status === 'planned') return text + nextLine(style, `check${data.mode === 'fast' ? ' --fast' : ''}`);
  text += `  Summary  ${String(summary.passed)} passed, ${String(summary.failed)} failed, ${String(summary.skipped)} skipped in ${duration(Number(summary.durationMs))}\n`;
  const next = value.diagnostics[0]?.next;
  const gate = data.scope === 'generated-project' ? 'npm run verify:project' : 'verify';
  return text + (next ? nextLine(style, next) : `All check steps passed. Run ${gate} for the full gate before release work.\n`);
}
function submissionView(style: Style, value: Result): string {
  const data = record(value.data), rules = (data.rules ?? []) as Data[], summary = record(data.summary);
  const width = Math.max(0, ...rules.map(item => String(item.id).length));
  let text = '';
  for (const category of ['manifest', 'repository', 'lint', 'build']) {
    const selected = rules.filter(item => item.category === category);
    if (!selected.length) continue;
    text += `${bold(style, category[0]!.toUpperCase() + category.slice(1))}\n`;
    for (const item of selected) {
      text += `  ${marker(style, item.status === 'pass' ? 'pass' : item.status === 'fail' ? 'fail' : 'warn')} ${String(item.id).padEnd(width)}  ${String(item.message)}\n`;
      if (item.status !== 'pass' && item.remediation) text += `  ${' '.repeat(width + (style.unicode ? 4 : 9))}fix: ${String(item.remediation)}\n`;
    }
  }
  text += `\n  Summary  ${String(summary.pass)} pass, ${String(summary.warn)} warn, ${String(summary.fail)} fail. Local mirror only: the directory scan also runs policy, vulnerability and malware checks.\n`;
  return text + nextLine(style, value.diagnostics[0]?.next ?? null);
}
function planView(style: Style, value: Result): string {
  const data = record(value.data), changes = (data.changes ?? []) as Data[], conflicts = (data.conflicts ?? []) as string[], applied = data.applied ? record(data.applied) : null;
  const counts = new Map<string, number>();
  for (const change of changes) counts.set(String(change.status), (counts.get(String(change.status)) ?? 0) + 1);
  const width = Math.max(0, ...changes.map(change => String(change.status).length));
  let text = rows([['Plan hash', String(data.planHash)], ['Changes', [...counts].map(([status, count]) => `${count} ${status}`).join(', ') || 'none'],
    ['Conflicts', conflicts.length ? conflicts.join('; ') : 'none'], ['Written', applied ? `${(applied.written as unknown[] | undefined)?.length ?? 0} files` : null], ['Saved plan', typeof data.saved === 'string' ? data.saved : null]]);
  const listed = changes.filter(change => change.status !== 'unchanged').slice(0, 25);
  text += listed.map(change => `    ${String(change.status).padEnd(width)}  ${String(change.path)}\n`).join('');
  if (changes.filter(change => change.status !== 'unchanged').length > listed.length) text += '    … more changes in --json\n';
  if (value.status === 'planned') text += nextLine(style, `rerun the same command with --apply ${String(data.planHash)} (or --yes) to write exactly this plan`);
  return text;
}
export function renderHuman(value: Result, style: Style): Rendered {
  const header = `${value.command}: ${value.status}\n`, data = record(value.data);
  if (value.status === 'failed' && value.command !== 'check') return { text: header + (Object.keys(data).every(key => key === 'suggestions') ? '' : generic(value.data)), diagnosticsShown: false };
  if (Array.isArray(data.commands) && (value.command === 'help' || value.command === 'capabilities' || data.scope)) return { text: helpText(style, value.data as HelpData), diagnosticsShown: false };
  if (value.command === 'status' || value.command === 'doctor') return { text: header + statusView(style, value), diagnosticsShown: true };
  if (value.command === 'make' && Array.isArray(data.makers)) return { text: header + makersView(style, data.makers as Data[]), diagnosticsShown: false };
  if (value.command === 'check') return { text: header + checkView(style, value), diagnosticsShown: true };
  if (value.command === 'check submission') return { text: header + submissionView(style, value), diagnosticsShown: true };
  if (typeof data.planHash === 'string' && Array.isArray(data.changes)) return { text: header + planView(style, value), diagnosticsShown: false };
  return { text: header + generic(value.data), diagnosticsShown: false };
}
