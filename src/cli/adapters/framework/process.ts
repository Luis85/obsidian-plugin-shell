import { terminateProcessTree } from './process-tree.ts';
import { delimiter, dirname, join, resolve } from 'node:path';
import { realpath } from 'node:fs/promises';
import { exists } from './files.ts';
import { requireThat, OperationError, type Context } from './contracts.ts';
import { projectInstallEnvironment } from '#shared/platform/npm-install.mjs';
import { NodeProcessFailure, runNodeProcess } from '#shared/platform/process.ts';
/** npm entries found on PATH; a Windows npm.cmd shim maps to the npm-cli.js beside it. */
async function pathNpmEntries(): Promise<string[]> {
  const found: string[] = [];
  for (const folder of (process.env.PATH ?? '').split(delimiter).filter(Boolean)) {
    const candidate = join(folder, process.platform === 'win32' ? 'npm.cmd' : 'npm');
    if (!await exists(candidate)) continue;
    const path = await realpath(candidate);
    found.push(path.endsWith('.cmd') ? join(dirname(path), 'node_modules/npm/bin/npm-cli.js') : path);
  }
  return found;
}
export async function npmEntry(): Promise<string> {
  const explicit = process.env.QUALIFIED_NPM ?? process.env.npm_execpath;
  if (explicit) { const path = resolve(explicit); requireThat(await exists(path), 'NPM_MISSING', 'Selected npm entry does not exist.'); return path; }
  const candidates = [join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), join(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'), ...await pathNpmEntries()];
  for (const path of candidates) if (await exists(path)) return realpath(path);
  throw new OperationError('NPM_MISSING', 'No npm installation found.', 'Install the qualified Node/npm toolchain or explicitly set QUALIFIED_NPM to npm-cli.js.');
}
/** Executes an argument array without a command shell; output cannot enter the result channel. */
export async function runNode(context: Context, entry: string, args: readonly string[], timeout = 600_000, environment: Record<string, string | undefined> = {}) {
  requireThat(Number.isSafeInteger(timeout) && timeout > 0 && timeout <= 3_600_000, 'INVALID_TIMEOUT', 'Timeout must be 1..3600000 milliseconds.');
  requireThat(!context.signal?.aborted, 'CANCELLED', 'Operation cancelled before execution.');
  const file = resolve(context.root, entry);
  requireThat(await exists(file), 'TOOL_MISSING', `Required tool is not installed: ${entry}.`);
  try {
    const execution = await runNodeProcess(file, args, {
      spawnOptions: {
        cwd: context.root,
        shell: false,
        windowsHide: true,
        detached: process.platform !== 'win32',
        env: { ...projectInstallEnvironment().env, ...environment },
      },
      timeoutMs: timeout,
      abortSignal: context.signal,
      outputLimit: 1_048_576,
      onOutput: text => context.progress?.(text),
      terminate: terminateProcessTree,
      captureOutput: true,
    });
    return { exitCode: execution.exitCode ?? 0, signal: execution.signal, truncated: execution.truncated, stdout: execution.stdout };
  } catch (error) {
    throw processFailure(error);
  }
}
const failureCodes: Partial<Record<NodeProcessFailure['kind'], string>> = { cancelled: 'CANCELLED', timeout: 'TIMEOUT', progress: 'PROGRESS_FAILED' };
/** Maps the shared process primitive's failure into the public, bounded operation error. */
function processFailure(error: unknown): unknown {
  if (!(error instanceof NodeProcessFailure)) return error;
  if (error.kind === 'start') return new OperationError('PROCESS_START_FAILED', error.message);
  const message = error.kind === 'exit'
    ? `Process exited with ${error.exitCode ?? error.signal}; inspect stderr. Completed effects are preserved.`
    : 'Process stopped. Completed external effects are not rolled back.';
  const failure = new OperationError(failureCodes[error.kind] ?? 'PROCESS_FAILED', message);
  failure.details = {
    execution: {
      exitCode: error.exitCode,
      signal: error.signal,
      truncated: error.truncated,
      stdout: error.stdout,
      effects: 'preserved-or-uncertain; not rolled back',
    },
    automaticRetry: false,
  };
  return failure;
}
