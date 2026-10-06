/**
 * `check`: the fast daily/agent gate. Every step runs even after a failure; the result lists each
 * step's status, duration and the tail of failing output. It is deliberately NOT `verify`.
 * Steps call installed tool entry points with argument arrays (no shell, no recursive npm).
 */
import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { exists } from './files.ts';
import { lintRoots } from '../../../../scripts/shared/project-roots.mjs';
import { projectConfigPath, projectConfigs } from '../../../../scripts/shared/project-configs.mjs';
import { runNode } from './process.ts';
import { OperationError, result, stringOption, type Context, type Request, type Result } from './contracts.ts';
import { changedFiles, runGit, type Changes, type Git } from './check-changes.ts';
import { fastSteps, fastSuites, suiteTimeoutMs, type Reason } from './check-selection.ts';
/** `timeoutMs` is a step's default budget; an explicit `check --timeout` overrides it for every step. */
export interface CheckStep { id: string; display: string; entry: string; args: string[]; skip?: string; timeoutMs?: number }
export interface StepOutcome {
  id: string; command: string; status: 'passed' | 'failed' | 'skipped' | 'not-run';
  durationMs: number; exitCode: number | null; code?: string; reason?: string; outputTail?: string;
}
type Runner = typeof runNode;
const vueTsc = 'node_modules/vue-tsc/bin/vue-tsc.js', eslint = 'node_modules/eslint/bin/eslint.js', vitest = 'node_modules/vitest/vitest.mjs';
const eslintConfig = 'configs/lint/eslint.config.mjs';
/** A generated project carries its ownership receipt and a project-scoped TypeScript config. */
async function checkScope(root: string): Promise<'generated-project' | 'shell-repository'> {
  return await exists(join(root, '.companion/generation.json')) && projectConfigPath(root, 'typescript') ? 'generated-project' : 'shell-repository';
}
/** The shipped maker CLI is type-checked everywhere. Its qualification suite needs shell-only fixtures (the starter
 * pack and the companion reference project) that generated projects deliberately omit, so it runs only in the shell. */
