import { lstat, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { OperationError, type Request } from './contracts.ts';

export const isAdoptCommand = (command: string): boolean => command.startsWith('adopt ');
/**
 * `adopt` works on any folder, not only a configured shell project. The target comes from --target, then --root, then the
 * current directory; it becomes the operation root. --report and the analyze --out path resolve from the invoking shell,
 * while `adopt plan --out` stays relative to the target.
 */
export async function adoptInvocation(request: Request, cwd = process.cwd()): Promise<{ request: Request; root: string }> {
  const { target, root: selected, ...options } = request.options;
  const requested = resolve(cwd, typeof target === 'string' ? target : typeof selected === 'string' ? selected : '.');
  let root: string;
  try {
    root = await realpath(requested);
    if (!(await lstat(root)).isDirectory()) throw new Error('not a directory');
  } catch {
    throw new OperationError('TARGET_NOT_FOUND', 'The adoption target must be an existing folder.', 'Pass --target <project folder>.');
  }
  if (typeof options.report === 'string') options.report = resolve(cwd, options.report);
  if (request.command === 'adopt analyze' && typeof options.out === 'string') options.out = resolve(cwd, options.out);
  return { request: { ...request, options }, root };
}
