import { healthyDefinition, loadProcesses, processCatalogContext, type ProcessEntry } from '../../adapters/process-catalog.ts';
import { processSavePlan } from '../../adapters/process-command.ts';
import { requireSketch, slug } from '#shared/contracts/sketch-errors.ts';
import type { FormChoice } from '../../domain/form.ts';
import { getPath, type FormValues } from '../../domain/form-model.ts';
import type { ProcessDefinition, ProcessRole, ProcessRule, ProcessStep } from '../../domain/process.ts';
import { editCollection, roleFromView, roleView, ruleFromView, ruleView, stepFromView, stepView } from '../process-editor.ts';
import { walkProcess } from '../process-run.ts';
import { choose, type Prompts } from '#tui/prompts.ts';
import { review } from '../review.ts';
import type { WizardModule } from './module.ts';
/** The draft being authored: a partial definition until process.save validates it. */
type Draft = FormValues & { roles: ProcessRole[]; steps: ProcessStep[]; rules: ProcessRule[] };
const draftOf = (state: FormValues): Draft => {
  const draft = state.process as Draft;
  requireSketch(Array.isArray(draft?.roles) && Array.isArray(draft.steps) && Array.isArray(draft.rules), 'PROCESS_DRAFT', 'Load a process before editing it.');
  return draft;
};
const choicesAt = (data: unknown, path: string): FormChoice[] => {
  const items = getPath(data, path);
  return Array.isArray(items) ? items.map(item => ({ id: String(getPath(item, 'id')), label: `${String(getPath(item, 'title'))} (${String(getPath(item, 'id'))})` })) : [];
};
async function pick(ui: Prompts, entries: ProcessEntry[], name: unknown, question: string): Promise<ProcessEntry> {
  const id = typeof name === 'string' && name ? name : await choose(ui, question, entries.map(entry => ({ id: entry.id, label: entry.definition ? `${entry.definition.title} (${entry.id})` : `${entry.id} (invalid)` })));
  const entry = entries.find(item => item.id === id);
  requireSketch(entry, 'PROCESS_UNKNOWN', `Unknown process ${id}; use process list.`);
  return entry;
}
const blank = (): Draft => ({ schemaVersion: 1, version: 1, status: 'draft', roles: [], steps: [], rules: [] });
/** Version bumps on every reviewed edit, so a saved run trail always names the definition it followed. */
function editable(entry: ProcessEntry): Draft {
  requireSketch(entry.definition, 'PROCESS_INVALID', `Process ${entry.id} is not valid JSON for the process format; fix it in configs/processes/${entry.file} first.\n${entry.issues.map(item => item.message).join('\n')}`);
  const definition: ProcessDefinition = structuredClone(entry.definition);
  return { ...definition, version: definition.version + 1 };
}
function identified(state: FormValues): ProcessDefinition | FormValues {
  const draft = draftOf(state), existing = Array.isArray(state.existing) ? state.existing.map(String) : [];
  const docText = typeof getPath(draft, 'doc.text') === 'string' ? String(getPath(draft, 'doc.text')).trim() : '';
  const file = getPath(draft, 'doc.file');
  const doc = { ...typeof file === 'string' ? { file } : {}, ...docText ? { text: docText } : {} };
  const rest: FormValues = { ...draft };
  delete rest.doc;
  return { ...rest, id: typeof draft.id === 'string' ? draft.id : slug(String(draft.title ?? ''), 'process', existing), ...Object.keys(doc).length ? { doc } : {} };
}
const roleSpec = { title: 'Roles', noun: 'role', form: 'process-role', describe: (role: ProcessRole) => `${role.title} (${role.id})`, view: roleView, commit: roleFromView };
const stepSpec = { title: 'Steps (the first step starts the process)', noun: 'step', form: 'process-step', describe: (step: ProcessStep) => `${step.title} (${step.id})${step.terminal ? ' — ends' : ''}`, view: stepView, commit: stepFromView };
const ruleSpec = { title: 'Business rules', noun: 'rule', form: 'process-rule', describe: (rule: ProcessRule) => `${rule.severity} ${rule.id}`, view: ruleView, commit: ruleFromView };
/** Actions and choice providers behind configs/wizards/process-authoring.json, process-run.json and the process-* forms. */
export const processModule: WizardModule = {
  hooks: {
    choices: {
      'process.role-choices': data => choicesAt(data, 'process.roles'),
      'process.step-choices': data => choicesAt(data, 'process.steps'),
      'process.form-choices': data => choicesAt(data, 'formChoices'),
    },
  },
  actions: {
    'process.load': async ({ ui, state, options }) => {
      const context = await processCatalogContext(options.root), entries = await loadProcesses(options.root, context);
      state.existing = entries.map(entry => entry.id);
      state.formChoices = [...context.forms.values()].map(form => ({ id: form.id, title: form.title }));
      state.process = state.mode === 'edit' ? editable(await pick(ui, entries, state.name, 'Which process do you want to edit?')) : blank();
    },
    'process.edit-roles': async context => { draftOf(context.state).roles = await editCollection(context, draftOf(context.state).roles, roleSpec); },
    'process.edit-steps': async context => { draftOf(context.state).steps = await editCollection(context, draftOf(context.state).steps, stepSpec); },
    'process.edit-rules': async context => { draftOf(context.state).rules = await editCollection(context, draftOf(context.state).rules, ruleSpec); },
    /** Validation failures are reported and the wizard returns to the steps (retry); declining the review writes nothing. */
    'process.save': async ({ ui, state, options }) => {
      const plan = await processSavePlan(identified(state), await processCatalogContext(options.root));
      if (!await review(ui, plan, options.signal)) return { end: true };
      state.saved = plan.data;
    },
    'process.select': async ({ ui, state, options }) => {
      const context = await processCatalogContext(options.root);
      state.definition = healthyDefinition(await pick(ui, await loadProcesses(options.root, context), state.name, 'Which process do you want to run?'));
    },
    'process.walk': async context => {
      const definition = context.state.definition as ProcessDefinition;
      context.state.summary = { ...await walkProcess(context, definition), recordedAt: new Date().toISOString() };
    },
  },
};
