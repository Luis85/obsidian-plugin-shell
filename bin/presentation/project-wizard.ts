import { projectSelectionRequest, availableFrameworks, projectPreset, resolveProjectSelection, type ProjectCatalog, type ProjectPreset, type ProjectSelection } from '../../scripts/compiler/domain/project-presets.ts';
import { loadProjectCatalog, projectGuide, projectPlan } from '../adapters/projects.ts';
import { guideInput } from '../adapters/prototype.ts';
import { requireSketch } from '../domain/errors.ts';
import type { Guide, Answers } from '../domain/guide.ts';
import { interview } from './guide.ts';
import { review } from './review.ts';
import { Back, choose, input, selectMany, reportError, type Prompts } from './prompts.ts';
export interface ProjectWizardOptions {
  root: string; frameworkRoot: string; out?: string; preset?: string; framework?: string; targets?: string[]; signal?: AbortSignal;
}
interface WizardState {
  presetId: string; frameworkId: string; targets: string[]; answers: Answers; out: string; stage: number;
}
function initialState(catalog: ProjectCatalog, options: ProjectWizardOptions): WizardState {
  const state = { presetId: options.preset ?? 'plugin-nuxtui', frameworkId: options.framework ?? '',
    targets: options.targets ?? [], answers: {}, out: options.out ?? 'projects/prepared-project', stage: 0 };
  projectPreset(catalog, state.presetId);
  requireSketch(!state.frameworkId || catalog.frameworks.some(item => item.id === state.frameworkId), 'PROJECT_FRAMEWORK', 'Choose a supported frontend framework.');
  return state;
}
function showContext(ui: Prompts, stage: number): void {
  ui.rich?.context({ title: 'New project', location: ['Project preset', 'Frontend framework', 'Hybrid targets', 'Prototype brief', 'Output and review'][stage]!,
    details: ['Preset → framework → prototype', 'Nothing is written until the complete plan is approved.', 'Escape: previous step. Ctrl+C: cancel.'] });
}
async function choosePreset(ui: Prompts, catalog: ProjectCatalog, state: WizardState): Promise<void> {
  const chosen = await choose(ui, 'What kind of project are you creating?', catalog.presets.map(item => ({ id: item.id, label: item.label + ' — ' + item.description })), state.presetId);
  if (chosen !== state.presetId) { state.frameworkId = ''; state.targets = []; state.answers = {}; }
  state.presetId = chosen; state.stage = 1;
}
async function chooseFramework(ui: Prompts, catalog: ProjectCatalog, preset: ProjectPreset, state: WizardState): Promise<void> {
  const candidates = availableFrameworks(catalog, preset.projectType === 'hybrid' ? catalog.targets.filter(item => item.id !== 'cli').map(item => item.id) : [preset.projectType]);
  const previous = state.frameworkId;
  if (preset.projectType === 'cli') {
    state.frameworkId = 'none'; ui.write('CLI selected: no frontend framework. Continue with command journeys in the prototype brief.\n');
  } else {
    state.frameworkId = await choose(ui, 'Choose a frontend framework', catalog.frameworks.filter(item => candidates.includes(item.id)).map(item => ({ id: item.id, label: item.label + ' — ' + item.description })), state.frameworkId || preset.defaultFramework);
  }
  if (previous !== state.frameworkId) state.answers = {};
  state.stage = preset.projectType === 'hybrid' ? 2 : 3;
}
async function chooseTargets(ui: Prompts, catalog: ProjectCatalog, state: WizardState): Promise<void> {
  const chosen = await selectMany(ui, 'Select at least two hybrid targets', catalog.targets.map(item => ({ id: item.id, label: item.label })), state.targets);
  requireSketch(chosen.length >= 2, 'PROJECT_TARGETS', 'Select at least two distinct targets for a hybrid project.');
  if (JSON.stringify(chosen) !== JSON.stringify(state.targets)) state.answers = {};
  state.targets = chosen; state.stage = 3;
}
async function reviewBrief(ui: Prompts, guide: Guide, state: WizardState): Promise<void> {
  state.answers = await interview(ui, guide, { ...state.answers, approved: false });
  const result = guideInput(guide, { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers: state.answers });
  requireSketch(!result.pending.length, 'PROTOTYPE_AGREEMENT', result.pending.join(' '));
  state.answers = result.answers; state.stage = 4;
}
async function writeReview(ui: Prompts, options: ProjectWizardOptions, state: WizardState, selection: ProjectSelection, guide: Guide): Promise<{ completion?: string }> {
  state.out = await input(ui, 'Project package output folder', state.out);
  const configuration = projectSelectionRequest(selection);
  ui.rich?.busy('Preparing target-specific source and prototype handoff. No files written yet.');
  const plan = await projectPlan({ ...options, out: state.out, input: { ...configuration,
    interview: { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers: state.answers } } });
  if (!await review(ui, plan, options.signal)) { ui.write('No project files written.\n'); return {}; }
  const completion = `Start with ${state.out}/execution-prompt.md. Selected targets: ${selection.targets.join(', ')}; framework: ${selection.framework}. Source: ${state.out}/source/.\n`;
  ui.write(completion); return { completion };
}
async function advance(ui: Prompts, catalog: ProjectCatalog, options: ProjectWizardOptions, state: WizardState): Promise<false | { completion?: string }> {
  if (state.stage === 0) { await choosePreset(ui, catalog, state); return false; }
  const preset = projectPreset(catalog, state.presetId);
  if (state.stage === 1) { await chooseFramework(ui, catalog, preset, state); return false; }
  if (state.stage === 2) { await chooseTargets(ui, catalog, state); return false; }
  const selection = resolveProjectSelection(catalog, { schemaVersion: 1, catalogVersion: catalog.version, preset: state.presetId, framework: state.frameworkId,
    ...(preset.projectType === 'hybrid' ? { targets: state.targets } : {}) });
  const guide = await projectGuide(selection, catalog);
  if (state.stage === 3) { await reviewBrief(ui, guide, state); return false; }
  return writeReview(ui, options, state, selection, guide);
}
function recoverStep(ui: Prompts, catalog: ProjectCatalog, state: WizardState, error: unknown): void {
  if (!(error instanceof Back)) { reportError(ui, error); return; }
  if (state.stage === 0) throw error;
  state.stage = state.stage === 3 && projectPreset(catalog, state.presetId).projectType !== 'hybrid' ? 1 : state.stage - 1;
  state.answers = { ...state.answers, approved: false };
}
/** Revisit configuration without carrying approval or stale branch answers into a different project. */
export async function projectWizard(ui: Prompts, options: ProjectWizardOptions): Promise<string | undefined> {
  const catalog = await loadProjectCatalog(), state = initialState(catalog, options);
  while (true) {
    requireSketch(!options.signal?.aborted, 'CANCELLED', 'Project creation cancelled.');
    showContext(ui, state.stage);
    try {
      const result = await advance(ui, catalog, options, state);
      if (result) return result.completion;
    } catch (error) { recoverStep(ui, catalog, state, error); }
  }
}
