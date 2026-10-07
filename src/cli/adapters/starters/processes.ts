import { join, resolve } from 'node:path';
import { createFilePlan } from '#shared/platform/file-plan.ts';
import { exists, hash, readBounded } from '../framework/files.ts';
import { npmEntry, runNode } from '../framework/process.ts';
import { parseJsonData } from '#shared/contracts/json-data.ts';
import { result, OperationError, requireThat, stringOption, type Context, type Request, type Result } from '../framework/contracts.ts';
import { array, record, fields, identifier, readProcesses, text } from '#shared/companion/starters/validation.ts';
import { checkDirectoryChain } from './repository.ts';
import { receiptFile } from './project.ts';
import type { StarterProcess, StarterStep } from '#shared/companion/starters/types.ts';
/** Requested processes plus their dependencies, each once, in dependency order. */
function orderedProcesses(processes: StarterProcess[], requested: string[]): StarterProcess[] {
  const ordered: StarterProcess[] = [], visited = new Set<string>();
  function visit(id: string) {
    identifier(id); const process = processes.find(item => item.id === id);
    requireThat(process, 'STARTER_PROCESS', `Unknown process ${id}.`);
    if (visited.has(id)) return;
    process.dependsOn.forEach(visit); visited.add(id); ordered.push(process);
  }
  requireThat(requested.length > 0 && requested.length <= 32 && new Set(requested).size === requested.length, 'STARTER_PROCESS', 'Select one or more distinct processes.');
  requested.forEach(visit);
  return ordered;
}
const packageFiles = ['package.json', 'package-lock.json', '.npmrc'];
/** A step's node script and, outside the project root, its own package files. */
function stepPaths(step: StarterStep): string[] {
  const folder = step.cwd === '.' ? '' : step.cwd + '/';
  return [...(step.script ? [folder + step.script] : []), ...(folder ? packageFiles.map(name => folder + name) : [])];
}
/** The receipt, package files and node scripts each reviewed process step depends on. */
function boundPaths(ordered: StarterProcess[]): string[] {
  return [...new Set([receiptFile, ...packageFiles, ...ordered.flatMap(process => process.steps.flatMap(stepPaths))])].sort();
}
export async function processPlan(directory: string, requested: string[]) {
  await checkDirectoryChain(directory);
  const bytes = await readBounded(join(directory, receiptFile)), receipt = record(parseJsonData(bytes.toString('utf8')));
  fields(receipt, ['schemaVersion', 'starter', 'values', 'processes', 'firstRun', 'nextSteps', 'files']);
  requireThat(receipt.schemaVersion === 1, 'STARTER_VERSION', 'Unsupported starter receipt.');
  const ordered = orderedProcesses(readProcesses(receipt.processes), requested);
  const sources = [];
  for (const path of boundPaths(ordered)) sources.push({ path, sha256: await exists(join(directory, path)) ? hash(await readBounded(join(directory, path), 8_000_000)) : null });
  const binding = { directory: resolve(directory), receiptSha256: hash(bytes), requested, processes: ordered, sources };
  return { ...binding, planHash: hash(JSON.stringify(binding)), effects: 'Trusted project code may write files, install dependencies, access the network, or launch a local preview. Not a sandbox.' };
}
type CompletedStep = { process: string; step: number; exitCode: number; signal: string | null; truncated: boolean };
async function runStep(context: Context, directory: string, process: StarterProcess, step: StarterStep): Promise<Omit<CompletedStep, 'process' | 'step'>> {
  const cwd = resolve(directory, step.cwd); await checkDirectoryChain(cwd);
  const entry = step.runner === 'npm' ? await npmEntry() : resolve(cwd, step.script!);
  if (step.runner === 'node') await readBounded(entry, 8_000_000);
  context.progress?.(`\n> ${process.label}: ${step.runner} ${step.script ?? ''} ${step.args.join(' ')}\n`);
  const run = await runNode({ ...context, root: cwd }, entry, step.args, step.timeout);
  return { exitCode: run.exitCode, signal: run.signal, truncated: run.truncated };
}
/** Completed effects are preserved and reported; nothing is rolled back or retried. */
function processFailure(cause: unknown, directory: string, completed: CompletedStep[]): OperationError {
  const known = cause instanceof OperationError;
  const error = new OperationError(known ? cause.code : 'STARTER_PROCESS_FAILED', cause instanceof Error ? cause.message : 'Starter process failed.');
  error.details = { written: true, directory, completed, failure: known ? cause.details ?? null : null, automaticRetry: false, effects: 'preserved-or-uncertain; not rolled back' };
  return error;
}
async function runProcesses(context: Context, directory: string, requested: string[], expected: string) {
  const plan = await processPlan(directory, requested);
  requireThat(plan.planHash === expected, 'PLAN_STALE', 'Process inputs changed after review.');
  const completed: CompletedStep[] = [];
  try {
    for (const process of plan.processes) for (const [index, step] of process.steps.entries()) {
      completed.push({ process: process.id, step: index + 1, ...await runStep(context, directory, process, step) });
    }
    return { completed, execution: 'completed', automaticRetry: false, publication: 'not-authorized' };
  } catch (cause) {
    throw processFailure(cause, directory, completed);
  }
}
export async function starterProcessOperation(request: Request, context: Context): Promise<Result> {
  const directory = resolve(context.root, stringOption(request.options, 'project') ?? '.');
  const process = stringOption(request.options, 'process'); requireThat(process, 'STARTER_PROCESS', 'Supply --process <id[,id]>; inspect the definition with starters show.');
  const plan = await processPlan(directory, process.split(','));
  if (request.options['dry-run'] || request.options.yes !== true) return result(request.command, { ...plan, requires: '--yes --trust-processes --apply <planHash>; without --apply, --yes trusts the state at run time and cannot detect changes since this review' }, 'planned');
  requireThat(request.options['trust-processes'] === true, 'STARTER_TRUST', 'Review the project and process steps, then explicitly pass --trust-processes.');
  // Like `new --yes`, `--yes` alone plans and runs in one step; only --apply binds an earlier review.
  const reviewed = stringOption(request.options, 'apply');
  const review = reviewed ? 'bound to the --apply plan hash' : 'unbound: planned and run in one step; changes before this run were not compared with an earlier review';
  return result(request.command, { ...await runProcesses(context, directory, process.split(','), reviewed ?? plan.planHash), review }, 'applied');
}
export async function completeDefinition(outcome: Result, request: Request, context: Context): Promise<Result> {
  const data = outcome.data as { summary: { directory: string; recipe: { receiptSha256: string; nextSteps: string[]; run: string[] } } };
  const { directory, recipe } = data.summary;
  if (outcome.status !== 'applied') return { ...outcome, data: { ...data, written: false, next: 'No files or processes changed. Review and apply the plan to create the project.' } };
  if (!recipe.run.length) return { ...outcome, data: { ...data, written: true, nextSteps: recipe.nextSteps } };
  requireThat(request.options['trust-processes'] === true, 'STARTER_TRUST', 'Files were created; processes were not run. Review them and use starters run with --yes --trust-processes.');
  const plan = await processPlan(directory, recipe.run);
  requireThat(plan.receiptSha256 === recipe.receiptSha256, 'PLAN_STALE', 'The generated process receipt changed.');
  // Before optional first run, confirm that generated files still match the reviewed boilerplate.
  const receipt = record(parseJsonData((await readBounded(join(directory, receiptFile))).toString('utf8')));
  const generated = array(receipt.files, 'files', 5000).map(raw => { const item = record(raw); return { path: text(item.path, 'path', 500), sha256: text(item.sha256, 'sha256') }; });
  await createFilePlan(directory, generated.map(file => ({ path: file.path, content: null })));
  for (const file of generated) requireThat(hash(await readBounded(join(directory, file.path), 8_000_000)) === file.sha256, 'PLAN_STALE', 'Generated files changed before first run.');
  return { ...outcome, data: { ...data, written: true, processes: await runProcesses(context, directory, recipe.run, plan.planHash), nextSteps: recipe.nextSteps } };
}
