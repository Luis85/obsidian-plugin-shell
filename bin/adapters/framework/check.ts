/**
 * `check`: the fast daily/agent gate. Every step runs even after a failure; the result lists each
 * step's status, duration and the tail of failing output. It is deliberately NOT `verify`.
 * Steps call installed tool entry points with argument arrays (no shell, no recursive npm).
 */
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { exists } from './files.ts';
import { codeRoots, isWithinRoot, lintRoots } from '../../../scripts/shared/project-roots.mjs';
import { projectConfigPath, projectConfigs } from '../../../scripts/shared/project-configs.mjs';
import { runNode } from './process.ts';
import { OperationError, result, stringOption, type Context, type Request, type Result } from './contracts.ts';
export interface CheckStep { id: string; display: string; entry: string; args: string[]; skip?: string }
export interface StepOutcome {
  id: string; command: string; status: 'passed' | 'failed' | 'skipped' | 'not-run';
  durationMs: number; exitCode: number | null; code?: string; reason?: string; outputTail?: string;
}
export interface Changes { source: 'git' | 'unavailable'; files: string[]; untraceable?: string[]; reason?: string }
type Runner = typeof runNode;
type Git = (root: string, args: string[]) => Promise<string | null>;
const code = /\.(?:[cm]?[jt]sx?|vue)$/;
const maxRelated = 200;
const vueTsc = 'node_modules/vue-tsc/bin/vue-tsc.js', eslint = 'node_modules/eslint/bin/eslint.js', vitest = 'node_modules/vitest/vitest.mjs';
const eslintConfig = 'configs/lint/eslint.config.mjs';
/** A generated project carries its ownership receipt and a project-scoped TypeScript config. */
async function checkScope(root: string): Promise<'generated-project' | 'shell-repository'> {
  return await exists(join(root, '.companion/generation.json')) && projectConfigPath(root, 'typescript') ? 'generated-project' : 'shell-repository';
}
const runGit: Git = (root, args) => new Promise(accept => {
  execFile('git', args, { cwd: root, shell: false, windowsHide: true, timeout: 10_000, maxBuffer: 16_777_216, encoding: 'utf8' },
    (error, stdout) => accept(error ? null : stdout));
});
/** Changes vitest related cannot trace: build/test configuration next to the code. */
const configuration = /^(?:package(?:-lock)?\.json|tsconfig[^/]*\.json|configs\/.+|vite[^/]*\.config\.[cm]?[jt]s|vitest[^/]*\.config\.[cm]?[jt]s|tests\/suites\.json)$/;
/** NUL-separated git output keeps non-ASCII and special paths verbatim (no core.quotePath quoting). */
const fields = (text: string) => text.split('\0').filter(Boolean);
/** Tracked changes against HEAD plus untracked files, relative to the project root. A deleted file, a
 * configuration change or a non-code file inside a code root (fixtures, snapshots, JSON) cannot be
 * mapped to related tests, so it selects the full suite instead of silently skipping tests. */
