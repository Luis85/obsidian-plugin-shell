/**
 * Pure model of local composite actions (`uses: ./.github/actions/<name>`) and their expansion into the calling job.
 * Each nested step keeps its own classification rules; inputs are recorded, never substituted into `run:` text here.
 * An action that is missing, invalid or not composite leaves the calling step external with the reason as its note.
 */
import { CiError, optionalText, parseStep, record, type CiJob, type CiStep, type CiWorkflow } from './ci-workflow.ts';
export const actionDirectory = '.github/actions';
const localUses = /^\.\/\.github\/actions\/([\w.-]+)\/?$/;
/** The action folder name a step references, or undefined for anything that is not a local action folder. */
export function localActionName(uses: string | undefined): string | undefined {
  const name = uses === undefined ? undefined : localUses.exec(uses)?.[1];
  return name === undefined || /^\.+$/.test(name) ? undefined : name;
}
export interface CompositeAction { file: string; defaults: Readonly<Record<string, string>>; steps: CiStep[] }
/** A loaded action is either composite or the reason it cannot be expanded. */
export type LocalAction = CompositeAction | { file: string; unsupported: string };
function inputDefaults(value: unknown, where: string): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const [name, raw] of Object.entries(record(value, where))) {
    if (!/^[\w-]+$/.test(name)) throw new CiError('CI_ACTION_INVALID', `${where}: input name "${name}" is not supported.`);
    defaults[name] = optionalText(record(raw ?? {}, `${where}.${name}`).default, `${where}.${name}.default`) ?? '';
  }
  return defaults;
}
/** Validates an already-parsed action.yml; composite `run` steps must name their shell, as GitHub requires. */
export function normalizeAction(file: string, data: unknown): LocalAction {
  const root = record(data, file), runs = record(root.runs, `${file}: runs`), using = optionalText(runs.using, `${file}: runs.using`);
  if (using !== 'composite') return { file, unsupported: `${file} runs "${using ?? 'unknown'}", not a composite action` };
  if (!Array.isArray(runs.steps) || runs.steps.length === 0) throw new CiError('CI_ACTION_INVALID', `${file}: runs.steps must be a non-empty list.`);
  const steps = runs.steps.map((raw, index) => parseStep(raw, index + 1, `${file}: runs.steps[${index + 1}]`));
  const shellless = steps.find(step => step.run !== undefined && step.shell === undefined);
  if (shellless) throw new CiError('CI_ACTION_INVALID', `${file}: runs.steps[${shellless.index}] runs a command without the required shell.`);
  return { file, defaults: inputDefaults(root.inputs, `${file}: inputs`), steps };
}
/** Inside an action, `steps.<id>` names that action's own steps; the prefix keeps them apart from the caller's. */
function scopeReferences(text: string, prefix: string, whole: boolean): string {
  const rewrite = (expression: string) => expression.replace(/\bsteps\.([\w-]+)\./g, (_match, id: string) => `steps.${prefix}${id}.`);
  return whole ? rewrite(text) : text.replace(/\$\{\{[\s\S]*?\}\}/g, rewrite);
}
function scopedStep(step: CiStep, prefix: string): CiStep {
  const map = (values: Readonly<Record<string, string>>) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, scopeReferences(value, prefix, false)]));
  const scoped: CiStep = { ...step, env: map(step.env), inputs: map(step.inputs) };
  if (step.id !== undefined) scoped.id = prefix + step.id;
  if (step.run !== undefined) scoped.run = scopeReferences(step.run, prefix, false);
  if (step.workingDirectory !== undefined) scoped.workingDirectory = scopeReferences(step.workingDirectory, prefix, false);
  if (step.condition !== undefined) scoped.condition = scopeReferences(step.condition, prefix, true);
  return scoped;
}
function expansion(caller: CiStep, action: LocalAction): CiStep[] | string {
  if ('unsupported' in action) return action.unsupported;
  const undeclared = Object.keys(caller.inputs).filter(name => !Object.hasOwn(action.defaults, name));
  if (undeclared.length) return `${action.file} declares no input ${undeclared.join(', ')}`;
  const inputs = { ...action.defaults, ...caller.inputs }, prefix = `${caller.id ?? `step-${caller.workflowStep}`}--`;
  return action.steps.map(step => ({ ...scopedStep(step, prefix), workflowStep: caller.workflowStep,
    composite: { uses: caller.uses ?? '', actionStep: step.index, inputs, callerEnv: caller.env, ...(caller.condition !== undefined ? { callerCondition: caller.condition } : {}) } }));
}
function expandJob(job: CiJob, actions: ReadonlyMap<string, LocalAction>): CiJob {
  const steps: CiStep[] = [];
  for (const step of job.steps) {
    const name = localActionName(step.uses), action = name === undefined ? undefined : actions.get(name);
    const expanded = name === undefined ? [step] : action === undefined ? `${actionDirectory}/${name} has no action.yml` : expansion(step, action);
    const list = typeof expanded === 'string' ? [{ ...step, note: `Not reproducible locally: ${expanded}; this action is skipped.` }] : expanded;
    for (const item of list) steps.push({ ...item, index: steps.length + 1 });
  }
  return { ...job, steps };
}
/** Replaces each step that calls a loaded local composite action by that action's steps, renumbered in job order. */
export function expandLocalActions(workflow: CiWorkflow, actions: ReadonlyMap<string, LocalAction>): CiWorkflow {
  return { ...workflow, jobs: workflow.jobs.map(job => expandJob(job, actions)) };
}
/** Every local action folder a workflow references, in first-use order. */
export function referencedActions(workflow: CiWorkflow): string[] {
  const names = workflow.jobs.flatMap(job => job.steps.map(step => localActionName(step.uses)));
  return [...new Set(names.filter((name): name is string => name !== undefined))];
}
