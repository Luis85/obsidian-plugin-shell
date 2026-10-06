/** Pure translation of one workflow job (plus a matrix combination) into the ordered local steps a dry run prints. */
import { evaluateCondition, substitute, type Lookup } from './ci-expression.ts';
import { chooseCombination, expandMatrix, type Combination, type MatrixChoice, type Selector } from './ci-matrix.ts';
import { jobRefusals, runnerOs, type RunnerOs } from './ci-safety.ts';
import type { CiJob, CiStep, CiWorkflow, StepKind } from './ci-workflow.ts';
export type Disposition = 'run' | 'skip-condition' | 'condition-unknown' | 'setup' | 'external';
export interface ConditionReport { expression: string; result: 'true' | 'false' | 'unknown' }
export interface PlannedStep {
  index: number; workflowStep: number; id: string; name: string; kind: StepKind; disposition: Disposition; uses?: string; shell?: string; shellExplicit?: boolean;
  /** Set for a step expanded from a local composite action: the action and the step's position inside it. */
  action?: { uses: string; step: number };
  command?: string; workingDirectory?: string; env: Record<string, string>; unresolved: string[]; condition?: ConditionReport; note?: string;
}
export interface JobPlan {
  workflow: string; file: string; job: string; name: string; runsOn: string; runnerOs: RunnerOs | null; localOs: RunnerOs;
  matrix: MatrixChoice; steps: PlannedStep[]; unresolved: string[]; refusals: string[]; needs: string[]; jobCondition?: ConditionReport;
}
export interface PlanOptions { localOs: RunnerOs; selector: Selector; environment?: Lookup }
/** Why a step is not run locally (for non-run dispositions and for steps after a failure). */
export function skipReason(step: PlannedStep): string {
  const expression = step.condition?.expression ?? '';
  if (step.disposition === 'condition-unknown') return `condition "${expression}" cannot be settled locally; step not run`;
  if (step.disposition === 'skip-condition') return `condition "${expression}" is false on this machine`;
  return step.note ?? 'not a run step';
}
const externalNote = 'Not reproducible locally: this action is skipped.';
const setupNote = 'Setup action: satisfied by the local checkout and toolchain, nothing to run.';
function unique(values: string[]): string[] { return [...new Set(values)]; }
function stepName(step: CiStep): string {
  if (step.name) return step.name;
  return step.run !== undefined ? (step.run.trim().split('\n')[0] ?? '').slice(0, 80) : step.uses ?? '';
}
function report(expression: string | undefined, value: boolean | undefined): ConditionReport | undefined {
  if (expression === undefined) return undefined;
  return { expression, result: value === undefined ? 'unknown' : value ? 'true' : 'false' };
}
function disposition(step: CiStep, condition: ConditionReport | undefined): Disposition {
  if (step.kind !== 'run') return step.kind;
  if (condition?.result === 'false') return 'skip-condition';
  return condition?.result === 'unknown' ? 'condition-unknown' : 'run';
}
/**
 * Inside a composite action `inputs.<name>` is the effective input, resolved in the caller's context; an input whose
 * value cannot be settled stays unresolved. Only env values and conditions see inputs (the action's env pattern):
 * `${{ inputs.* }}` written into `run:` text is never substituted.
 */
