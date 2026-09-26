import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { OperationError, requireThat } from './contracts.ts';
/** Own only this read's listeners. Cancellation never waits for an upstream EOF. */
export function readInput(input: Readable, signal?: AbortSignal, limit = 4_000_000): Promise<string> {
  return new Promise((accept, reject) => {
    const chunks: Buffer[] = []; let size = 0, finished = false;
    const finish = (error?: Error) => {
      if (finished) return; finished = true;
      input.pause(); input.removeListener('data', data); input.removeListener('end', end);
      input.removeListener('error', failed); input.removeListener('close', closed);
      signal?.removeEventListener('abort', cancelled);
      if (error) { reject(error); return; }
      try { accept(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
      catch { reject(new OperationError('INPUT_ENCODING', 'Input must be valid UTF-8.')); }
    };
    const cancelled = () => finish(new OperationError('CANCELLED', 'Input cancelled; no changes were applied.'));
    const closed = () => finish(new OperationError('INPUT_CLOSED', 'Input closed before the complete document arrived.'));
    const failed = (error: Error) => finish(error);
    const end = () => finish();
    const data = (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += buffer.length;
      if (size > limit) finish(new OperationError('INPUT_LIMIT', 'Input exceeds its byte limit.'));
      else chunks.push(buffer);
    };
    if (signal?.aborted) { cancelled(); return; }
    input.on('data', data); input.once('end', end); input.once('error', failed); input.once('close', closed);
    signal?.addEventListener('abort', cancelled, { once: true });
    if (input.readableEnded) end(); else if (input.destroyed) closed(); else input.resume();
  });
}
/** EOF, terminal Ctrl-C and external cancellation all settle the prompt. */
export function ask(input: Readable, output: Writable, query: string, signal?: AbortSignal): Promise<string> {
  requireThat(!signal?.aborted, 'CANCELLED', 'Prompt cancelled.');
  const prompt = createInterface({ input, output, terminal: Boolean((output as Writable & { isTTY?: boolean }).isTTY) });
  return new Promise((accept, reject) => {
    let finished = false;
    const finish = (answer?: string) => {
      if (finished) return; finished = true;
      prompt.removeListener('close', cancel); prompt.removeListener('SIGINT', cancel);
      signal?.removeEventListener('abort', cancel); prompt.close();
      if (answer === undefined) reject(new OperationError('CANCELLED', 'Prompt cancelled; the pending step was not applied.'));
      else accept(answer);
    };
    const cancel = () => finish();
    prompt.once('close', cancel); prompt.once('SIGINT', cancel);
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel(); else prompt.question(query, answer => finish(answer));
  });
}
