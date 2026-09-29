import { fileURLToPath } from 'node:url';
import { readProjectCatalog, resolveProjectSelection, projectPreset, type ProjectSelection, type ProjectCatalog } from '../../scripts/compiler/domain/project-presets.ts';
import { object, keys } from '../domain/data.ts';
import { requireSketch } from '../domain/errors.ts';
import { guideBrief, type Guide } from '../domain/guide.ts';
import { readData } from './storage.ts';
import { loadGuide, guideInput, prototypePlan } from './prototype.ts';
export async function loadProjectCatalog(): Promise<ProjectCatalog> {
  return readProjectCatalog(await readData(fileURLToPath(new URL('../guides/project-presets.json', import.meta.url))));
}
export async function projectGuide(selected: ProjectSelection, catalog: ProjectCatalog): Promise<Guide> {
  const guide = await loadGuide(new URL('../guides/project-prototype.json', import.meta.url));
  const preset = projectPreset(catalog, selected.preset);
  const framework = catalog.frameworks.find(item => item.id === selected.framework)!;
  guide.context = `## Project selection\n\nPreset: ${preset.label} (${preset.id})\n\nProject type: ${selected.projectType}\n\nFrontend: ${framework.label} (${framework.id})\n\nTargets: ${selected.targets.join(', ')}\n\n${framework.description}\n\nCatalog version: ${catalog.version}. Hybrid means shared code with separate host entrypoints; it does not add cloud sync or a desktop runtime. Changing this selection reopens agreement.\n`;
  return guide;
}
export async function projectRequest(input: unknown) {
  const data = object(input); keys(data, ['schemaVersion', 'catalogVersion', 'preset', 'framework', 'targets', 'interview']);
  const { interview: interviewInput, ...configuration } = data;
  const catalog = await loadProjectCatalog();
  const selection = resolveProjectSelection(catalog, configuration);
  const guide = await projectGuide(selection, catalog);
  const resolved = guideInput(guide, interviewInput);
  return { selection, guide, interviewInput, ...resolved, ready: resolved.pending.length === 0, brief: guideBrief(guide, resolved.answers) };
}
export async function projectPlan(options: { root: string; frameworkRoot: string; out: string; input: unknown; signal?: AbortSignal }) {
  const request = await projectRequest(options.input);
  requireSketch(request.ready, 'PROTOTYPE_AGREEMENT', request.pending.join(' '));
  return prototypePlan({ ...options, guide: request.guide, input: request.interviewInput, selection: request.selection, baseline: null });
}
