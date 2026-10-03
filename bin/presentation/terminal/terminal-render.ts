/**
 * Human renderers for operation results. The JSON result stays the authority; these views never
 * print raw JSON and end with an actionable `Next:` line where one exists (https://clig.dev/#output).
 */
import type { Diagnostic, Result } from '../../adapters/framework/contracts.ts';
import { helpText, type HelpData } from './terminal-help.ts';
import { adoptAnalyzeView, adoptPlanView } from './adopt-view.ts';
import { checkPlanView } from './check-plan-view.ts';
import { ciJobView, ciListView } from './ci-view.ts';
import { uiStatusView } from './ui-status-view.ts';
import type { UiStatusReport } from '../../domain/ui-status.ts';
import { bold, duration, marker, nextLine, rows, runnable, type Mark, type Style } from './terminal-style.ts';
export interface Rendered { text: string; diagnosticsShown: boolean }
type Data = Record<string, unknown>;
const record = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {};
function scalar(value: unknown): string {
  if (typeof value !== 'string') return String(value);
  const first = value.split('\n')[0]!;
  return value.includes('\n') || value.length > 100 ? `${first.slice(0, 80)}… (${value.length} chars; see --json)` : value;
}
function arraySummary(value: unknown[]): string {
  if (!value.length) return 'none';
  const simple = value.every(item => item === null || typeof item !== 'object');
  return simple && value.length <= 6 ? value.map(scalar).join(', ') : `${value.length} items`;
}
function flatten(value: unknown, prefix: string, out: Array<[string, string]>, depth: number): void {
  if (value === null || typeof value !== 'object') { out.push([prefix, scalar(value)]); return; }
  if (Array.isArray(value)) { out.push([prefix, arraySummary(value)]); return; }
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
function pluginLine(manifest: Data | null): string {
  return manifest ? `${String(manifest.id)} ${String(manifest.version)} "${String(manifest.name)}" (minAppVersion ${String(manifest.minAppVersion)})` : 'no manifest.json';
}
function designState(data: Data): string {
  if (!data.imported) return 'not imported';
  return data.designStale ? 'imported, changed since generation' : 'imported';
}
function statusPasses(data: Data, configured: boolean): string[] {
  const passes: string[] = [];
  if (data.dependencies) passes.push('Dependencies installed');
  if (configured) passes.push('Project configured');
  if (data.designStale === false) passes.push('Generation matches the accepted design');
  return passes;
}
function statusView(style: Style, value: Result): string {
  const data = record(value.data), manifest = data.manifest ? record(data.manifest) : null, configured = Boolean(data.configuration);
  let text = rows([['Root', String(data.root)], ['Plugin', pluginLine(manifest)], ['Configured', configured ? 'yes (shell.config.json)' : 'no'],
    ['Design', designState(data)], ['Generated', data.generated ? 'yes' : 'no'],
    ['Dependencies', data.dependencies ? 'installed' : 'missing'], ['Node', process.version], ['Acceptance', typeof data.acceptanceObligations === 'number' ? `${data.acceptanceObligations} obligations pending` : null]]);
  text += `${bold(style, 'Checks')}\n` + statusPasses(data, configured).map(item => `  ${marker(style, 'pass')} ${item}\n`).join('') + diagnosticsBlock(style, value.diagnostics);
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
    + '\nDescribe one: node bin/app make describe <recipe>\n' + nextLine(style, 'make feature <name> --dry-run');
}
const stepMark: Record<string, Mark> = { passed: 'pass', failed: 'fail', skipped: 'skip', 'not-run': 'info' };
function failedOutput(style: Style, steps: Data[]): string {
  return steps.filter(item => item.status === 'failed')
    .map(step => `${bold(style, `--- ${String(step.id)} (${String(step.code)}) last output ---`)}\n${String(step.outputTail ?? '').split('\n').map(line => `  ${line}\n`).join('')}\n`).join('');
}
function changesLine(changes: Data | null): string | null {
  if (!changes) return null;
  const files = changes.source === 'git' ? `${String(changes.files)} changed source files` : 'git unavailable';
  return files + (changes.reason ? ` (${String(changes.reason)})` : '');
}
function stepLine(style: Style, step: Data, width: number, commandWidth: number): string {
  const ran = step.status === 'passed' || step.status === 'failed';
  const timing = ran ? duration(Number(step.durationMs)) : String(step.reason ?? 'not run');
  const exit = step.exitCode !== undefined && step.exitCode !== null && step.status === 'failed' ? `  exit ${String(step.exitCode)}` : '';
  return `  ${marker(style, stepMark[String(step.status)] ?? 'info')} ${String(step.id).padEnd(width)}  ${String(step.command).padEnd(commandWidth)}  ${timing}${exit}`.trimEnd() + '\n';
}
function checkOutcome(style: Style, value: Result, data: Data): string {
  const summary = record(data.summary);
  const text = `  Summary  ${String(summary.passed)} passed, ${String(summary.failed)} failed, ${String(summary.skipped)} skipped in ${duration(Number(summary.durationMs))}\n`;
  const next = value.diagnostics[0]?.next;
  const gate = data.scope === 'generated-project' ? 'npm run verify:project' : 'verify';
  return text + (next ? nextLine(style, next) : `All check steps passed. Run ${gate} for the full gate before release work.\n`);
}
function checkView(style: Style, value: Result): string {
  const data = record(value.data), steps = (data.steps ?? []) as Data[], changes = data.changes ? record(data.changes) : null;
  let text = failedOutput(style, steps);
  text += rows([['Scope', `${String(data.scope)}, ${String(data.mode)} mode (not verify)`], ['Changes', changesLine(changes)]]);
  const width = Math.max(0, ...steps.map(step => String(step.id).length)), commandWidth = Math.max(0, ...steps.map(step => String(step.command).length));
  text += steps.map(step => stepLine(style, step, width, commandWidth)).join('');
  if (value.status === 'planned') return text + nextLine(style, `check${data.mode === 'fast' ? ' --fast' : ''}`);
  return text + checkOutcome(style, value, data);
}
const ruleMark: Record<string, Mark> = { pass: 'pass', fail: 'fail' };
function ruleLines(style: Style, item: Data, width: number): string {
  let text = `  ${marker(style, ruleMark[String(item.status)] ?? 'warn')} ${String(item.id).padEnd(width)}  ${String(item.message)}\n`;
  if (item.status !== 'pass' && item.remediation) text += `  ${' '.repeat(width + (style.unicode ? 4 : 9))}fix: ${String(item.remediation)}\n`;
  return text;
}
function submissionView(style: Style, value: Result): string {
  const data = record(value.data), rules = (data.rules ?? []) as Data[], summary = record(data.summary);
  const width = Math.max(0, ...rules.map(item => String(item.id).length));
  let text = '';
  for (const category of ['manifest', 'repository', 'lint', 'build']) {
    const selected = rules.filter(item => item.category === category);
    if (!selected.length) continue;
    text += `${bold(style, category[0]!.toUpperCase() + category.slice(1))}\n` + selected.map(item => ruleLines(style, item, width)).join('');
  }
  text += `\n  Summary  ${String(summary.pass)} pass, ${String(summary.warn)} warn, ${String(summary.fail)} fail. Local mirror only: the directory scan also runs policy, vulnerability and malware checks.\n`;
  return text + nextLine(style, value.diagnostics[0]?.next ?? null);
}
function planRows(data: Data, changes: Data[]): Array<[string, string | null]> {
  const conflicts = (data.conflicts ?? []) as string[];
  return [['Plan hash', String(data.planHash)], ['Changes', changeCounts(changes)],
    ['Conflicts', conflicts.length ? conflicts.join('; ') : 'none'], ['Written', writtenCount(data)], ['Saved plan', typeof data.saved === 'string' ? data.saved : null]];
}
function changeCounts(changes: Data[]): string {
  const counts = new Map<string, number>();
  for (const change of changes) counts.set(String(change.status), (counts.get(String(change.status)) ?? 0) + 1);
  return [...counts].map(([status, count]) => `${count} ${status}`).join(', ') || 'none';
}
function writtenCount(data: Data): string | null {
  if (!data.applied) return null;
  return `${(record(data.applied).written as unknown[] | undefined)?.length ?? 0} files`;
}
function planView(style: Style, value: Result): string {
  const data = record(value.data), changes = (data.changes ?? []) as Data[];
  const width = Math.max(0, ...changes.map(change => String(change.status).length));
  let text = rows(planRows(data, changes));
  const pending = changes.filter(change => change.status !== 'unchanged'), listed = pending.slice(0, 25);
  text += listed.map(change => `    ${String(change.status).padEnd(width)}  ${String(change.path)}\n`).join('');
  if (pending.length > listed.length) text += '    … more changes in --json\n';
  if (value.status === 'planned') text += nextLine(style, `rerun the same command with --apply ${String(data.planHash)} (or --yes) to write exactly this plan`);
  return text;
}
type View = (style: Style, value: Result, data: Data) => string | undefined;
/** Command-specific views in priority order; each returns undefined when it does not apply. */
const views: Array<[View, boolean]> = [
  [(style, value) => value.command === 'status' || value.command === 'doctor' ? statusView(style, value) : undefined, true],
  [(style, value, data) => value.command === 'make' && Array.isArray(data.makers) ? makersView(style, data.makers as Data[]) : undefined, false],
  [(style, value, data) => value.command === 'check' ? (data.mode === 'plan' ? checkPlanView(style, value) : checkView(style, value)) : undefined, true],
  [(style, value) => value.command === 'check submission' ? submissionView(style, value) : undefined, true],
  [(style, value, data) => value.command === 'ci' && data.gate === 'ci' ? ciJobView(style, value) : undefined, true],
  [(style, value, data) => value.command === 'ci' && Array.isArray(data.workflows) ? ciListView(style, value) : undefined, true],
  [(style, value) => value.command === 'ui status' ? uiStatusView(style, value.data as UiStatusReport) : undefined, false],
  [(style, value) => value.command === 'adopt analyze' ? adoptAnalyzeView(style, value) : undefined, false],
  [(style, value, data) => value.command === 'adopt plan' && typeof data.planHash === 'string' ? adoptPlanView(style, value) : undefined, false],
  [(style, value, data) => typeof data.planHash === 'string' && Array.isArray(data.changes) ? planView(style, value) : undefined, false],
];
const isHelp = (value: Result, data: Data) => Array.isArray(data.commands) && (value.command === 'help' || value.command === 'capabilities' || Boolean(data.scope));
export function renderHuman(value: Result, style: Style): Rendered {
  const header = `${value.command}: ${value.status}\n`, data = record(value.data);
  if (value.status === 'failed' && value.command !== 'check' && !(value.command === 'ci' && data.gate === 'ci')) return { text: header + (Object.keys(data).every(key => key === 'suggestions') ? '' : generic(value.data)), diagnosticsShown: false };
  if (isHelp(value, data)) return { text: helpText(style, value.data as HelpData), diagnosticsShown: false };
  for (const [view, diagnosticsShown] of views) {
    const text = view(style, value, data);
    if (text !== undefined) return { text: header + text, diagnosticsShown };
  }
  return { text: header + generic(value.data), diagnosticsShown: false };
}
