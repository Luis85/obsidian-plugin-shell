/** Human views of the adoption commands. The JSON result stays the authority; these never claim an integration happened. */
import type { AdoptionReport, Severity } from '../../domain/adoption/contracts.ts';
import type { Result } from '../../../../scripts/contracts/result.ts';
import { bold, marker, nextLine, rows, type Mark, type Style } from './terminal-style.ts';

const marks: Record<Severity, Mark> = { block: 'fail', warn: 'warn', info: 'info' };
const join = (values: readonly string[]): string => values.length ? values.join(', ') : 'none';
function angularRow(report: AdoptionReport): string {
  const angular = report.angular;
  if (!angular) return 'not detected';
  const c = angular.sourceCounts;
  return `${angular.version ?? 'unknown'} (${angular.projects.length} projects, ${c.components} components, ${c.ngModules} NgModules, ${angular.routing.routeCountEstimate} route entries); target ${report.targets.angular.version ?? 'unknown'}`;
}
function factRows(report: AdoptionReport): Array<[string, string]> {
  const { git } = report.target, manager = report.runtime.packageManager;
  return [
    ['Target', report.target.name],
    ['Git', git.present ? `present, ${git.dirty === null ? 'state unknown' : git.dirty ? 'dirty' : 'clean'}${git.remoteHost ? `, remote ${git.remoteHost}` : ''}` : 'absent'],
    ['Package manager', manager.name ? `${manager.name}${manager.version ? '@' + manager.version : ''} (${join(manager.lockfiles)})` : 'none'],
    ['Frameworks', join(report.frameworks.map(item => item.id + (item.version ? ' ' + item.version : '')))], ['Angular', angularRow(report)],
    ['Testing', join(report.tooling.testing)], ['CI', join(report.tooling.ciProviders)], ['Agent files', join(report.agents.files.slice(0, 5))],
    ['Workbench', report.workbench.present ? 'present' : 'absent'],
    ['Scan', `${report.scan.files} files${report.scan.truncated ? ' (truncated)' : ''}; read-only, no project code executed`],
  ];
}
export function adoptAnalyzeView(style: Style, value: Result): string {
  const data = value.data as { report: AdoptionReport; written: { path: string; sha256: string } | null };
  const findings = data.report.findings.map(item => `  ${marker(style, marks[item.severity])} ${item.id}  ${item.message}\n`).join('');
  const written = data.written ? rows([['Report written', data.written.path], ['Report SHA-256', data.written.sha256]]) : '';
  return rows(factRows(data.report)) + written + `${bold(style, 'Findings')}\n${findings || '  none\n'}` + nextLine(style, 'adopt plan');
}
interface PlanData { planHash: string; conflicts: string[]; applied?: { written: unknown[] }; summary: { markdown: string; markdownSha256: string; output: string; strategy: string; source: string } }
export function adoptPlanView(style: Style, value: Result): string {
  const data = value.data as PlanData;
  const preview = value.status === 'planned' && !data.conflicts.length;
  const body = preview ? data.summary.markdown + '\n' : '';
  const details = rows([['Output', data.summary.output], ['Strategy', data.summary.strategy], ['Report', data.summary.source], ['Markdown SHA-256', data.summary.markdownSha256], ['Plan hash', data.planHash],
    ['Conflicts', data.conflicts.length ? data.conflicts.join('; ') : 'none'], ['Written', data.applied ? `${data.applied.written.length} file` : null]]);
  const next = preview ? `rerun the same command with --apply ${data.planHash} (or --yes) to write only ${data.summary.output}` : null;
  return body + details + nextLine(style, next);
}
