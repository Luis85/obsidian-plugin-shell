import { computeUiStatus, type UiStatusReport } from '../domain/ui-status.ts';
import { E2E_RESULTS_PATH, GALLERY_INDEX_PATH, type ReportRead } from '../domain/ui-status-evidence.ts';
import { readDefinitions, readInteractions, readJourneys, type UiInteraction } from '../domain/ui-status-input.ts';
import type { SpecFile } from '../domain/ui-status-source.ts';

const TRACEABILITY_PATH = 'design/visual-traceability.json';
const PROJECT_PATH = 'design/project.json';
/** Read-only port; the adapter confines every path to the project root. */
export interface UiStatusPort {
  readJson(path: string): Promise<ReportRead>;
  readText(path: string): Promise<string | null>;
  specFiles(): Promise<SpecFile[]>;
}
const value = (read: ReportRead): unknown => read.state === 'present' ? read.value : null;
function linkedPaths(interactions: readonly UiInteraction[]): string[] {
  return [...new Set(interactions.flatMap(item => [item.implementation, item.test]).filter((path): path is string => path !== null))];
}
async function readFiles(port: UiStatusPort, paths: readonly string[]): Promise<Record<string, string | null>> {
  return Object.fromEntries(await Promise.all(paths.map(async path => [path, await port.readText(path)] as const)));
}
/** True when the folder carries a companion project or generated visual traceability at all. */
export const isUiProject = (report: UiStatusReport): boolean => report.sources.traceability !== 'absent' || report.sources.project !== 'absent';
export async function collectUiStatus(port: UiStatusPort): Promise<UiStatusReport> {
  const [traceability, project] = await Promise.all([port.readJson(TRACEABILITY_PATH), port.readJson(PROJECT_PATH)]);
  const interactions = readInteractions(value(traceability));
  const [files, specs, e2e, gallery] = await Promise.all([readFiles(port, linkedPaths(interactions)), port.specFiles(), port.readJson(E2E_RESULTS_PATH), port.readJson(GALLERY_INDEX_PATH)]);
  return computeUiStatus({ sources: { traceability: traceability.state, project: project.state },
    definitions: readDefinitions(value(traceability), value(project)), interactions, journeys: readJourneys(value(project)), files, specs, e2e, gallery });
}
