import type { ProjectSelection } from '../compiler/domain/project-starter.ts';
import { frameworkAdapter } from '../compiler/adapters/project/framework-registry.ts';
import { pluginFrameworkAdapters } from '../../plugins/runtime.ts';
import { projectGuide, projectPlan, projectStarters } from '../adapters/projects.ts';
import { guideInput } from '../adapters/prototype.ts';
import { requireSketch } from '../domain/errors.ts';
import type { Guide, Answers } from '../domain/guide.ts';
import { interview } from './guide.ts';
import { review } from './review.ts';
import { offerDesignFolder } from './design-folder.ts';
import { join } from 'node:path';
import { Back, choose, input, reportError, type Prompts } from './prompts.ts';
export interface ProjectWizardOptions { root: string; frameworkRoot: string; out?: string; starter?: string; signal?: AbortSignal }
type Starter = Awaited<ReturnType<typeof projectStarters>>[number];
interface WizardState { starterId: string; answers: Answers; out: string; stage: number }
function initialState(starters: Starter[], options: ProjectWizardOptions): WizardState {
  requireSketch(starters.length, 'PROJECT_STARTER_UNKNOWN', 'No project starters are installed. Extract the separate starters ZIP into the shell root (configs/starters/).');
  requireSketch(!options.starter || starters.some(item => item.id === options.starter), 'PROJECT_STARTER_UNKNOWN', `Choose an installed project starter: ${starters.map(item => item.id).join(', ')}.`);
  return { starterId: options.starter ?? starters[0]!.id, answers: {}, out: options.out ?? 'projects/prepared-project', stage: 0 };
}
function showContext(ui: Prompts, stage: number): void {
  ui.rich?.context({ title: 'New project', location: ['Project starter', 'Prototype brief', 'Output and review'][stage]!,
    details: ['Starter → prototype → review', 'Nothing is written until the complete plan is approved.', 'Escape: previous step. Ctrl+C: cancel.'] });
}
function describe(selection: ProjectSelection): string {
  return `${selection.targets.join(' + ')}; ${selection.framework === 'none' ? 'no frontend framework' : (frameworkAdapter(selection.framework, pluginFrameworkAdapters())?.label ?? selection.framework).split(' — ')[0]}`;
}
async function chooseStarter(ui: Prompts, starters: Starter[], state: WizardState): Promise<void> {
  const chosen = await choose(ui, 'Which project starter do you want to run?', starters.map(item => ({ id: item.id, label: `${item.name} — ${item.summary} (${describe(item.selection)})` })), state.starterId);
  if (chosen !== state.starterId) state.answers = {};
  state.starterId = chosen; state.stage = 1;
}
async function reviewBrief(ui: Prompts, guide: Guide, state: WizardState): Promise<void> {
  state.answers = await interview(ui, guide, { ...state.answers, approved: false });
  const result = guideInput(guide, { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers: state.answers });
  requireSketch(!result.pending.length, 'PROTOTYPE_AGREEMENT', result.pending.join(' '));
  state.answers = result.answers; state.stage = 2;
}
async function writeReview(ui: Prompts, options: ProjectWizardOptions, state: WizardState, selection: ProjectSelection, guide: Guide): Promise<{ completion?: string }> {
  state.out = await input(ui, 'Project package output folder', state.out);
  ui.rich?.busy('Preparing target-specific source and prototype handoff. No files written yet.');
  const plan = await projectPlan({ ...options, out: state.out, input: { schemaVersion: 2, starter: selection.starter.id,
    interview: { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers: state.answers } } });
  if (!await review(ui, plan, options.signal)) { ui.write('No project files written.\n'); return {}; }
  const completion = `Start with ${state.out}/execution-prompt.md. Starter: ${selection.starter.id}; targets: ${selection.targets.join(', ')}; framework: ${selection.framework}. Source: ${state.out}/source/.\n`;
  ui.write(completion);
  ui.write(`The design folder belongs to the new project in ${state.out}/source/, next to its design/project.json.\n`);
  const design = await offerDesignFolder(ui, { root: join(options.root, state.out, 'source'), frameworkRoot: options.frameworkRoot,
    title: String(state.answers.title), briefFrom: join(options.root, state.out, 'design-brief.md'), signal: options.signal });
  return { completion: completion + (design ?? '') };
}
async function advance(ui: Prompts, starters: Starter[], options: ProjectWizardOptions, state: WizardState): Promise<false | { completion?: string }> {
  if (state.stage === 0) { await chooseStarter(ui, starters, state); return false; }
  const { selection } = starters.find(item => item.id === state.starterId)!;
  if (selection.framework === 'none' && state.stage === 1) ui.write('CLI starter: no frontend framework. Describe command journeys in the prototype brief.\n');
  const guide = await projectGuide(selection);
  if (state.stage === 1) { await reviewBrief(ui, guide, state); return false; }
  return writeReview(ui, options, state, selection, guide);
}
function recoverStep(ui: Prompts, state: WizardState, error: unknown): void {
  if (!(error instanceof Back)) { reportError(ui, error); return; }
  if (state.stage === 0) throw error;
  state.stage -= 1; state.answers = { ...state.answers, approved: false };
}
/** Revisit the starter without carrying approval or stale answers into a different project. */
export async function projectWizard(ui: Prompts, options: ProjectWizardOptions): Promise<string | undefined> {
  requireSketch(!options.signal?.aborted, 'CANCELLED', 'Project creation cancelled.');
  const starters = await projectStarters(options.frameworkRoot), state = initialState(starters, options);
  while (true) {
    requireSketch(!options.signal?.aborted, 'CANCELLED', 'Project creation cancelled.');
    showContext(ui, state.stage);
    try {
      const result = await advance(ui, starters, options, state);
      if (result) return result.completion;
    } catch (error) { recoverStep(ui, state, error); }
  }
}
