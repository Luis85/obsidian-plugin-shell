/** Runs one shell invocation with captured, bounded output; never uses a command string built from untrusted text. */
import { spawn } from 'node:child_process';
import { delimiter, join } from 'node:path';
import * as timers from 'node:timers';
import { exists } from './files.ts';
import { terminateProcessTree } from './process-tree.ts';
import type { RunnerOs } from '../../domain/ci-safety.ts';
import type { ShellInvocation } from '../../domain/ci-shell.ts';
export interface ShellRun {
  invocation: ShellInvocation; cwd: string; env: Record<string, string | undefined>; timeoutMs: number; signal?: AbortSignal;
}
export interface ShellExit { exitCode: number | null; signal: NodeJS.Signals | null; output: string; stopped?: 'timeout' | 'cancelled'; startError?: string }
const outputLimit = 65_536;
export function runShell(run: ShellRun): Promise<ShellExit> {
  return new Promise(accept => {
    let output = '', stopped: ShellExit['stopped'], settled = false;
    const finish = (exit: Omit<ShellExit, 'output'>) => {
      if (settled) return;
      settled = true; timers.clearTimeout(timer); run.signal?.removeEventListener('abort', cancel);
      accept({ ...exit, output, ...(stopped ? { stopped } : {}) });
    };
    const child = spawn(run.invocation.file, run.invocation.args, { cwd: run.cwd, env: run.env, shell: false, windowsHide: true,
      detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    const stop = (reason: 'timeout' | 'cancelled') => {
      if (stopped) return;
      stopped = reason; terminateProcessTree(child, 'SIGTERM');
      timers.setTimeout(() => terminateProcessTree(child, 'SIGKILL'), 3000).unref();
    };
    const cancel = () => stop('cancelled');
    const timer = timers.setTimeout(() => stop('timeout'), run.timeoutMs);
    const collect = (chunk: Buffer) => { output = (output + chunk.toString('utf8')).slice(-outputLimit); };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    run.signal?.addEventListener('abort', cancel, { once: true });
    if (run.signal?.aborted) cancel();
    child.once('error', error => finish({ exitCode: null, signal: null, startError: error.message }));
    child.once('close', (exitCode, signal) => finish({ exitCode, signal }));
  });
}
/** The hosted-runner OS name this machine corresponds to. */
export function currentRunnerOs(platform: NodeJS.Platform = process.platform): RunnerOs {
  return platform === 'linux' ? 'Linux' : platform === 'darwin' ? 'macOS' : 'Windows';
}
/** Whether an executable is available on PATH (the shell for a step must exist before any step runs). */
export async function onPath(file: string, searchPath: string = process.env.PATH ?? ''): Promise<boolean> {
  for (const folder of searchPath.split(delimiter).filter(Boolean)) {
    if (await exists(join(folder, file)) || (process.platform === 'win32' && await exists(join(folder, `${file}.exe`)))) return true;
  }
  return false;
}
