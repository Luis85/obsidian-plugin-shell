/**
 * `ci`: reproduce GitHub Actions jobs locally. `--list` describes workflows and jobs; `--job` prints the exact ordered
 * shell commands (dry run) or, with `--execute`, runs the job's `run:` steps and reports like `check`.
 * Local composite actions are expanded into their steps. Jobs with secrets, publication or deployment are never executed;
 * external actions are skipped with a note.
 */
import { execFile } from 'node:child_process';
import { summarizeWorkflow } from '../../domain/ci-listing.ts';
import { describeCombination, parseMatrixSelector, type Selector } from '../../domain/ci-matrix.ts';
import { executionBlockers, planJob, skipReason, type JobPlan, type PlannedStep } from '../../domain/ci-plan.ts';
import { installsDependencies } from '../../domain/ci-safety.ts';
import { shellInvocation } from '../../domain/ci-shell.ts';
import { CiError, type CiJob, type CiWorkflow } from '../../domain/ci-workflow.ts';
import { executeJob } from './ci-run.ts';
import { currentRunnerOs, onPath } from './ci-process.ts';
import { loadWorkflow, loadWorkflows, workflowDirectory } from './ci-workflows.ts';
import { OperationError, requireThat, result, stringOption, type Context, type Request, type Result } from './contracts.ts';
import { didYouMean, suggestions } from './suggest.ts';
const usageNext = 'node bin/app help ci';
const jobReference = /^([\w.-]+)\/([\w-]+)$/;
/** Expressions an execution settles while it runs (earlier step outputs, the scratch temp folder) or from the local checkout. */
const deferredWhileRunning = (expression: string): boolean => expression.startsWith('steps.') || expression === 'runner.temp';
const deferredInDryRun = (expression: string): boolean => deferredWhileRunning(expression) || expression === 'github.sha' || expression === 'github.workspace';
const toOperationError = (error: unknown): unknown =>
  error instanceof CiError ? new OperationError(error.code, error.message, error.code.startsWith('CI_MATRIX') ? usageNext : undefined) : error;
