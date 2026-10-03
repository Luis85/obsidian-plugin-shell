import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';

export type NodeProcessFailureKind = 'start' | 'cancelled' | 'timeout' | 'progress' | 'exit';

export interface NodeProcessResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  truncated: boolean;
  stdout: string;
}

export interface NodeProcessOptions {
  spawnOptions?: SpawnOptions;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  outputLimit?: number;
  onOutput?: (text: string) => void;
  terminate?: (child: ChildProcess, signal: NodeJS.Signals) => void;
  captureOutput?: boolean;
  forwardParentSignals?: boolean;
}

export class NodeProcessFailure extends Error {
  readonly kind: NodeProcessFailureKind;
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly truncated: boolean;
  readonly stdout: string;

  constructor(kind: NodeProcessFailureKind, path: string, result: NodeProcessResult, cause?: unknown) {
    super(kind === 'start' && cause instanceof Error ? cause.message : `Node process ${kind}: ${path}`, cause === undefined ? undefined : { cause });
    this.name = 'NodeProcessFailure';
    this.kind = kind;
    this.exitCode = result.exitCode;
    this.signal = result.signal;
    this.truncated = result.truncated;
    this.stdout = result.stdout;
  }
}

/** The single Node-script spawn lifecycle used by framework and compatibility callers. */
export function runNodeProcess(path: string, args: readonly string[] = [], options: NodeProcessOptions = {}): Promise<NodeProcessResult> {
  return new Promise((resolve, reject) => {
    const capture = options.captureOutput === true;
    const spawnOptions: SpawnOptions = {
      cwd: process.cwd(),
      ...options.spawnOptions,
      ...(capture ? { stdio: ['ignore', 'pipe', 'pipe'] } : {}),
    };
    let child: ChildProcess;
    try {
      child = spawn(process.execPath, [path, ...args], spawnOptions);
    } catch (error) {
      reject(new NodeProcessFailure('start', path, { exitCode: null, signal: null, truncated: false, stdout: '' }, error));
      return;
    }

    const terminate = options.terminate ?? ((processToStop: ChildProcess, signal: NodeJS.Signals) => { processToStop.kill(signal); });
    const outputLimit = options.outputLimit ?? 1_048_576;
    const decoder = new StringDecoder('utf8');
    let captured = '';
    let size = 0;
    let truncated = false;
    let reason: Exclude<NodeProcessFailureKind, 'start' | 'exit'> | null = null;
    let killTimer: NodeJS.Timeout | undefined;
    let timer: NodeJS.Timeout | undefined;
    let settled = false;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      options.abortSignal?.removeEventListener('abort', abort);
      if (options.forwardParentSignals) {
        process.removeListener('SIGINT', parentStop);
        process.removeListener('SIGTERM', parentStop);
      }
    };
    const fail = (kind: NodeProcessFailureKind, code: number | null, signal: NodeJS.Signals | null, cause?: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new NodeProcessFailure(kind, path, { exitCode: code, signal, truncated, stdout: captured + decoder.end() }, cause));
    };
    const stop = (kind: Exclude<NodeProcessFailureKind, 'start' | 'exit'>) => {
      if (settled || reason) return;
      reason = kind;
      terminate(child, 'SIGTERM');
      killTimer = setTimeout(() => terminate(child, 'SIGKILL'), 3000);
      killTimer.unref();
    };
    const abort = () => stop('cancelled');
    const parentStop = () => terminate(child, 'SIGTERM');
    const output = (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      size += chunk.length;
      try {
        if (size <= outputLimit) options.onOutput?.(text);
        else if (!truncated) {
          truncated = true;
          options.onOutput?.('\n[child output limit reached]\n');
        }
      } catch {
        stop('progress');
      }
    };

    if (capture) {
      if (!child.stdout || !child.stderr) {
        fail('start', null, null, new Error('Captured Node process did not expose output streams.'));
        return;
      }
      child.stdout.on('data', (chunk: Buffer) => {
        if (size + chunk.length <= outputLimit) captured += decoder.write(chunk);
        output(chunk);
      });
      child.stderr.on('data', output);
    }

    if (options.timeoutMs !== undefined) {
      timer = setTimeout(() => stop('timeout'), options.timeoutMs);
      timer.unref();
    }
    options.abortSignal?.addEventListener('abort', abort, { once: true });
    if (options.forwardParentSignals) {
      process.once('SIGINT', parentStop);
      process.once('SIGTERM', parentStop);
    }
    if (options.abortSignal?.aborted) abort();

    child.once('error', error => fail('start', null, null, error));
    child.once('close', (code, signal) => {
      if (settled) return;
      if (reason) {
        fail(reason, code, signal);
        return;
      }
      if (code !== 0) {
        fail('exit', code, signal);
        return;
      }
      settled = true;
      cleanup();
      resolve({ exitCode: code, signal, truncated, stdout: captured + decoder.end() });
    });
  });
}

type RunNodeError = Error & {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
};

/** Legacy low-level shape retained while JavaScript callers migrate. */
export async function runNodeScript(path: string, args: readonly string[] = [], options: SpawnOptions = {}): Promise<void> {
  try {
    await runNodeProcess(path, args, {
      spawnOptions: { cwd: process.cwd(), stdio: 'inherit', ...options },
      forwardParentSignals: true,
    });
  } catch (error) {
    if (!(error instanceof NodeProcessFailure)) throw error;
    if (error.kind === 'start' && error.cause instanceof Error) throw error.cause;
    const failure = new Error(`Command failed (${error.exitCode ?? 'signal'}): ${path}`) as RunNodeError;
    failure.exitCode = error.exitCode;
    failure.signal = error.signal;
    throw failure;
  }
}
