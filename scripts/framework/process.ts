import { StringDecoder } from 'node:string_decoder';
import { spawn } from 'node:child_process';
import { delimiter, dirname, join, resolve } from 'node:path';
import { realpath } from 'node:fs/promises';
import { exists } from './files.ts';
import { requireThat, OperationError, type Context } from './contracts.ts';
import { projectInstallEnvironment } from '../shared/npm-install.mjs';
export async function npmEntry(): Promise<string> {
  const explicit = process.env.QUALIFIED_NPM ?? process.env.npm_execpath;
  if (explicit) { const path = resolve(explicit); requireThat(await exists(path), 'NPM_MISSING', 'Selected npm entry does not exist.'); return path; }
  const candidates = [join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), join(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')];
  for (const folder of (process.env.PATH ?? '').split(delimiter)) {
    if (!folder) continue;
    const candidate = join(folder, process.platform === 'win32' ? 'npm.cmd' : 'npm');
    if (await exists(candidate)) {
      const path = await realpath(candidate);
      candidates.push(path.endsWith('.cmd') ? join(dirname(path), 'node_modules/npm/bin/npm-cli.js') : path);
    }
  }
  for (const path of candidates) if (await exists(path)) return realpath(path);
  throw new OperationError('NPM_MISSING', 'No npm installation found.', 'Install the qualified Node/npm toolchain or explicitly set QUALIFIED_NPM to npm-cli.js.');
}
/** Executes an argument array without a command shell; output cannot enter the result channel. */
export async function runNode(context: Context, entry: string, args: readonly string[], timeout = 600_000, environment: Record<string, string> = {}) {
  requireThat(Number.isSafeInteger(timeout) && timeout > 0 && timeout <= 3_600_000, 'INVALID_TIMEOUT', 'Timeout must be 1..3600000 milliseconds.');
  requireThat(!context.signal?.aborted, 'CANCELLED', 'Operation cancelled before execution.');
  const file = resolve(context.root, entry);
  requireThat(await exists(file), 'TOOL_MISSING', `Required tool is not installed: ${entry}.`);
  return new Promise<{ exitCode: number; signal: string | null; truncated: boolean; stdout: string }>((accept, reject) => {
    const child = spawn(process.execPath, [file, ...args], { cwd: context.root, shell: false, windowsHide: true, detached: process.platform !== 'win32',
      env: { ...projectInstallEnvironment().env, ...environment }, stdio: ['ignore', 'pipe', 'pipe'] });
    let captured = ''; const decoder = new StringDecoder('utf8');
    let size = 0, truncated = false, reason: string | null = null, killTimer: NodeJS.Timeout | undefined;
    const output = (chunk: Buffer) => {
      const text = chunk.toString('utf8'); size += chunk.length;
      try {
        if (size <= 1_048_576) context.progress?.(text);
        else if (!truncated) { truncated = true; context.progress?.('\n[child output limit reached]\n'); }
      } catch { stop('PROGRESS_FAILED'); }
    };
    child.stdout.on('data', (chunk: Buffer) => { if (size + chunk.length <= 1_048_576) captured += decoder.write(chunk); output(chunk); });
    child.stderr.on('data', output);
    const terminate = (signal: NodeJS.Signals) => {
      try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal); else child.kill(signal); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') child.kill(signal); }
    };
    const stop = (code: string) => { if (reason) return; reason = code; terminate('SIGTERM'); killTimer = setTimeout(() => terminate('SIGKILL'), 3000); killTimer.unref(); };
    const abort = () => stop('CANCELLED');
    const timer = setTimeout(() => stop('TIMEOUT'), timeout); timer.unref();
    context.signal?.addEventListener('abort', abort, { once: true });
    if (context.signal?.aborted) abort();
    const cleanup = () => { clearTimeout(timer); if (killTimer) clearTimeout(killTimer); context.signal?.removeEventListener('abort', abort); };
    child.once('error', error => { cleanup(); reject(new OperationError('PROCESS_START_FAILED', error.message)); });
    child.once('close', (code, signal) => {
      cleanup(); captured += decoder.end();
      const failure = (diagnostic: string, message: string) => { const error = new OperationError(diagnostic, message); error.details = { execution: { exitCode: code, signal, truncated, stdout: captured, effects: 'preserved-or-uncertain; not rolled back' }, automaticRetry: false }; return error; };
      if (reason) reject(failure(reason, 'Process stopped. Completed external effects are not rolled back.'));
      else if (code !== 0) reject(failure('PROCESS_FAILED', `Process exited with ${code ?? signal}; inspect stderr. Completed effects are preserved.`));
      else accept({ exitCode: code, signal, truncated, stdout: captured });
    });
  });
}
