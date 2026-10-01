/** Optional Storybook lifecycle. Generation never installs packages or authorizes execution. */
import { join } from 'node:path';
import { parseAuthoringDocument } from '../../../scripts/companion/authoring-contract.ts';
import { storybookOptions } from '../../../scripts/companion/tooling-contract.ts';
import { dependencyReadiness } from '../../../scripts/compiler/adapters/dependencies.ts';
import { exists, readBounded } from './files.ts';
import { npmEntry, runNode } from './process.ts';
import { result, requireThat, stringOption, type Request, type Context, type Result } from './contracts.ts';
export interface StorybookExecutor { run: typeof runNode; npm: typeof npmEntry }
const defaultExecutor: StorybookExecutor = { run: runNode, npm: npmEntry };
const workspace = 'storybook';
const telemetry = { STORYBOOK_DISABLE_TELEMETRY: 'true', STORYBOOK_ENABLE_CRASH_REPORTS: '0' };
async function readText(root: string, path: string): Promise<string> {
  return new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(join(root, path), 8_000_000));
}
async function designOptions(context: Context) {
  if (!await exists(join(context.root, 'design/project.json'))) return { enabled: false, generateStories: false };
  return storybookOptions(parseAuthoringDocument(await readText(context.root, 'design/project.json')));
}
async function optionalText(context: Context, path: string): Promise<string | null> {
  return await exists(join(context.root, path)) ? readText(context.root, path) : null;
}
function lockState(lock: string | null, dependencies: ReturnType<typeof dependencyReadiness> | null): 'ready' | 'mismatch' | 'absent' {
  if (!lock) return 'absent';
  return dependencies?.ready ? 'ready' : 'mismatch';
}
async function inspect(context: Context) {
  const options = await designOptions(context);
  const configuration = await exists(join(context.root, workspace, 'package.json'));
  // Checking a regular manifest also refuses a symlinked workspace before npm can write into it.
  const manifest = configuration ? await readText(context.root, workspace + '/package.json') : null;
  const lock = await optionalText(context, workspace + '/package-lock.json');
  const dependencies = manifest && lock ? dependencyReadiness([
    { path: 'package.json', content: manifest, ownership: 'managed' },
    { path: 'package-lock.json', content: lock, ownership: 'extension' },
  ]) : null;
  const binaryPresent = await exists(join(context.root, workspace, 'node_modules/storybook/dist/bin/dispatcher.js'));
  return { ...options, configuration, lock: lockState(lock, dependencies),
    installation: binaryPresent ? 'present-unverified' : 'not-installed', publication: 'not-requested', dependencies };
}
type Status = Awaited<ReturnType<typeof inspect>>;
const commands = ['storybook status', 'storybook install', 'storybook check', 'storybook dev', 'storybook build'];
/** The tool, its arguments and its entry point for one execution command. */
function commandArgs(command: string, status: Status): string[] {
  if (command === 'storybook install') return [status.lock === 'absent' ? 'install' : 'ci', '--no-fund'];
  if (command === 'storybook check') return ['--noEmit', '--project', 'storybook/tsconfig.json'];
  if (command === 'storybook dev') return ['dev', '--config-dir', 'storybook/.storybook', '--host', '127.0.0.1', '--port', '6006', '--ci', '--no-open'];
  return ['build', '--config-dir', 'storybook/.storybook', '--output-dir', 'storybook/storybook-static'];
}
function toolName(command: string): string {
  if (command === 'storybook install') return 'npm';
  return command === 'storybook check' ? 'vue-tsc' : 'storybook';
}
async function entryPoint(command: string, executor: StorybookExecutor): Promise<string> {
  if (command === 'storybook install') return executor.npm();
  return command === 'storybook check' ? 'storybook/node_modules/vue-tsc/bin/vue-tsc.js' : 'storybook/node_modules/storybook/dist/bin/dispatcher.js';
}
function reviewData(request: Request, status: Status) {
  const install = request.command === 'storybook install';
  return { ...status, command: toolName(request.command), args: commandArgs(request.command, status),
    cwd: install ? workspace : '.', telemetry: 'disabled', execution: 'not-run',
    ...(install ? { requires: '--yes', firstInstall: status.lock === 'absent', effects: 'Optional dependencies and their reviewed lifecycle scripts; commit and review the resolved optional lockfile.' } : {}) };
}
const defaultTimeout = (command: string) => command === 'storybook dev' ? '3600000' : '600000';
function checkGenerated(status: Status): void {
  requireThat(status.enabled, 'STORYBOOK_DISABLED', 'Storybook is disabled. Set tooling.storybook.enabled to true (or generate --storybook on), review and regenerate first.');
  requireThat(status.configuration, 'STORYBOOK_GENERATION_REQUIRED', 'Regenerate the enabled optional Storybook workspace before running it.');
}
function checkRunnable(request: Request, status: Status): void {
  requireThat(status.lock !== 'mismatch', 'STORYBOOK_LOCK_MISMATCH', 'Optional dependency pins differ from the optional lockfile. Review and resolve storybook/package-lock.json before execution.');
  if (request.command === 'storybook install') return;
  requireThat(status.lock === 'ready' && status.installation === 'present-unverified', 'STORYBOOK_INSTALL_REQUIRED', 'Run storybook install --yes explicitly before this operation. Root dependencies must also be installed separately.');
}
/** Explicit executor injection is used only for process-boundary contract tests. */
export async function storybookOperation(request: Request, context: Context, executor: StorybookExecutor = defaultExecutor): Promise<Result> {
  requireThat(commands.includes(request.command), 'STORYBOOK_COMMAND_UNKNOWN', 'Unknown Storybook command.');
  requireThat(!context.signal?.aborted, 'CANCELLED', 'Operation cancelled.');
  const status = await inspect(context);
  if (request.command === 'storybook status') return result(request.command, status);
  checkGenerated(status);
  const install = request.command === 'storybook install';
  const review = reviewData(request, status);
  if (request.options['dry-run'] || install && request.options.yes !== true) return result(request.command, review, 'planned');
  checkRunnable(request, status);
  const entry = await entryPoint(request.command, executor);
  const timeout = Number(stringOption(request.options, 'timeout') ?? defaultTimeout(request.command));
  const execution = await executor.run(install ? { ...context, root: join(context.root, workspace) } : context, entry, review.args, timeout, telemetry);
  return result(request.command, { ...review, execution, productAcceptance: 'not-inferred', ...(install ? { statusAfter: await inspect(context) } : {}) }, install ? 'applied' : 'ok');
}
