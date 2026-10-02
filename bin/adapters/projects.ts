import { loadDefinitions } from '../../scripts/starters/repository.ts';
import { projectSelection, type ProjectSelection } from '../compiler/domain/project-starter.ts';
import { frameworkAdapter, requireFrameworkAdapter } from '../compiler/adapters/project/framework-registry.ts';
import { pluginFrameworkAdapters } from '../../plugins/runtime.ts';
import { object, keys } from '../domain/data.ts';
import { requireSketch } from '../domain/errors.ts';
import { guideBrief, type Guide } from '../domain/guide.ts';
import { loadGuide, guideInput, prototypePlan } from './prototype.ts';
/** Project starters are read from the shell's own starters folder (beside shell.mjs); there is no bundled fallback. */
export async function projectStarters(frameworkRoot: string) {
  return (await loadDefinitions(frameworkRoot)).flatMap(({ definition: d, sha256, file }) => {
    if (d.generator.kind !== 'project') return [];
    const selection = projectSelection({ id: d.id, version: d.version, sha256 }, d.generator);
    requireSketch(frameworkAdapter(selection.framework, pluginFrameworkAdapters()), 'PROJECT_FRAMEWORK_UNKNOWN', 'Starter ' + d.id + ' needs an installed framework adapter for ' + selection.framework + '.');
    return [{ id: d.id, name: d.name, summary: d.summary, version: d.version, sha256, file, selection }];
  });
}
export async function projectStarter(frameworkRoot: string, id: unknown) {
  const starters = await projectStarters(frameworkRoot);
  const selected = starters.find(item => item.id === id);
  requireSketch(selected, 'PROJECT_STARTER_UNKNOWN', starters.length
    ? `Choose an installed project starter: ${starters.map(item => item.id).join(', ')}.`
    : 'No project starters are installed. Extract the separate starters ZIP beside shell.mjs (configs/starters/).');
  return selected;
}
export async function projectGuide(selected: ProjectSelection): Promise<Guide> {
  const guide = await loadGuide(new URL('../guides/project-prototype.json', import.meta.url));
  const adapter = requireFrameworkAdapter(selected.framework, pluginFrameworkAdapters());
  guide.context = `## Project starter\n\nStarter: ${selected.starter.id} ${selected.starter.version}\n\nProject type: ${selected.projectType}\n\nFrontend: ${adapter.label} (${selected.framework})\n\nTargets: ${selected.targets.join(', ')}\n\nHybrid means shared code with separate host entrypoints; it does not add cloud sync or a desktop runtime. Choosing another starter reopens agreement.\n`;
  return guide;
}
export async function projectRequest(input: unknown, frameworkRoot: string) {
  const data = object(input); keys(data, ['schemaVersion', 'starter', 'interview']);
  requireSketch(data.schemaVersion === 2, 'PROJECT_REQUEST_VERSION', 'Expected project request schemaVersion 2 with a starter ID; discover it with new guide --starter <id> --json.');
  const { selection } = await projectStarter(frameworkRoot, data.starter);
  const guide = await projectGuide(selection);
  const resolved = guideInput(guide, data.interview);
  return { selection, guide, interviewInput: data.interview, ...resolved, ready: resolved.pending.length === 0, brief: guideBrief(guide, resolved.answers) };
}
export async function projectPlan(options: { root: string; frameworkRoot: string; out: string; input: unknown; signal?: AbortSignal }) {
  const request = await projectRequest(options.input, options.frameworkRoot);
  requireSketch(request.ready, 'PROTOTYPE_AGREEMENT', request.pending.join(' '));
  return prototypePlan({ ...options, guide: request.guide, input: request.interviewInput, selection: request.selection, baseline: null });
}