/** Pairs NUL-separated `--name-status` output into [status, path] entries, then adds untracked files. */
function changeEntries(tracked: string, untracked: string): Array<[string, string]> {
  const parts = fields(tracked), entries: Array<[string, string]> = [];
  for (let index = 0; index + 1 < parts.length; index += 2) entries.push([parts[index]!, parts[index + 1]!]);
  for (const path of fields(untracked)) entries.push(['?', path]);
  return entries;
}
/** A deleted code/root file, a configuration file or a non-code file inside a code root cannot be traced. */
function untraceableChange(status: string, path: string, inRoot: boolean): boolean {
  if (status.startsWith('D')) return code.test(path) || inRoot;
  return configuration.test(path) || (inRoot && !code.test(path));
}
function untraceableReason(listed: string[]): string {
  const sample = listed.slice(0, 5).join(', ') + (listed.length > 5 ? ', …' : '');
  return `deleted, configuration or non-code files changed (${sample}); running the full suite`;
}
async function changedFiles(root: string, git: Git = runGit): Promise<Changes> {
  const tracked = await git(root, ['diff', '--name-status', '--no-renames', '-z', '--relative', 'HEAD']);
  const untracked = tracked === null ? null : await git(root, ['ls-files', '--others', '--exclude-standard', '-z']);
  if (tracked === null || untracked === null) return { source: 'unavailable', files: [], reason: 'git or a HEAD commit is unavailable; running the full suite' };
  const roots = [...codeRoots(root), 'bin'], files = new Set<string>(), untraceable = new Set<string>();
  for (const [status, path] of changeEntries(tracked, untracked)) {
    if (path.split('/').includes('node_modules')) continue;
    if (untraceableChange(status, path, roots.some(base => isWithinRoot(path, base)))) untraceable.add(path);
    else if (code.test(path) && await exists(join(root, path))) files.add(path);
  }
  const listed = [...untraceable].sort();
  if (!listed.length) return { source: 'git', files: [...files].sort() };
  return { source: 'git', files: [...files].sort(), untraceable: listed, reason: untraceableReason(listed) };
}
async function makerSteps(root: string): Promise<CheckStep[]> {
  if (!await exists(join(root, 'bin/app.ts')) || !await exists(join(root, 'configs/types/tsconfig.maker.json'))) return [];
  return [
    { id: 'maker-types', display: 'tsc --noEmit --project configs/types/tsconfig.maker.json', entry: 'node_modules/typescript/bin/tsc', args: ['--noEmit', '--project', 'configs/types/tsconfig.maker.json'] },
    { id: 'maker-tests', display: 'node scripts/testing/suites.mjs maker', entry: 'scripts/testing/suites.mjs', args: ['maker'] },
  ];
}
function typecheckStep(root: string, project: boolean): CheckStep {
  if (!project) return { id: 'typecheck', display: 'vue-tsc --noEmit', entry: vueTsc, args: ['--noEmit'] };
  const tsconfig = projectConfigPath(root, 'typescript') ?? projectConfigs.typescript.path;
  return { id: 'typecheck', display: `vue-tsc --noEmit --project ${tsconfig}`, entry: vueTsc, args: ['--noEmit', '--project', tsconfig] };
}
function vitestConfig(root: string, project: boolean): string[] {
  return ['--config', project ? projectConfigPath(root, 'vitest') ?? projectConfigs.vitest.path : 'configs/testing/vitest.config.mjs'];
}
function fullSteps(root: string, project: boolean, makers: CheckStep[], typecheck: CheckStep, fullTest: CheckStep): CheckStep[] {
  const lint: CheckStep[] = project ? [] : [{ id: 'lint', display: 'node scripts/quality/lint-source.mjs', entry: 'scripts/quality/lint-source.mjs', args: [] }];
  // A generated project also lints its configured product roots (for example <codebaseFolder>/generated).
  const targets = [...(project ? lintRoots(root) : ['src']), ...(makers.length ? ['bin'] : [])];
  const eslintStep: CheckStep = { id: 'eslint', display: `eslint -c ${eslintConfig} ${targets.join(' ')} --max-warnings 0`, entry: eslint, args: ['-c', eslintConfig, ...targets, '--max-warnings', '0'] };
  return [typecheck, ...lint, eslintStep, fullTest, ...makers];
}
/** Fast mode narrows the test step to `vitest related` only when every change is traceable and bounded. */
function fastTestStep(changes: Changes, fullTest: CheckStep, config: string[]): CheckStep {
  if (changes.untraceable || changes.source !== 'git') return fullTest;
  const count = changes.files.length;
  if (count > maxRelated) { changes.reason = `more than ${maxRelated} changed files; running the full suite`; return fullTest; }
  if (!count) return { ...fullTest, display: 'vitest related (no changed source files)', skip: 'No changed source files since HEAD.' };
  return { id: 'test', display: `vitest related --run (${count} changed file${count === 1 ? '' : 's'})`, entry: vitest, args: ['related', '--run', '--passWithNoTests', ...config, ...changes.files] };
}
export async function checkSteps(root: string, fast: boolean, git: Git = runGit): Promise<{ scope: string; steps: CheckStep[]; changes?: Changes }> {
  const scope = await checkScope(root), project = scope === 'generated-project';
  const makers = await makerSteps(root);
  const config = vitestConfig(root, project);
  const typecheck = typecheckStep(root, project);
  const fullTest: CheckStep = { id: 'test', display: `vitest run ${config.join(' ')}`, entry: vitest, args: ['run', ...config] };
  if (!fast) return { scope, steps: fullSteps(root, project, makers, typecheck, fullTest) };
  const changes = await changedFiles(root, git);
  return { scope, steps: [typecheck, fastTestStep(changes, fullTest, config), ...makers], changes };
}
/** ANSI escape sequences are removed from captured output. */
const ansi = new RegExp(String.fromCharCode(27) + '\\[[0-9;?]*[ -/]*[@-~]', 'g');
export function outputTail(text: string, lines = 60, chars = 6000): string {
  const tail = text.replace(ansi, '').replace(/\r\n?/g, '\n').trimEnd().split('\n').slice(-lines).join('\n');
  return tail.length > chars ? tail.slice(-chars) : tail;
}
function skippedReason(step: CheckStep, context: Context): string | undefined {
  return context.signal?.aborted ? 'cancelled' : step.skip;
}
function failedOutcome(base: { id: string; command: string }, error: unknown, captured: string, durationMs: number): StepOutcome {
  const failure = error instanceof OperationError ? error : new OperationError('PROCESS_FAILED', error instanceof Error ? error.message : 'Step failed.');
  const exitCode = (failure.details as { execution?: { exitCode?: number | null } } | undefined)?.execution?.exitCode ?? null;
  return { ...base, status: 'failed', durationMs, exitCode, code: failure.code, outputTail: outputTail(captured || failure.message) };
}
async function runCheckStep(step: CheckStep, context: Context, timeout: number, run: Runner): Promise<StepOutcome> {
  const base = { id: step.id, command: step.display };
  const reason = skippedReason(step, context);
  if (reason) return { ...base, status: 'skipped', durationMs: 0, exitCode: null, reason };
  context.progress?.(`check: ${step.id} (${step.display})\n`);
  let captured = '';
  const capture = (text: string) => { captured = (captured + text).slice(-65_536); };
  const started = performance.now();
  try {
    const exit = await run({ ...context, progress: capture }, step.entry, step.args, timeout);
    return { ...base, status: 'passed', durationMs: Math.round(performance.now() - started), exitCode: exit.exitCode };
  } catch (error) {
    return failedOutcome(base, error, captured, Math.round(performance.now() - started));
  }
}
/** Runs every step (no fail-fast) unless cancelled; child output is captured, not streamed. */
export async function runCheckSteps(steps: readonly CheckStep[], context: Context, timeout = 600_000, run: Runner = runNode): Promise<StepOutcome[]> {
  const outcomes: StepOutcome[] = [];
  for (const step of steps) outcomes.push(await runCheckStep(step, context, timeout, run));
  return outcomes;
}
function nextStep(failed: StepOutcome[], fast: boolean): string {
  if (failed.length && failed.every(step => step.code === 'TOOL_MISSING')) return 'node bin/app install --yes';
  return `Fix the failures above, then rerun: node bin/app check${fast ? ' --fast' : ''}`;
}
function changeSummary(changes: Changes | undefined) {
  if (!changes) return {};
  return { changes: { source: changes.source, files: changes.files.length, sample: changes.files.slice(0, 20), ...(changes.reason ? { reason: changes.reason } : {}) } };
}
function plannedSteps(steps: readonly CheckStep[]) {
  return steps.map(step => ({ id: step.id, command: step.display, status: step.skip ? 'skipped' : 'not-run', ...(step.skip ? { reason: step.skip } : {}) }));
}
function addOutcomeDiagnostic(outcome: Result, failed: StepOutcome[], total: number, cancelled: boolean, fast: boolean): void {
  if (cancelled) outcome.diagnostics.push({ code: 'CANCELLED', message: 'Check cancelled; remaining steps were not run and completed steps are not a verdict.' });
  else if (failed.length) outcome.diagnostics.push({ code: 'CHECK_FAILED', message: `${failed.length} of ${total} check steps failed: ${failed.map(step => step.id).join(', ')}.`, next: nextStep(failed, fast) });
}
export async function checkOperation(request: Request, context: Context, run: Runner = runNode, git: Git = runGit): Promise<Result> {
  const fast = request.options.fast === true;
  const timeout = Number(stringOption(request.options, 'timeout') ?? '600000');
  const { scope, steps, changes } = await checkSteps(context.root, fast, git);
  const base = { gate: 'check', scope, mode: fast ? 'fast' : 'full', verify: 'not-run', ...changeSummary(changes) };
  if (request.options['dry-run']) return result(request.command, { ...base, execution: 'not-run', steps: plannedSteps(steps) }, 'planned');
  const started = performance.now();
  const outcomes = await runCheckSteps(steps, context, timeout, run);
  const failed = outcomes.filter(step => step.status === 'failed');
  const count = (status: StepOutcome['status']) => outcomes.filter(step => step.status === status).length;
  const summary = { passed: count('passed'), failed: failed.length, skipped: count('skipped'), durationMs: Math.round(performance.now() - started) };
  const cancelled = Boolean(context.signal?.aborted) || failed.some(step => step.code === 'CANCELLED');
  const outcome = result(request.command, { ...base, steps: outcomes, summary }, cancelled ? 'cancelled' : failed.length ? 'failed' : 'ok');
  addOutcomeDiagnostic(outcome, failed, outcomes.length, cancelled, fast);
  return outcome;
}