function head(root: string): Promise<string | undefined> {
  return new Promise(accept => {
    execFile('git', ['rev-parse', 'HEAD'], { cwd: root, shell: false, windowsHide: true, timeout: 10_000, encoding: 'utf8' },
      (error, stdout) => accept(error ? undefined : stdout.trim() || undefined));
  });
}
function listOperation(request: Request, workflows: CiWorkflow[]): Result {
  const summaries = workflows.map(summarizeWorkflow), jobs = summaries.flatMap(item => item.jobs);
  return result(request.command, { directory: workflowDirectory, workflows: summaries,
    summary: { workflows: summaries.length, jobs: jobs.length, reproducible: jobs.filter(job => job.reproducible).length, executable: jobs.filter(job => job.executable).length },
    next: summaries.length ? `node bin/app ci --job ${jobs[0]?.reference ?? '<workflow>/<job>'}` : null });
}
function selected(request: Request): { stem: string; id: string } {
  const text = stringOption(request.options, 'job') ?? '', match = jobReference.exec(text);
  requireThat(match, 'CI_JOB_REFERENCE', `--job expects <workflow-file-stem>/<job-id>, for example ci/baseline; got "${text}".`);
  return { stem: match[1]!, id: match[2]! };
}
async function chooseJob(root: string, stem: string, id: string): Promise<{ workflow: CiWorkflow; job: CiJob }> {
  const { workflow, stems } = await loadWorkflow(root, stem);
  if (!workflow) throw new OperationError('CI_WORKFLOW_UNKNOWN', `No workflow ${stem} in ${workflowDirectory}.${didYouMean(suggestions(stem, stems))} Known: ${stems.join(', ') || 'none'}.`, 'node bin/app ci --list');
  const job = workflow.jobs.find(item => item.id === id);
  if (!job) throw new OperationError('CI_JOB_UNKNOWN', `Workflow ${stem} has no job ${id}.${didYouMean(suggestions(id, workflow.jobs.map(item => item.id)))} Jobs: ${workflow.jobs.map(item => item.id).join(', ')}.`, 'node bin/app ci --list');
  return { workflow, job };
}
const plannedStatus = (step: PlannedStep) => step.disposition === 'run' ? { status: 'not-run' } : { status: 'skipped', reason: skipReason(step) };
function stepView(step: PlannedStep): Record<string, unknown> {
  const { index, workflowStep, action, id, name, kind, disposition, uses, shell, command, workingDirectory, env, unresolved, condition, note } = step;
  return { index, ...(action || workflowStep !== index ? { workflowStep } : {}), ...(action ? { action } : {}), id, name, kind, disposition, ...(uses ? { uses } : {}), ...(shell ? { shell } : {}), ...(command !== undefined ? { command } : {}),
    ...(workingDirectory !== undefined ? { workingDirectory } : {}), env, unresolved, ...(condition ? { condition } : {}), ...(note ? { note } : {}) };
}
function notes(plan: JobPlan, blockers: string[]): string[] {
  const items: string[] = [];
  if (plan.matrix.mode === 'default') items.push(`matrix: ${plan.matrix.available} combinations; defaulted to ${describeCombination(plan.matrix.combination)} (choose with --matrix key=value).`);
  const external = plan.steps.filter(step => step.kind === 'external');
  if (external.length) items.push(`${external.length} external action step(s) are skipped: ${external.map(step => step.uses ?? step.name).join(', ')}.`);
  const installing = plan.steps.filter(step => step.disposition === 'run' && installsDependencies(step.command ?? ''));
  if (installing.length) items.push(`Step(s) ${installing.map(step => step.index).join(', ')} run npm ci/install in the project folder; --execute would replace this checkout's node_modules.`);
  if (plan.unresolved.length) items.push(`Unresolved \${{ }} expressions are shown verbatim: ${plan.unresolved.join('; ')}.`);
  if (plan.needs.length) items.push(`The job needs ${plan.needs.join(', ')}; their results and artifacts are not reproduced.`);
  if (plan.jobCondition) items.push(`Job condition "${plan.jobCondition.expression}" is ${plan.jobCondition.result === 'unknown' ? 'not decidable locally' : plan.jobCondition.result}.`);
  return [...items, ...blockers.map(reason => `--execute would be refused: ${reason}`)];
}
function jobData(plan: JobPlan, blockers: string[], execution: string, steps: unknown[], mode: string): Record<string, unknown> {
  return { gate: 'ci', workflow: plan.workflow, file: `${workflowDirectory}/${plan.file}`, job: plan.job, name: plan.name, mode, execution, runsOn: plan.runsOn,
    runner: { os: plan.runnerOs, local: plan.localOs, matches: plan.runnerOs === plan.localOs }, matrix: { mode: plan.matrix.mode, available: plan.matrix.available, combination: plan.matrix.combination },
    needs: plan.needs, executable: blockers.length === 0, blockers, ...(mode === 'dry-run' && blockers.length === 0 ? { next: commandFor(plan, ' --execute') } : {}), unresolved: plan.unresolved, notes: notes(plan, blockers), steps };
}
async function shellBlockers(plan: JobPlan): Promise<string[]> {
  const blockers: string[] = [];
  for (const step of plan.steps.filter(item => item.disposition === 'run')) {
    const invocation = shellInvocation(step.shell ?? 'bash', step.shellExplicit ?? false, '');
    if (!invocation) blockers.push(`step ${step.index} uses the unsupported shell "${step.shell}"`);
    else if (!await onPath(invocation.file)) blockers.push(`step ${step.index} needs ${invocation.file}, which is not on PATH`);
  }
  return [...new Set(blockers)];
}
const shellSafe = (value: string): string => /^[\w=,./:@-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
/** The exact command that reproduces this plan's matrix selection. */
function commandFor(plan: JobPlan, flags: string): string {
  const selector = plan.matrix.mode === 'none' ? '' : ` --matrix ${shellSafe(describeCombination(plan.matrix.combination))}`;
  return `node bin/app ci --job ${plan.workflow}/${plan.job}${selector}${flags}`;
}
type StepRecord = Record<string, unknown> & { status: string };
function outcomeResult(request: Request, plan: JobPlan, steps: StepRecord[], durationMs: number, failedStep: number | undefined, cancelled: boolean): Result {
  const count = (status: string) => steps.filter(step => step.status === status).length;
  const summary = { passed: count('passed'), failed: count('failed'), skipped: count('skipped'), notRun: count('not-run'), durationMs };
  const outcome = result(request.command, { ...jobData(plan, [], 'executed', steps, 'execute'), summary }, cancelled ? 'cancelled' : failedStep === undefined ? 'ok' : 'failed');
  if (cancelled) outcome.diagnostics.push({ code: 'CANCELLED', message: 'ci job cancelled; remaining steps were not run and completed steps are not a verdict.' });
  else if (failedStep !== undefined) outcome.diagnostics.push({ code: 'CI_JOB_FAILED', message: `Step ${failedStep} of ${plan.workflow}/${plan.job} failed; later steps were not run.`, next: commandFor(plan, ' --execute') });
  return outcome;
}
async function execute(request: Request, context: Context, plan: JobPlan, workflow: CiWorkflow, job: CiJob, extra: Record<string, string | undefined>): Promise<Result> {
  const blockers = [...executionBlockers(plan, deferredWhileRunning), ...await shellBlockers(plan)];
  const planned = plan.steps.map(step => ({ ...stepView(step), ...plannedStatus(step) }));
  if (blockers.length) {
    const refused = result(request.command, jobData(plan, blockers, 'refused', planned, 'execute'), 'blocked');
    refused.diagnostics.push(...blockers.map(message => ({ code: 'CI_EXECUTE_REFUSED', message, next: commandFor(plan, '') })));
    return refused;
  }
  const started = performance.now(), timeoutMs = Number(stringOption(request.options, 'timeout') ?? '600000');
  const run = await executeJob({ plan, workflow, job, context, timeoutMs, extra });
  const merged = run.steps.map((step, position) => ({ ...stepView(plan.steps[position]!), ...step }));
  return outcomeResult(request, plan, merged, Math.round(performance.now() - started), run.failedStep, Boolean(context.signal?.aborted));
}
async function jobOperation(request: Request, context: Context): Promise<Result> {
  const { stem, id } = selected(request), selector: Selector = typeof request.options.matrix === 'string' ? parseMatrixSelector(request.options.matrix) : {};
  const { workflow, job } = await chooseJob(context.root, stem, id);
  const running = request.options.execute === true && request.options['dry-run'] !== true;
  const sha = running ? await head(context.root) : undefined;
  const extra: Record<string, string | undefined> = { 'github.workspace': context.root, 'github.sha': sha };
  const plan = planJob(workflow, job, { localOs: currentRunnerOs(), selector, environment: path => running ? extra[path] : undefined });
  if (running) return execute(request, context, plan, workflow, job, extra);
  const blockers = [...executionBlockers(plan, deferredInDryRun), ...await shellBlockers(plan)];
  const steps = plan.steps.map(step => ({ ...stepView(step), ...plannedStatus(step) }));
  return result(request.command, jobData(plan, blockers, 'not-run', steps, 'dry-run'), 'planned');
}
export async function ciOperation(request: Request, context: Context): Promise<Result> {
  const list = request.options.list === true, job = request.options.job !== undefined;
  requireThat(list !== job, 'CI_USAGE', 'Use exactly one of --list or --job <workflow-file-stem>/<job-id>.');
  requireThat(job || (request.options.matrix === undefined && request.options.execute === undefined), 'CI_USAGE', '--matrix and --execute apply to --job only.');
  try { return list ? listOperation(request, await loadWorkflows(context.root)) : await jobOperation(request, context); }
  catch (error) { throw toOperationError(error); }
}
