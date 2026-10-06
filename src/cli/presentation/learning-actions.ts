import { parseConfirmation } from '../../../scripts/shared/confirmation.ts';
import type { LearningCatalog } from '../adapters/learning-catalog.ts';
import type { DefinitionCatalog } from '../adapters/wizard-catalog.ts';
import { requireSketch } from '../domain/errors.ts';
import { setPath, type FormCondition } from '../domain/form-model.ts';
import { learningAnswersAt, learningStepForm, learningWizardId } from '../domain/learning-conditions.ts';
import type { LearningAction, LearningPath, LearningStep } from '../domain/learning-path.ts';
import type { LearningProgress } from '../domain/learning-progress.ts';
import type { WizardDefinition, WizardStep } from '../domain/wizard.ts';
import { formDefinition, runForm, type FormEnvironment } from './form-runner.ts';
import { input, selectMany, type Prompts } from './prompts.ts';
import { runWizard, type WizardAction, type WizardOptions, type WizardRegistry } from './wizard-runner.ts';
import { wizardCatalog, wizardRegistry } from './wizards/registry.ts';
/** The state one interactive learning run edits. Nothing here is written until the learner reviews a save plan. */
export interface LearningSession {
  ui: Prompts; options: WizardOptions; path: LearningPath; catalog: LearningCatalog; definitions: DefinitionCatalog;
  progress: LearningProgress; beforeHash: string | null; dirty: boolean; index: number; now: () => string;
  /** The configs/ folder the definitions came from; undefined means the shipped one next to bin/app. */
  configsRoot?: string;
}
const environment = (session: LearningSession): FormEnvironment => ({ catalog: session.definitions, hooks: wizardRegistry.hooks, data: session.progress.answers });
/** Ask a form against the shared answers at `bind`; the committed value replaces that answer. */
async function askForm(session: LearningSession, form: string | undefined, step: LearningStep | undefined, bind: string): Promise<void> {
  const env = environment(session), definition = step ? learningStepForm(step, id => session.definitions.forms.get(id)) : formDefinition(env, form!);
  requireSketch(definition, 'FORM_UNKNOWN', `Unknown form ${form ?? step?.form}.`);
  const result = await runForm(session.ui, definition, learningAnswersAt(session.progress, bind), env);
  setPath(session.progress.answers, bind, result);
  session.dirty = true;
}
export const askStepForm = (session: LearningSession, step: LearningStep) => askForm(session, undefined, step, step.bind!);
async function done(ui: Prompts, label: string, ticked: boolean): Promise<boolean> {
  while (true) {
    const decision = parseConfirmation(await input(ui, `Done: ${label}? (y/n)`, ticked ? 'y' : 'n'));
    if (decision !== null) return decision;
    ui.write('Enter yes or no.\n');
  }
}
async function tickPlain(ui: Prompts, step: LearningStep, ticked: readonly string[]): Promise<string[]> {
  const result: string[] = [];
  for (const item of step.checklist!) if (await done(ui, item.required ? item.label : `${item.label} (optional)`, ticked.includes(item.id))) result.push(item.id);
  return result;
}
/** Plain prompts ask one yes/no per item; the terminal UI offers one multi-select. */
export async function tickChecklist(session: LearningSession, step: LearningStep): Promise<void> {
  const ticked = session.progress.checklists[step.id] ?? [];
  const items = step.checklist!.map(item => ({ id: item.id, label: item.required ? item.label : `${item.label} (optional)` }));
  session.progress.checklists[step.id] = session.ui.rich ? await selectMany(session.ui, 'Tick what you have done', items, ticked) : await tickPlain(session.ui, step, ticked);
  session.dirty = true;
}
/** Marker steps before every end step and at the end: reaching one means the wizard finished rather than being declined or left. */
function instrumented(wizard: WizardDefinition): WizardDefinition {
  const marker = (index: number, when?: FormCondition): WizardStep => ({ id: `learning-reached-end-${index}`, kind: 'action', action: 'learning.reached-end', ...(when ? { when } : {}) });
  const steps = wizard.steps.flatMap((step, index) => step.kind === 'end' ? [marker(index, step.when), step] : [step]);
  return { ...wizard, steps: [...steps, marker(wizard.steps.length)] };
}
/** Runs a registered wizard exactly as `node bin/app wizard --name <id>` would and reports whether it reached its end. */
export async function runLearningWizard(ui: Prompts, definitions: DefinitionCatalog, id: string, options: WizardOptions): Promise<boolean> {
  const wizard = definitions.wizards.get(id);
  requireSketch(wizard, 'WIZARD_UNKNOWN', `Unknown wizard ${id}.`);
  let reached = false;
  const marker: WizardAction = () => { reached = true; };
  const actions: Record<string, WizardAction> = Object.assign(Object.create(null), wizardRegistry.actions, { 'learning.reached-end': marker });
  const registry: WizardRegistry = { actions, hooks: wizardRegistry.hooks };
  await runWizard(ui, { ...definitions, wizards: new Map([...definitions.wizards, [id, instrumented(wizard)]]) }, registry, id, options);
  return reached;
}
async function showCommand(ui: Prompts, action: LearningAction): Promise<void> {
  const body = `Run this yourself in another terminal:\n\n  ${action.command}\n\nLearning paths show commands; they never run them for you.`;
  if (ui.rich) await ui.rich.review(action.label, [{ title: 'Command', body }]);
  else ui.write(`\n${action.label}\n${body}\n`);
}
/** Named, safe actions only: run a registered wizard, open a registered form, or display a command line. */
export async function runLearningAction(session: LearningSession, action: LearningAction): Promise<void> {
  if (action.kind === 'command') return showCommand(session.ui, action);
  if (action.kind === 'form') return askForm(session, action.form, undefined, action.bind!);
  // Reloaded so a wizard the learner just authored is found; a broken definition fails closed before any question.
  const id = learningWizardId(action.wizard!, session.progress);
  session.definitions = await wizardCatalog(session.configsRoot);
  if (!await runLearningWizard(session.ui, session.definitions, id, session.options)) { session.ui.write(`Wizard ${id} did not reach its end; run it again to count it.\n`); return; }
  session.progress.wizards[id] = session.now();
  session.dirty = true;
  session.ui.write(`Wizard ${id} completed.\n`);
}