function actionLookup(step: CiStep, lookup: Lookup): Lookup {
  const inputs = step.composite?.inputs;
  if (!inputs) return lookup;
  return path => {
    if (!path.startsWith('inputs.')) return lookup(path);
    const name = path.slice('inputs.'.length);
    if (!Object.hasOwn(inputs, name)) return undefined;
    const value = substitute(inputs[name]!, lookup);
    return value.unresolved.length ? undefined : value.text;
  };
}
function resolveEnv(workflow: CiWorkflow, job: CiJob, step: CiStep, lookup: Lookup, scoped: Lookup): { env: Record<string, string>; unresolved: string[] } {
  const env: Record<string, string> = {}, unresolved: string[] = [];
  const caller = Object.entries({ ...workflow.env, ...job.env, ...step.composite?.callerEnv }).map(([key, value]) => [key, value, lookup] as const);
  for (const [key, value, context] of [...caller, ...Object.entries(step.env).map(([key, value]) => [key, value, scoped] as const)]) {
    const resolved = substitute(value, context);
    env[key] = resolved.text; unresolved.push(...resolved.unresolved);
  }
  return { env, unresolved };
}
/** A composite step runs when the calling step's condition and its own both hold; job run defaults do not apply to it. */
function stepCondition(step: CiStep, lookup: Lookup, scoped: Lookup): ConditionReport | undefined {
  const parts = [[step.composite?.callerCondition, lookup], [step.condition, scoped]] as const;
  const present = parts.filter((part): part is readonly [string, Lookup] => part[0] !== undefined);
  if (!present.length) return undefined;
  const values = present.map(([expression, context]) => evaluateCondition(expression, { lookup: context, success: true }));
  const value = values.includes(false) ? false : values.includes(undefined) ? undefined : true;
  return report(present.length === 1 ? present[0]![0] : present.map(([expression]) => `(${expression})`).join(' && '), value);
}
function planRunDetails(job: CiJob, step: CiStep, lookup: Lookup): Pick<PlannedStep, 'command' | 'workingDirectory' | 'shell' | 'shellExplicit'> & { unresolved: string[] } {
  const defaults: Pick<CiJob, 'shell' | 'workingDirectory'> = step.composite ? {} : job;
  const command = substitute(step.run ?? '', lookup), directory = substitute(step.workingDirectory ?? defaults.workingDirectory ?? '.', lookup);
  const shell = step.shell ?? defaults.shell;
  return { command: command.text, workingDirectory: directory.text, shell: shell ?? 'bash', shellExplicit: shell !== undefined, unresolved: [...command.unresolved, ...directory.unresolved] };
}
function planStep(workflow: CiWorkflow, job: CiJob, step: CiStep, lookup: Lookup): PlannedStep {
  const scoped = actionLookup(step, lookup), condition = stepCondition(step, lookup, scoped);
  const { env, unresolved } = resolveEnv(workflow, job, step, lookup, scoped);
  const planned: PlannedStep = { index: step.index, workflowStep: step.workflowStep, id: step.id ?? `step-${step.index}`, name: stepName(step), kind: step.kind,
    disposition: disposition(step, condition), env, unresolved, ...(step.uses ? { uses: step.uses } : {}), ...(condition ? { condition } : {}),
    ...(step.composite ? { action: { uses: step.composite.uses, step: step.composite.actionStep } } : {}) };
  if (step.kind === 'setup') return { ...planned, note: setupNote };
  if (step.kind === 'external') return { ...planned, note: step.note ?? externalNote };
  const details = planRunDetails(job, step, lookup);
  return { ...planned, ...details, unresolved: unique([...unresolved, ...details.unresolved]) };
}
/** A local run stands for an update (synchronize) of a ready (non-draft) pull request from a non-release branch on the
 * Integration tier; every other event field stays unknown, so the e2e opt-in (`inputs.e2e`, the `e2e` label) is never
 * guessed and an opt-in end-to-end step is reported as condition-unknown. Runtime values from the environment win. */
const localPullRequest: ReadonlyMap<string, string> = new Map([['inputs.tier', 'integration'], ['github.event.pull_request.draft', 'false'], ['github.head_ref', ''], ['github.event.action', 'synchronize']]);
function lookupFor(combination: Combination, os: RunnerOs, environment: Lookup | undefined): Lookup {
  return path => {
    if (path.startsWith('matrix.')) return combination[path.slice(7)];
    if (path === 'runner.os') return os;
    return environment?.(path) ?? localPullRequest.get(path);
  };
}
/** Re-resolves one step with extra runtime context (earlier step outputs, runner temp). */
export function replanStep(workflow: CiWorkflow, job: CiJob, plan: JobPlan, step: CiStep, environment: Lookup): PlannedStep {
  return planStep(workflow, job, step, lookupFor(plan.matrix.combination, plan.localOs, environment));
}
const prefersLocal = (job: CiJob, localOs: RunnerOs) => (combo: Combination): boolean =>
  runnerOs(substitute(job.runsOn, path => path.startsWith('matrix.') ? combo[path.slice(7)] : undefined).text) === localOs;
/** Plans one job. Throws CiError for matrix selections that are missing, unknown or ambiguous. */
export function planJob(workflow: CiWorkflow, job: CiJob, options: PlanOptions): JobPlan {
  const all = expandMatrix(job.matrix, options.selector);
  const matrix = chooseCombination(all, options.selector, job.matrix, prefersLocal(job, options.localOs));
  const lookup = lookupFor(matrix.combination, options.localOs, options.environment);
  const runsOn = substitute(job.runsOn, lookup).text;
  const steps = job.steps.map(step => planStep(workflow, job, step, lookup));
  const jobCondition = report(job.condition, job.condition === undefined ? undefined : evaluateCondition(job.condition, { lookup, success: true }));
  return { workflow: workflow.stem, file: workflow.file, job: job.id, name: job.name ? substitute(job.name, lookup).text : job.id, runsOn, runnerOs: runnerOs(runsOn),
    localOs: options.localOs, matrix, steps, unresolved: unique(steps.filter(step => step.disposition === 'run').flatMap(step => step.unresolved)), refusals: jobRefusals(workflow, job), needs: job.needs,
    ...(jobCondition ? { jobCondition } : {}) };
}
/** Everything that stops `--execute` before any step runs; an empty list means the plan may run. */
export function executionBlockers(plan: JobPlan, deferred: (expression: string) => boolean): string[] {
  const blockers = plan.refusals.map(reason => `refused: ${reason}`);
  if (plan.runnerOs !== plan.localOs) blockers.push(`the job targets ${plan.runsOn || 'an unknown runner'} but this machine is ${plan.localOs}; choose a matching --matrix combination`);
  const open = plan.steps.filter(step => step.disposition === 'run').flatMap(step => step.unresolved).filter(expression => !deferred(expression));
  if (open.length) blockers.push(`unresolved expressions cannot be settled locally: ${unique(open).join('; ')}`);
  return blockers;
}