async function makerSteps(root: string, project: boolean): Promise<CheckStep[]> {
  if (!await exists(join(root, 'src/cli/app.ts')) || !await exists(join(root, 'configs/types/tsconfig.maker.json'))) return [];
  const types: CheckStep = { id: 'maker-types', display: 'tsc --noEmit --project configs/types/tsconfig.maker.json', entry: 'node_modules/typescript/bin/tsc', args: ['--noEmit', '--project', 'configs/types/tsconfig.maker.json'] };
  if (project) return [types];
  return [types, { id: 'maker-tests', display: 'node scripts/testing/suites.mjs maker', entry: 'scripts/testing/suites.mjs', args: ['maker'], timeoutMs: suiteTimeoutMs }];
}
function typecheckStep(root: string, project: boolean): CheckStep {
  if (!project) return { id: 'typecheck', display: 'vue-tsc --noEmit', entry: vueTsc, args: ['--noEmit'] };
  const tsconfig = projectConfigPath(root, 'typescript') ?? projectConfigs.typescript.path;
  return { id: 'typecheck', display: `vue-tsc --noEmit --project ${tsconfig}`, entry: vueTsc, args: ['--noEmit', '--project', tsconfig] };
}
function vitestConfig(root: string, project: boolean): string[] {
  return ['--config', project ? projectConfigPath(root, 'vitest') ?? projectConfigs.vitest.path : 'configs/testing/vitest.config.mjs'];
}
interface Parts { makers: CheckStep[]; typecheck: CheckStep; fullTest: CheckStep; lint: CheckStep | null; eslint: CheckStep; eslintRoots: string[]; authoring: CheckStep[] }
const authoringTest = /^(?:custom|locale)-[a-z0-9-]+\.checks\.mjs$/;
/** Tooling tests the custom-maker and locale recipes write; a node:test file runs its tests when executed directly. */
async function authoringSteps(root: string): Promise<CheckStep[]> {
  if (!await exists(join(root, 'tests/tooling'))) return [];
  const names = (await readdir(join(root, 'tests/tooling'))).filter(name => authoringTest.test(name)).sort();
  return names.map(name => ({ id: `tooling:${name.slice(0, -'.checks.mjs'.length)}`, display: `node tests/tooling/${name}`, entry: `tests/tooling/${name}`, args: [] }));
}
const oxlintEntry = 'scripts/quality/lint-source.mjs';
/** The same two linters as `npm run lint`: oxlint over owned source, then ESLint over the configured roots. */
function stepParts(root: string, project: boolean, makers: CheckStep[], config: string[], extra: { oxlint: boolean; authoring: CheckStep[] }): Parts {
  const lint: CheckStep | null = extra.oxlint ? { id: 'lint', display: `node ${oxlintEntry}`, entry: oxlintEntry, args: [] } : null;
  // A generated project also lints its configured product roots (for example <codebaseFolder>/generated).
  const eslintRoots = project ? lintRoots(root) : ['src'];
  const eslintStep: CheckStep = { id: 'eslint', display: `eslint -c ${eslintConfig} ${eslintRoots.join(' ')} --max-warnings 0`, entry: eslint, args: ['-c', eslintConfig, ...eslintRoots, '--max-warnings', '0'] };
  const fullTest: CheckStep = { id: 'test', display: `vitest run ${config.join(' ')}`, entry: vitest, args: ['run', ...config] };
  return { makers, typecheck: typecheckStep(root, project), fullTest, lint, eslint: eslintStep, eslintRoots, authoring: extra.authoring };
}
const fullSteps = (parts: Parts): CheckStep[] => [parts.typecheck, ...(parts.lint ? [parts.lint] : []), parts.eslint, parts.fullTest, ...parts.authoring, ...parts.makers];
export interface CheckSelection { scope: string; steps: CheckStep[]; changes?: Changes; suites?: Array<{ name: string; reasons: Reason[] }> }
/** `base` (fast mode only) is the ref whose merge-base with HEAD starts the diff; default origin/main, else HEAD. */
export async function checkSteps(root: string, fast: boolean, git: Git = runGit, base?: string, skipSuites = false): Promise<CheckSelection> {
  const scope = await checkScope(root), project = scope === 'generated-project';
  const makers = await makerSteps(root, project), config = vitestConfig(root, project);
  // A generated project without the shell's oxlint wrapper keeps ESLint only; the shell always runs both.
  const oxlint = !project || await exists(join(root, oxlintEntry));
  const parts = stepParts(root, project, makers, config, { oxlint, authoring: await authoringSteps(root) });
  if (!fast) return { scope, steps: fullSteps(parts) };
  const changes = await changedFiles(root, git, base);
  const suites = await fastSuites(root, project, changes);
  const narrowed = fastSteps({ project, changes, typecheck: parts.typecheck, fullTest: parts.fullTest, vitestConfig: config, full: () => fullSteps(parts),
    fullLint: parts.lint, eslintRoots: parts.eslintRoots, fullEslint: parts.eslint, makerTypes: makers.filter(step => step.id === 'maker-types'), suites, skipSuites });
  // Without a diff source the narrowed gate falls back to the full steps, which already include the authoring tests.
  const steps = changes.source === 'git' ? [...narrowed, ...parts.authoring] : narrowed;
  return { scope, steps, changes, suites };
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
export async function runCheckSteps(steps: readonly CheckStep[], context: Context, timeout?: number, run: Runner = runNode): Promise<StepOutcome[]> {
  const outcomes: StepOutcome[] = [];
  for (const step of steps) outcomes.push(await runCheckStep(step, context, timeout ?? step.timeoutMs ?? 600_000, run));
  return outcomes;
}
/** A generated project installs with its own `npm ci`, the same instruction AGENTS.md and the README give. */
function nextStep(failed: StepOutcome[], fast: boolean, project: boolean, base?: string): string {
  if (failed.length && failed.every(step => step.code === 'TOOL_MISSING')) return project ? 'npm ci' : 'node bin/app install --yes';
  return `Fix the failures above, then rerun: node bin/app check${fast ? ' --fast' : ''}${base ? ` --base ${base}` : ''}`;
}
function changeSummary(changes: Changes | undefined, suites: CheckSelection['suites']) {
  if (!changes) return {};
  const summary = { source: changes.source, base: changes.base, files: changes.files.length, paths: changes.paths.length, sample: changes.files.slice(0, 20), ...(changes.reason ? { reason: changes.reason } : {}) };
  return { changes: summary, ...(suites ? { suites: suites.map(suite => ({ name: suite.name, reasons: suite.reasons })) } : {}) };
}
function plannedSteps(steps: readonly CheckStep[]) {
  return steps.map(step => ({ id: step.id, command: step.display, status: step.skip ? 'skipped' : 'not-run', ...(step.skip ? { reason: step.skip } : {}) }));
}
function addOutcomeDiagnostic(outcome: Result, failed: StepOutcome[], total: number, cancelled: boolean, fast: boolean, project: boolean, base?: string): void {
  if (cancelled) outcome.diagnostics.push({ code: 'CANCELLED', message: 'Check cancelled; remaining steps were not run and completed steps are not a verdict.' });
  else if (failed.length) outcome.diagnostics.push({ code: 'CHECK_FAILED', message: `${failed.length} of ${total} check steps failed: ${failed.map(step => step.id).join(', ')}.`, next: nextStep(failed, fast, project, base) });
}
function baseOption(request: Request, fast: boolean): string | undefined {
  const base = stringOption(request.options, 'base');
  if (base !== undefined && !fast) throw new OperationError('INVALID_OPTION', '--base requires --fast (or --plan).', 'node bin/app check --fast --base <branch-or-commit>');
  return base;
}
function skipSuitesOption(request: Request, fast: boolean): boolean {
  const skip = request.options['skip-suites'] === true;
  if (skip && !fast) throw new OperationError('INVALID_OPTION', '--skip-suites requires --fast.', 'node bin/app check --fast --skip-suites');
  return skip;
}
export async function checkOperation(request: Request, context: Context, run: Runner = runNode, git: Git = runGit): Promise<Result> {
  const fast = request.options.fast === true;
  const explicit = stringOption(request.options, 'timeout'), timeout = explicit === undefined ? undefined : Number(explicit);
  const requestedBase = baseOption(request, fast);
  const { scope, steps, changes, suites } = await checkSteps(context.root, fast, git, requestedBase, skipSuitesOption(request, fast));
  const base = { gate: 'check', scope, mode: fast ? 'fast' : 'full', verify: 'not-run', ...changeSummary(changes, suites) };
  if (request.options['dry-run']) return result(request.command, { ...base, execution: 'not-run', steps: plannedSteps(steps) }, 'planned');
  const started = performance.now();
  const outcomes = await runCheckSteps(steps, context, timeout, run);
  const failed = outcomes.filter(step => step.status === 'failed');
  const count = (status: StepOutcome['status']) => outcomes.filter(step => step.status === status).length;
  const summary = { passed: count('passed'), failed: failed.length, skipped: count('skipped'), durationMs: Math.round(performance.now() - started) };
  const cancelled = Boolean(context.signal?.aborted) || failed.some(step => step.code === 'CANCELLED');
  const outcome = result(request.command, { ...base, steps: outcomes, summary }, cancelled ? 'cancelled' : failed.length ? 'failed' : 'ok');
  addOutcomeDiagnostic(outcome, failed, outcomes.length, cancelled, fast, scope === 'generated-project', requestedBase);
  return outcome;
}
