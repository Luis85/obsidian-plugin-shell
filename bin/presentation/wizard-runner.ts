import { getPath, matches, renderText, setPath, type FormValues } from '../domain/form-model.ts';
import { requireSketch } from '../domain/errors.ts';
import type { Guide } from '../domain/guide.ts';
import type { WizardDefinition, WizardStep } from '../domain/wizard.ts';
import { guideInput } from '../adapters/prototype.ts';
import type { DefinitionCatalog } from '../adapters/wizard-catalog.ts';
import { formDefinition, runFields, runForm, type FormEnvironment, type FormHooks } from './form-runner.ts';
import { interview } from './guide.ts';
import { Back, reportError, type Prompts } from './prompts.ts';
export interface WizardOptions { root: string; frameworkRoot: string; signal?: AbortSignal; [option: string]: unknown }
export type ActionOutcome = void | { end: true; completion?: string };
export interface ActionContext {
  ui: Prompts; state: FormValues; options: WizardOptions; step: WizardStep; env: FormEnvironment;
  /** Run another registered wizard (for example first-run after a setup) with its own state. */
  run(id: string, state?: FormValues): Promise<string | undefined>;
}
export type WizardAction = (context: ActionContext) => Promise<ActionOutcome> | ActionOutcome;
export interface WizardRegistry { actions: Record<string, WizardAction>; hooks: FormHooks }
interface Session { ui: Prompts; catalog: DefinitionCatalog; registry: WizardRegistry; options: WizardOptions }
const templateData = (state: FormValues, options: WizardOptions) => ({ ...state, options });
function environment(session: Session, state: FormValues): FormEnvironment {
  return { catalog: session.catalog, hooks: session.registry.hooks, data: templateData(state, session.options) };
}
const interactive = (step: WizardStep) => step.kind === 'form' || step.kind === 'guide' || (step.kind === 'action' && step.interactive === true);
function showContext(session: Session, wizard: WizardDefinition, step: WizardStep, state: FormValues): void {
  if (!wizard.context || !session.ui.rich || !step.title) return;
  const data = templateData(state, session.options);
  session.ui.rich.context({ title: renderText(wizard.context.title, data), location: step.title,
    details: [...(step.details ?? []), ...wizard.context.details].map(item => renderText(item, data)) });
}
async function formStep(session: Session, step: WizardStep, state: FormValues): Promise<void> {
  const env = environment(session, state);
  const existing = step.bind ? getPath(state, step.bind) : state;
  const seed = existing ?? (step.initial ? getPath(state, step.initial) : undefined);
  const value = step.bind ? structuredClone((seed ?? {}) as FormValues) : state;
  const result = step.form ? await runForm(session.ui, formDefinition(env, step.form), value, env) : (await runFields(session.ui, step.fields!, value, env), value);
  if (step.bind) setPath(state, step.bind, result);
}
async function guideStep(session: Session, step: WizardStep, state: FormValues): Promise<void> {
  const guide = getPath(state, step.guide!) as Guide | undefined;
  requireSketch(guide && Array.isArray(guide.steps), 'WIZARD_GUIDE', `${step.id} needs a loaded guide at ${step.guide}.`);
  const initial = { ...(step.initial ? getPath(state, step.initial) as FormValues | undefined : undefined), ...(step.agreement ? { approved: false } : {}) };
  let answers: FormValues = await interview(session.ui, guide, initial);
  if (step.agreement) {
    const result = guideInput(guide, { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers });
    requireSketch(!result.pending.length, 'PROTOTYPE_AGREEMENT', result.pending.join(' '));
    answers = result.answers;
  }
  setPath(state, step.bind ?? step.id, answers);
}
async function runStep(session: Session, step: WizardStep, state: FormValues): Promise<ActionOutcome> {
  const data = templateData(state, session.options);
  if (step.kind === 'form') return formStep(session, step, state);
  if (step.kind === 'guide') return guideStep(session, step, state);
  if (step.kind === 'message') { session.ui.write(renderText(step.text!, data) + '\n'); return; }
  if (step.kind === 'end') {
    if (!step.text) return { end: true };
    const completion = renderText(step.text, data) + '\n';
    session.ui.write(completion); return { end: true, completion };
  }
  const action = session.registry.actions[step.action!];
  requireSketch(action, 'WIZARD_ACTION', `Unknown wizard action ${step.action}.`);
  return action({ ui: session.ui, state, options: session.options, step, env: environment(session, state),
    run: (id, nested = Object.create(null)) => runWizardById(session, id, nested) });
}
const cancelled = (error: unknown) => error instanceof Error && 'code' in error && error.code === 'CANCELLED';
/** Steps run in order; Back returns to the previous interactive step, and a barrier step forgets everything before it. */
async function walk(session: Session, wizard: WizardDefinition, state: FormValues): Promise<string | undefined> {
  const history: number[] = [];
  let index = 0, revisit = false;
  while (index < wizard.steps.length) {
    requireSketch(!session.options.signal?.aborted, 'CANCELLED', `${wizard.title} cancelled.`);
    const step = wizard.steps[index]!;
    if (!revisit && !matches(step.when, step.when?.path ? getPath(state, step.when.path) : undefined)) { index++; continue; }
    revisit = false;
    if (step.barrier) history.length = 0;
    showContext(session, wizard, step, state);
    try {
      const outcome = await runStep(session, step, state);
      if (outcome?.end) return outcome.completion;
      if (interactive(step)) history.push(index);
      index++;
    } catch (error) {
      // A retried or revisited step may already be recorded; Back always targets an earlier step.
      while (history.length && history.at(-1)! >= index) history.pop();
      if (error instanceof Back && history.length) { index = history.pop()!; revisit = true; continue; }
      if (error instanceof Back || !step.retry || cancelled(error)) throw error;
      reportError(session.ui, error);
      index = step.retry === true ? index : wizard.steps.findIndex(item => item.id === step.retry); revisit = true;
    }
  }
  return undefined;
}
async function runDefinition(session: Session, wizard: WizardDefinition, state: FormValues): Promise<string | undefined> {
  try { return await walk(session, wizard, state); }
  catch (error) {
    if (error instanceof Back && wizard.cancelMessage) { session.ui.write(wizard.cancelMessage + '\n'); return undefined; }
    if (error instanceof Back || !wizard.reportErrors || cancelled(error)) throw error;
    reportError(session.ui, error); return undefined;
  }
}
async function runWizardById(session: Session, id: string, state: FormValues): Promise<string | undefined> {
  const wizard = session.catalog.wizards.get(id);
  requireSketch(wizard, 'WIZARD_UNKNOWN', `Unknown wizard ${id}.`);
  return runDefinition(session, wizard, state);
}
/** Run one wizard definition against code-registered actions/hooks. State is edited in place and may be pre-seeded. */
export function runWizard(ui: Prompts, catalog: DefinitionCatalog, registry: WizardRegistry, id: string, options: WizardOptions, state: FormValues = Object.create(null)): Promise<string | undefined> {
  return runWizardById({ ui, catalog, registry, options }, id, state);
}
