import { availableFrameworks, projectPreset, resolveProjectSelection, type ProjectSelection } from '../../scripts/compiler/domain/project-presets.ts';
import { loadProjectCatalog, projectGuide, projectPlan } from '../adapters/projects.ts';
import { guideInput } from '../adapters/prototype.ts';
import { requireSketch } from '../domain/errors.ts';
import type { Answers } from '../domain/guide.ts';
import { interview } from './guide.ts';
import { review } from './review.ts';
import { Back, choose, input, selectMany, reportError, type Prompts } from './prompts.ts';
export interface ProjectWizardOptions {
  root: string; frameworkRoot: string; out?: string; preset?: string; framework?: string; targets?: string[]; signal?: AbortSignal;
}
/** Revisit configuration without carrying approval or stale branch answers into a different project. */
export async function projectWizard(ui: Prompts, options: ProjectWizardOptions): Promise<string | undefined> {
  const catalog = await loadProjectCatalog();
  let presetId = options.preset ?? 'plugin-nuxtui', frameworkId = options.framework ?? '', targets = options.targets ?? [];
  projectPreset(catalog, presetId);
  requireSketch(!frameworkId || catalog.frameworks.some(item => item.id === frameworkId), 'PROJECT_FRAMEWORK', 'Choose a supported frontend framework.');
  let stage = 0, answers: Answers = {}, out = options.out ?? 'projects/prepared-project';
  let selection: ProjectSelection | undefined;
  while (true) {
    requireSketch(!options.signal?.aborted, 'CANCELLED', 'Project creation cancelled.');
    ui.rich?.context({ title: 'New project', location: ['Project preset', 'Frontend framework', 'Hybrid targets', 'Prototype brief', 'Output and review'][stage]!,
      details: ['Preset → framework → prototype', 'Nothing is written until the complete plan is approved.', 'Escape: previous step. Ctrl+C: cancel.'] });
    try {
      if (stage === 0) {
        const chosen = await choose(ui, 'What kind of project are you creating?', catalog.presets.map(item => ({ id: item.id, label: item.label + ' — ' + item.description })), presetId);
        if (chosen !== presetId) { frameworkId = ''; targets = []; answers = {}; }
        presetId = chosen; stage = 1; continue;
      }
      const preset = projectPreset(catalog, presetId);
      if (stage === 1) {
        const candidates = availableFrameworks(catalog, preset.projectType === 'hybrid' ? catalog.targets.filter(item => item.id !== 'cli').map(item => item.id) : [preset.projectType]);
        const previous = frameworkId;
        if (preset.projectType === 'cli') { frameworkId = 'none'; ui.write('CLI selected: no frontend framework. Continue with command journeys in the prototype brief.\n'); }
        else frameworkId = await choose(ui, 'Choose a frontend framework', catalog.frameworks.filter(item => candidates.includes(item.id)).map(item => ({ id: item.id, label: item.label + ' — ' + item.description })), frameworkId || preset.defaultFramework);
        if (previous !== frameworkId) answers = {};
        stage = preset.projectType === 'hybrid' ? 2 : 3; continue;
      }
      if (stage === 2) {
        const chosen = await selectMany(ui, 'Select at least two hybrid targets', catalog.targets.map(item => ({ id: item.id, label: item.label })), targets);
        requireSketch(chosen.length >= 2, 'PROJECT_TARGETS', 'Select at least two distinct targets for a hybrid project.');
        if (JSON.stringify(chosen) !== JSON.stringify(targets)) answers = {};
        targets = chosen; stage = 3; continue;
      }
      selection = resolveProjectSelection(catalog, { schemaVersion: 1, catalogVersion: catalog.version, preset: presetId, framework: frameworkId,
        ...(preset.projectType === 'hybrid' ? { targets } : {}) });
      const guide = await projectGuide(selection, catalog);
      if (stage === 3) {
        answers = await interview(ui, guide, { ...answers, approved: false });
        const result = guideInput(guide, { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers });
        requireSketch(!result.pending.length, 'PROTOTYPE_AGREEMENT', result.pending.join(' '));
        answers = result.answers; stage = 4; continue;
      }
      out = await input(ui, 'Project package output folder', out);
      const { projectType: _type, ...configuration } = selection;
      ui.rich?.busy('Preparing target-specific source and prototype handoff. No files written yet.');
      const plan = await projectPlan({ ...options, out, input: { ...configuration,
        interview: { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers } } });
      if (!await review(ui, plan, options.signal)) { ui.write('No project files written.\n'); return; }
      const completion = `Start with ${out}/execution-prompt.md. Selected targets: ${selection.targets.join(', ')}; framework: ${selection.framework}. Source: ${out}/source/.\n`;
      ui.write(completion); return completion;
    } catch (error) {
      if (error instanceof Back) {
        if (stage === 0) throw error;
        stage = stage === 3 && projectPreset(catalog, presetId).projectType !== 'hybrid' ? 1 : stage - 1;
        answers = { ...answers, approved: false };
      } else { reportError(ui, error); }
    }
  }
}
