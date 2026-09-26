/**
 * `check`: the fast daily/agent gate. Every step runs even after a failure; the result lists each
 * step's status, duration and the tail of failing output. It is deliberately NOT `verify`.
 * Steps call installed tool entry points with argument arrays (no shell, no recursive npm).
 */
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { exists } from './files.ts';
import { runNode } from './process.ts';
import { OperationError, result, stringOption, type Context, type Request, type Result } from './contracts.ts';
export interface CheckStep { id: string; display: string; entry: string; args: string[]; skip?: string }
export interface StepOutcome {
  id: string; command: string; status: 'passed' | 'failed' | 'skipped' | 'not-run';
  durationMs: number; exitCode: number | null; code?: string; reason?: string; outputTail?: string;
}
export interface Changes { source: 'git' | 'unavailable'; files: string[]; reason?: string }
type Runner = typeof runNode;
type Git = (root: string, args: string[]) => Promise<string | null>;
const code = /\.(?:[cm]?[jt]sx?|vue)$/;
const maxRelated = 200;
const vueTsc = 'node_modules/vue-tsc/bin/vue-tsc.js', eslint = 'node_modules/eslint/bin/eslint.js', vitest = 'node_modules/vitest/vitest.mjs';
/** A generated project carries its ownership receipt and a project-scoped TypeScript config. */
async function checkScope(root: string): Promise<'generated-project' | 'shell-repository'> {
  return await exists(join(root, '.companion/generation.json')) && await exists(join(root, 'tsconfig.project.json')) ? 'generated-project' : 'shell-repository';
}
const runGit: Git = (root, args) => new Promise(accept => {
  execFile('git', args, { cwd: root, shell: false, windowsHide: true, timeout: 10_000, maxBuffer: 1_048_576, encoding: 'utf8' },
    (error, stdout) => accept(error ? null : stdout));
});
/** Tracked changes against HEAD plus untracked files, relative to the project root. */
async function changedFiles(root: string, git: Git = runGit): Promise<Changes> {
  const tracked = await git(root, ['diff', '--name-only', '--relative', 'HEAD']);
  const untracked = tracked === null ? null : await git(root, ['ls-files', '--others', '--exclude-standard']);
  if (tracked === null || untracked === null) return { source: 'unavailable', files: [], reason: 'git or a HEAD commit is unavailable; running the full suite' };
  const files: string[] = [];
  for (const path of new Set(`${tracked}\n${untracked}`.split('\n').map(line => line.trim()).filter(Boolean))) {
    if (code.test(path) && !path.split('/').includes('node_modules') && await exists(join(root, path))) files.push(path);
  }
  return { source: 'git', files: files.sort() };
}
export async function checkSteps(root: string, fast: boolean, git: Git = runGit): Promise<{ scope: string; steps: CheckStep[]; changes?: Changes }> {
  const scope = await checkScope(root), project = scope === 'generated-project';
  const config = project ? ['--config', 'vitest.project.config.mjs'] : [];
  const typecheck: CheckStep = project
    ? { id: 'typecheck', display: 'vue-tsc --noEmit --project tsconfig.project.json', entry: vueTsc, args: ['--noEmit', '--project', 'tsconfig.project.json'] }
    : { id: 'typecheck', display: 'vue-tsc --noEmit', entry: vueTsc, args: ['--noEmit'] };
  const fullTest: CheckStep = { id: 'test', display: `vitest run${project ? ' --config vitest.project.config.mjs' : ''}`, entry: vitest, args: ['run', ...config] };
  if (!fast) {
    const lint: CheckStep[] = project ? [] : [{ id: 'lint', display: 'node scripts/quality/lint-source.mjs', entry: 'scripts/quality/lint-source.mjs', args: [] }];
    return { scope, steps: [typecheck, ...lint, { id: 'eslint', display: 'eslint src --max-warnings 0', entry: eslint, args: ['src', '--max-warnings', '0'] }, fullTest] };
  }
  const changes = await changedFiles(root, git);
  let test = fullTest;
  if (changes.source === 'git' && changes.files.length > maxRelated) changes.reason = `more than ${maxRelated} changed files; running the full suite`;
  else if (changes.source === 'git' && !changes.files.length) test = { ...fullTest, display: 'vitest related (no changed source files)', skip: 'No changed source files since HEAD.' };
  else if (changes.source === 'git') test = { id: 'test', display: `vitest related --run (${changes.files.length} changed file${changes.files.length === 1 ? '' : 's'})`, entry: vitest, args: ['related', '--run', '--passWithNoTests', ...config, ...changes.files] };
  return { scope, steps: [typecheck, test], changes };
}
/** ANSI escape sequences are removed from captured output. */
const ansi = new RegExp(String.fromCharCode(27) + '\\[[0-9;?]*[ -/]*[@-~]', 'g');
export function outputTail(text: string, lines = 60, chars = 6000): string {
  const tail = text.replace(ansi, '').replace(/\r\n?/g, '\n').trimEnd().split('\n').slice(-lines).join('\n');
  return tail.length > chars ? tail.slice(-chars) : tail;
}
/** Runs every step (no fail-fast) unless cancelled; child output is captured, not streamed. */
export async function runCheckSteps(steps: readonly CheckStep[], context: Context, timeout = 600_000, run: Runner = runNode): Promise<StepOutcome[]> {
  const outcomes: StepOutcome[] = [];
  for (const step of steps) {
    const base = { id: step.id, command: step.display };
    if (context.signal?.aborted) { outcomes.push({ ...base, status: 'skipped', durationMs: 0, exitCode: null, reason: 'cancelled' }); continue; }
    if (step.skip) { outcomes.push({ ...base, status: 'skipped', durationMs: 0, exitCode: null, reason: step.skip }); continue; }
    context.progress?.(`check: ${step.id} (${step.display})\n`);
    let captured = '';
    const capture = (text: string) => { captured = (captured + text).slice(-65_536); };
    const started = performance.now();
    try {
      const exit = await run({ ...context, progress: capture }, step.entry, step.args, timeout);
      outcomes.push({ ...base, status: 'passed', durationMs: Math.round(performance.now() - started), exitCode: exit.exitCode });
    } catch (error) {
      const failure = error instanceof OperationError ? error : new OperationError('PROCESS_FAILED', error instanceof Error ? error.message : 'Step failed.');
      const exitCode = (failure.details as { execution?: { exitCode?: number | null } } | undefined)?.execution?.exitCode ?? null;
      outcomes.push({ ...base, status: 'failed', durationMs: Math.round(performance.now() - started), exitCode, code: failure.code, outputTail: outputTail(captured || failure.message) });
    }
  }
  return outcomes;
}
function nextStep(failed: StepOutcome[], fast: boolean): string {
  if (failed.length && failed.every(step => step.code === 'TOOL_MISSING')) return 'node shell.mjs install --yes';
  return `Fix the failures above, then rerun: node shell.mjs check${fast ? ' --fast' : ''}`;
}
export async function checkOperation(request: Request, context: Context, run: Runner = runNode, git: Git = runGit): Promise<Result> {
  const fast = request.options.fast === true;
  const timeout = Number(stringOption(request.options, 'timeout') ?? '600000');
  const { scope, steps, changes } = await checkSteps(context.root, fast, git);
  const base = { gate: 'check', scope, mode: fast ? 'fast' : 'full', verify: 'not-run', ...(changes ? { changes: { source: changes.source, files: changes.files.length, sample: changes.files.slice(0, 20), ...(changes.reason ? { reason: changes.reason } : {}) } } : {}) };
  if (request.options['dry-run']) {
    return result(request.command, { ...base, execution: 'not-run', steps: steps.map(step => ({ id: step.id, command: step.display, status: step.skip ? 'skipped' : 'not-run', ...(step.skip ? { reason: step.skip } : {}) })) }, 'planned');
  }
  const started = performance.now();
  const outcomes = await runCheckSteps(steps, context, timeout, run);
  const failed = outcomes.filter(step => step.status === 'failed');
  const summary = { passed: outcomes.filter(step => step.status === 'passed').length, failed: failed.length, skipped: outcomes.filter(step => step.status === 'skipped').length, durationMs: Math.round(performance.now() - started) };
  const cancelled = Boolean(context.signal?.aborted) || failed.some(step => step.code === 'CANCELLED');
  const status = cancelled ? 'cancelled' : failed.length ? 'failed' : 'ok';
  const outcome = result(request.command, { ...base, steps: outcomes, summary }, status);
  if (cancelled) outcome.diagnostics.push({ code: 'CANCELLED', message: 'Check cancelled; remaining steps were not run and completed steps are not a verdict.' });
  else if (failed.length) outcome.diagnostics.push({ code: 'CHECK_FAILED', message: `${failed.length} of ${outcomes.length} check steps failed: ${failed.map(step => step.id).join(', ')}.`, next: nextStep(failed, fast) });
  return outcome;
}
