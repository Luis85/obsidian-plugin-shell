import { spawn, type SpawnOptions } from 'node:child_process';

export type RunNodeError = Error & {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
};

export function runNode(path: string, args: readonly string[] = [], options: SpawnOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path, ...args], { cwd: process.cwd(), stdio: 'inherit', ...options });
    const stop = () => { child.kill('SIGTERM'); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      process.removeListener('SIGINT', stop);
      process.removeListener('SIGTERM', stop);
      if (code === 0) {
        resolve();
        return;
      }
      const error = new Error(`Command failed (${code ?? 'signal'}): ${path}`) as RunNodeError;
      error.exitCode = code;
      error.signal = signal;
      reject(error);
    });
  });
}
