/** Optional Storybook lifecycle. Generation never installs packages or authorizes execution. */
import { join } from 'node:path';
import { parseAuthoringDocument } from '../companion/authoring-contract.ts';
import { storybookOptions } from '../companion/tooling-contract.ts';
import { dependencyReadiness } from '../compiler/adapters/dependencies.ts';
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
async function inspect(context: Context) {
  const path = join(context.root, 'design/project.json');
  const options = await exists(path) ? storybookOptions(parseAuthoringDocument(await readText(context.root, 'design/project.json'))) : { enabled: false, generateStories: false };
  const configuration = await exists(join(context.root, workspace, 'package.json'));
  // Checking a regular manifest also refuses a symlinked workspace before npm can write into it.
  const manifest = configuration ? await readText(context.root, workspace + '/package.json') : null;
  const lockExists = await exists(join(context.root, workspace, 'package-lock.json'));
  const lock = lockExists ? await readText(context.root, workspace + '/package-lock.json') : null;
  const dependencies = manifest && lock ? dependencyReadiness([
    { path: 'package.json', content: manifest, ownership: 'managed' },
    { path: 'package-lock.json', content: lock, ownership: 'extension' },
  ]) : null;
  const binaryPresent = await exists(join(context.root, workspace, 'node_modules/storybook/dist/bin/dispatcher.js'));
  return { ...options, configuration, lock: lock ? dependencies?.ready ? 'ready' : 'mismatch' : 'absent',
    installation: binaryPresent ? 'present-unverified' : 'not-installed', publication: 'not-requested', dependencies };
}
/** Explicit executor injection is used only for process-boundary contract tests. */
export async function storybookOperation(request: Request, context: Context, executor: StorybookExecutor = defaultExecutor): Promise<Result> {
  requireThat(['storybook status', 'storybook install', 'storybook check', 'storybook dev', 'storybook build'].includes(request.command), 'STORYBOOK_COMMAND_UNKNOWN', 'Unknown Storybook command.');
  requireThat(!context.signal?.aborted, 'CANCELLED', 'Operation cancelled.');
  const status = await inspect(context);
  if (request.command === 'storybook status') return result(request.command, status);
  requireThat(status.enabled, 'STORYBOOK_DISABLED', 'Storybook is disabled. Set tooling.storybook.enabled to true (or generate --storybook on), review and regenerate first.');
  requireThat(status.configuration, 'STORYBOOK_GENERATION_REQUIRED', 'Regenerate the enabled optional Storybook workspace before running it.');
  const install = request.command === 'storybook install';
  const args = install ? [status.lock === 'absent' ? 'install' : 'ci', '--no-fund'] : request.command === 'storybook check' ? ['--noEmit', '--project', 'storybook/tsconfig.json'] : [
    request.command === 'storybook dev' ? 'dev' : 'build', '--config-dir', 'storybook/.storybook',
    ...(request.command === 'storybook dev' ? ['--host', '127.0.0.1', '--port', '6006', '--ci', '--no-open'] : ['--output-dir', 'storybook/storybook-static']),
  ];
  const review = { ...status, command: install ? 'npm' : request.command === 'storybook check' ? 'vue-tsc' : 'storybook', args,
    cwd: install ? workspace : '.', telemetry: 'disabled', execution: 'not-run',
    ...(install ? { requires: '--yes', firstInstall: status.lock === 'absent', effects: 'Optional dependencies and their reviewed lifecycle scripts; commit and review the resolved optional lockfile.' } : {}) };
  if (request.options['dry-run'] || install && request.options.yes !== true) return result(request.command, review, 'planned');
  requireThat(status.lock !== 'mismatch', 'STORYBOOK_LOCK_MISMATCH', 'Optional dependency pins differ from the optional lockfile. Review and resolve storybook/package-lock.json before execution.');
  if (!install) requireThat(status.lock === 'ready' && status.installation === 'present-unverified', 'STORYBOOK_INSTALL_REQUIRED', 'Run storybook install --yes explicitly before this operation. Root dependencies must also be installed separately.');
  const entry = install ? await executor.npm() : request.command === 'storybook check'
    ? 'storybook/node_modules/vue-tsc/bin/vue-tsc.js' : 'storybook/node_modules/storybook/dist/bin/dispatcher.js';
  const timeout = Number(stringOption(request.options, 'timeout') ?? (request.command === 'storybook dev' ? '3600000' : '600000'));
  const execution = await executor.run(install ? { ...context, root: join(context.root, workspace) } : context, entry, args, timeout, telemetry);
  return result(request.command, { ...review, execution, productAcceptance: 'not-inferred', ...(install ? { statusAfter: await inspect(context) } : {}) }, install ? 'applied' : 'ok');
}
