/** Compact human view of `ui status`. The JSON result stays the authority; this view never claims acceptance. */
import type { UiState, UiStatusReport, StateCounts, SurfaceStatus, InteractionStatus, JourneyStatus } from '../../domain/ui-status.ts';
import { bold, nextLine, rows, type Style } from './terminal-style.ts';

const MAX_LISTED = 25;
const tag = (state: UiState): string => `[${state}]`.padEnd(13);
const split = (counts: StateCounts): string => `${counts.todo} todo, ${counts.implemented} implemented, ${counts.generated} generated`;
const total = (label: string, counts: StateCounts): [string, string] => [label, `${counts.total} (${split(counts)})`];
function surfaceLine(surface: SurfaceStatus, width: number): string {
  const { interactions } = surface;
  return `  ${tag(surface.state)} ${surface.id.padEnd(width)}  ${surface.label}  ${surface.kind}  ${interactions.total} interactions (${split(interactions)})  specs ${surface.specs.length}\n`;
}
function interactionLine(item: InteractionStatus): string {
  return `  ${tag(item.state)} ${item.id}  ${item.label} (${item.surfaceId})  ${item.reasons.join(', ')}\n`;
}
function journeyLine(item: JourneyStatus): string {
  return `  ${item.id}  ${item.name}: ${item.steps} steps, ${item.stepsWithSpec} with a matching spec (${item.coverage})\n`;
}
const list = (values: readonly (string | number)[]): string => values.length ? values.join(', ') : 'none';
function reportLine(label: string, state: string, detail: string): [string, string] { return [label, state === 'present' ? detail : state]; }
function evidenceRows(report: UiStatusReport): Array<[string, string]> {
  const { e2e, gallery } = report.evidence;
  return [
    reportLine('E2E results', e2e.state, `${e2e.passed} passed, ${e2e.failed} failed, ${e2e.skipped} skipped; themes ${list(e2e.themes)}; widths ${list(e2e.widths)}`),
    reportLine('UI gallery', gallery.state, `${gallery.entries} captures; surfaces ${gallery.surfaces.length}; themes ${list(gallery.themes)}; widths ${list(gallery.widths)}${gallery.recognized ? '' : ' (index shape not recognised)'}`),
  ];
}
function section(style: Style, title: string, lines: readonly string[], overflow: number): string {
  if (!lines.length) return '';
  return `${bold(style, title)}\n${lines.join('')}${overflow > 0 ? `  … ${overflow} more in --json\n` : ''}`;
}
function firstTodo(report: UiStatusReport): string | null {
  const next = report.interactions.find(item => item.state === 'todo');
  return next ? `open ${next.stub?.path ?? next.acceptanceTest?.path ?? next.surfaceId} and implement ${next.id}, then rerun ui status` : null;
}
export function uiStatusView(style: Style, report: UiStatusReport): string {
  const { journeys } = report.totals, width = Math.max(0, ...report.surfaces.map(item => item.id.length));
  const todo = report.interactions.filter(item => item.state === 'todo');
  let text = rows([total('Surfaces', report.totals.surfaces), total('Interactions', report.totals.interactions),
    ['Journeys', `${journeys.total} (${journeys.steps} steps, ${journeys.stepsWithSpec} with a matching spec)`],
    ...evidenceRows(report), ['Proof', 'static source analysis; no test was executed; business acceptance not-run']]);
  text += section(style, 'Surfaces', report.surfaces.slice(0, MAX_LISTED).map(item => surfaceLine(item, width)), report.surfaces.length - MAX_LISTED);
  text += section(style, 'Interactions still todo', todo.slice(0, MAX_LISTED).map(item => interactionLine(item)), todo.length - MAX_LISTED);
  text += section(style, 'Journeys', report.journeys.slice(0, MAX_LISTED).map(journeyLine), report.journeys.length - MAX_LISTED);
  return text + nextLine(style, firstTodo(report));
}
