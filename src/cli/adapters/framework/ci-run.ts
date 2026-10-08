/**
 * Sequential local execution of a planned CI job. Steps run through the platform shell exactly as written, stop on the
 * first failure, and report in the same per-step shape as `check` (status, duration, exit code, output tail).
 * GITHUB_ENV, GITHUB_OUTPUT and GITHUB_PATH files are emulated so later steps see earlier steps' exports.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join, relative, resolve, isAbsolute } from 'node:path';
import { projectInstallEnvironment } from '#shared/platform/npm-install.mjs';
import { parseCommandFile, shellInvocation } from '../../domain/ci-shell.ts';
import { replanStep, skipReason, type JobPlan, type PlannedStep } from '../../domain/ci-plan.ts';
import type { CiJob, CiWorkflow } from '../../domain/ci-workflow.ts';
import { outputTail, type StepOutcome } from './check.ts';
import { currentRunnerOs, runShell, type ShellExit } from './ci-process.ts';
import type { Context } from './contracts.ts';
export interface CiStepOutcome extends Omit<StepOutcome, 'command'> { index: number; name: string; command?: string }
export interface JobExecution { steps: CiStepOutcome[]; failedStep?: number }
interface Session {
  files: { env: string; output: string; path: string; summary: string }; temp: string; exports: Record<string, string>; paths: string[];
  outputs: Map<string, Record<string, string>>; workspace: string; extra: Record<string, string | undefined>;
}
const base = (step: PlannedStep) => ({ id: step.id, index: step.index, name: step.name });
function lookupFor(session: Session): (path: string) => string | undefined {
  return path => {
    if (path === 'runner.temp') return session.temp;
    const match = /^steps\.([\w-]+)\.outputs\.([\w-]+)$/.exec(path);
    if (match) return session.outputs.get(match[1]!)?.[match[2]!];
    return session.extra[path];
  };
}
/** Re-resolves a step whose expressions depend on earlier steps (outputs, runner.temp). */
function resolved(workflow: CiWorkflow, job: CiJob, plan: JobPlan, step: PlannedStep, session: Session): PlannedStep {
  if (!step.unresolved.length) return step;
  const raw = job.steps.find(item => item.index === step.index);
  return raw ? replanStep(workflow, job, plan, raw, lookupFor(session)) : step;
}
function stepEnvironment(session: Session, step: PlannedStep): Record<string, string | undefined> {
  const pathValue = [...session.paths, process.env.PATH ?? ''].join(delimiter);
  return { ...projectInstallEnvironment().env, CI: 'true', RUNNER_OS: currentRunnerOs(),
    RUNNER_TEMP: session.temp, GITHUB_WORKSPACE: session.workspace, GITHUB_ENV: session.files.env, GITHUB_OUTPUT: session.files.output, GITHUB_PATH: session.files.path, GITHUB_STEP_SUMMARY: session.files.summary,
    ...session.exports, ...step.env, PATH: pathValue };
}
async function absorbFiles(session: Session, step: PlannedStep): Promise<void> {
  const read = async (path: string) => { const text = await readFile(path, 'utf8').catch(() => ''); await writeFile(path, ''); return text; };
  Object.assign(session.exports, parseCommandFile(await read(session.files.env)));
  const outputs = parseCommandFile(await read(session.files.output));
  if (Object.keys(outputs).length) session.outputs.set(step.id, { ...session.outputs.get(step.id), ...outputs });
  const added = (await read(session.files.path)).split(/\r?\n/).filter(Boolean);
  session.paths.unshift(...added.reverse());
}
function workingDirectory(session: Session, step: PlannedStep): string | null {
  const target = resolve(session.workspace, step.workingDirectory ?? '.'), inside = relative(session.workspace, target);
  return inside.startsWith('..') || isAbsolute(inside) ? null : target;
}
function failureCode(exit: ShellExit): string {
  if (exit.startError) return 'PROCESS_START_FAILED';
  return exit.stopped === 'timeout' ? 'TIMEOUT' : exit.stopped === 'cancelled' ? 'CANCELLED' : 'PROCESS_FAILED';
}
function outcomeFor(step: PlannedStep, exit: ShellExit, durationMs: number): CiStepOutcome {
  const common = { ...base(step), command: step.command, durationMs, exitCode: exit.exitCode };
  if (exit.exitCode === 0 && !exit.stopped && !exit.startError) return { ...common, status: 'passed' };
  return { ...common, status: 'failed', code: failureCode(exit), outputTail: outputTail(exit.output || exit.startError || `Exited with ${exit.exitCode ?? exit.signal}.`) };
}
async function runStep(step: PlannedStep, session: Session, context: Context, timeoutMs: number): Promise<CiStepOutcome> {
  const cwd = workingDirectory(session, step), invocation = shellInvocation(step.shell ?? 'bash', step.shellExplicit ?? false, step.command ?? '');
  const failed = (code: string, message: string): CiStepOutcome => ({ ...base(step), command: step.command, status: 'failed', durationMs: 0, exitCode: null, code, outputTail: message });
  if (!cwd) return failed('CI_WORKING_DIRECTORY', `working-directory "${step.workingDirectory}" is outside the project root.`);
  if (!invocation) return failed('CI_SHELL_UNSUPPORTED', `shell "${step.shell}" is not supported locally.`);
  context.progress?.(`ci: step ${step.index} (${step.name})\n`);
  const started = performance.now();
  const exit = await runShell({ invocation, cwd, env: stepEnvironment(session, step), timeoutMs, signal: context.signal });
  return outcomeFor(step, exit, Math.round(performance.now() - started));
}
async function openSession(root: string, extra: Record<string, string | undefined>): Promise<Session> {
  const dir = await mkdtemp(join(tmpdir(), 'shell-ci-')), temp = join(dir, 'temp');
  await mkdir(temp);
  const files = { env: join(dir, 'github-env'), output: join(dir, 'github-output'), path: join(dir, 'github-path'), summary: join(dir, 'github-summary') };
  for (const file of Object.values(files)) await writeFile(file, '');
  return { files, temp, exports: {}, paths: [], outputs: new Map(), workspace: root, extra };
}
/** Skipped steps keep their reason; steps after the first failure are `not-run`. */
function pendingOutcome(step: PlannedStep, failedIndex: number | undefined): CiStepOutcome {
  const common = { ...base(step), command: step.command, durationMs: 0, exitCode: null };
  if (step.disposition !== 'run') return { ...common, status: 'skipped', reason: skipReason(step) };
  return { ...common, status: 'not-run', reason: failedIndex === undefined ? 'cancelled' : `stopped after step ${failedIndex} failed` };
}
export interface RunInput { plan: JobPlan; workflow: CiWorkflow; job: CiJob; context: Context; timeoutMs: number; extra: Record<string, string | undefined> }
/** Runs every `run` step in order; the caller has already refused jobs that must not execute. */
export async function executeJob(input: RunInput): Promise<JobExecution> {
  const { plan, workflow, job, context } = input, session = await openSession(context.root, input.extra), steps: CiStepOutcome[] = [];
  let failedStep: number | undefined;
  try {
    for (const planned of plan.steps) {
      if (failedStep !== undefined || planned.disposition !== 'run' || context.signal?.aborted) { steps.push(pendingOutcome(planned, failedStep)); continue; }
      const outcome = await runStep(resolved(workflow, job, plan, planned, session), session, context, input.timeoutMs);
      steps.push(outcome);
      if (outcome.status === 'failed') failedStep = planned.index;
      else await absorbFiles(session, planned);
    }
  } finally { await rm(join(session.temp, '..'), { recursive: true, force: true }); }
  return { steps, ...(failedStep !== undefined ? { failedStep } : {}) };
}
