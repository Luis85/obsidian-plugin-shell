import { loadTestWorkflows, type TestWorkflowEntry } from '../../adapters/test-workflow-catalog.ts';
import { testWorkflowSavePlan } from '../../adapters/test-workflow-command.ts';
import { requireSketch, slug } from '#shared/contracts/sketch-errors.ts';
import { getPath, type FormValues } from '../../domain/form-model.ts';
import type { TestWorkflowStep } from '../../domain/test-workflow.ts';
import type { TestWorkflowData } from '../../domain/test-workflow-data.ts';
import { describeTestWorkflowStep } from '../../domain/test-workflow-docs.ts';
import { editCollection } from '../process-editor.ts';
import { formDefinition, runForm } from '../form-runner.ts';
import { choose, reportError, type Prompts } from '#tui/prompts.ts';
import { review } from '../review.ts';
import { SketchError } from '#shared/contracts/sketch-errors.ts';
import { testWorkflowDataFromView, testWorkflowDataView, testWorkflowStepFromView, testWorkflowStepView } from '../test-workflow-editor.ts';
import type { ActionContext } from '../wizard-runner.ts';
import type { WizardModule } from './module.ts';
/** The draft being authored: a partial definition until workflow.save validates it. */
type Draft = FormValues & { steps: TestWorkflowStep[]; data?: TestWorkflowData };
interface Item { id: string; step: TestWorkflowStep }
const draftOf = (state: FormValues): Draft => {
  const draft = state.workflow as Draft;
  requireSketch(Array.isArray(draft?.steps), 'WORKFLOW_DRAFT', 'Load a workflow before editing it.');
  return draft;
};
async function pick(ui: Prompts, entries: TestWorkflowEntry[], name: unknown): Promise<TestWorkflowEntry> {
  const id = typeof name === 'string' && name ? name : await choose(ui, 'Which workflow do you want to edit?', entries.map(entry => ({ id: entry.id, label: entry.definition ? `${entry.definition.title} (${entry.id})` : `${entry.id} (invalid)` })));
  const entry = entries.find(item => item.id === id);
  requireSketch(entry, 'WORKFLOW_UNKNOWN', `Unknown workflow ${id}; use workflow list.`);
  requireSketch(entry.definition, 'WORKFLOW_INVALID', `Workflow ${id} is not valid; fix configs/tests/workflows/${entry.file} first.\n${entry.issues.map(item => item.message).join('\n')}`);
  return entry;
}
const blank = (): Draft => ({ schemaVersion: 1, status: 'draft', target: { kind: 'static', folder: '' }, viewport: { width: 1280, height: 800 }, timeoutMs: 5000, steps: [] });
/** Only the keys of the chosen target kind survive, so switching kinds in the form never leaves stale fields. */
function targetOf(draft: Draft): FormValues {
  const kind = getPath(draft, 'target.kind'), field = kind === 'url' ? 'url' : kind === 'prototype' ? 'package' : 'folder';
  return { kind, [field]: getPath(draft, `target.${field}`) };
}
function identified(state: FormValues): FormValues {
  const draft = draftOf(state), existing = Array.isArray(state.existing) ? state.existing.map(String) : [];
  const rest: FormValues = { ...draft, target: targetOf(draft) };
  if (!draft.data) delete rest.data;
  return { ...rest, id: typeof draft.id === 'string' ? draft.id : slug(String(draft.title ?? ''), 'workflow', existing) };
}
const stepSpec = { title: 'Steps (the first step must visit a page)', noun: 'step', form: 'workflow-step',
  describe: (item: Item) => describeTestWorkflowStep(item.step), view: (item?: Item) => testWorkflowStepView(item?.step),
  commit: (view: FormValues, previous: Item | undefined, used: string[]): Item => ({ id: previous?.id ?? slug('step', 'step', used), step: testWorkflowStepFromView(view, previous?.step) }) };
/** The data form re-asks until every line parses; Back leaves the step unchanged. */
async function editData(context: ActionContext): Promise<void> {
  const draft = draftOf(context.state), view = testWorkflowDataView(draft.data);
  while (true) {
    await runForm(context.ui, formDefinition(context.env, 'workflow-data'), view, context.env);
    try { const data = testWorkflowDataFromView(view, draft.data); if (data) draft.data = data; else delete draft.data; return; }
    catch (error) { if (!(error instanceof SketchError)) throw error; reportError(context.ui, error); }
  }
}
/** Actions behind configs/wizards/workflow-authoring.json and the workflow-* forms. */
export const testWorkflowModule: WizardModule = {
  actions: {
    'workflow.load': async ({ ui, state, options }) => {
      const entries = await loadTestWorkflows(options.root);
      state.existing = entries.map(entry => entry.id);
      state.workflow = state.mode === 'edit' ? structuredClone((await pick(ui, entries, state.name)).definition) : blank();
    },
    'workflow.edit-data': editData,
    /** The step builder: add, edit and remove steps through the workflow-step form until Done. */
    'workflow.edit-steps': async context => {
      const draft = draftOf(context.state), items = draft.steps.map((step, index): Item => ({ id: `step-${index + 1}`, step }));
      draft.steps = (await editCollection(context, items, stepSpec)).map(item => item.step);
    },
    /** Validation failures are reported and the wizard returns to the steps (retry); declining the review writes nothing. */
    'workflow.save': async ({ ui, state, options }) => {
      const plan = await testWorkflowSavePlan(options.root, identified(state));
      if (!await review(ui, plan, options.signal)) return { end: true };
      state.saved = plan.data;
    },
  },
};
