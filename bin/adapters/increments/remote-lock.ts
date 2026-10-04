/**
 * Cross-process lock for publishing or syncing one pull request: an exclusive `mkdir` of
 * `<tmp>/workbench-pr-<sha256(root + NUL + id)>.lock`, the pattern of the release publisher. A held lock refuses with
 * PR_SYNC_LOCKED; it is released in `finally` and only when the directory is still the one this process created.
 * A lock left by a crashed run is never removed automatically: the refusal names the path to inspect.
 */
import { lstat, mkdir, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { hash } from '../framework/files.ts';
import { remoteError } from './hosting-target.ts';

export const remoteLockPath = (root: string, id: string, directory = tmpdir()): string =>
  join(directory, `workbench-pr-${hash(`${resolve(root)}\u0000${id}`)}.lock`);

async function acquire(path: string): Promise<() => Promise<void>> {
  try { await mkdir(path, { mode: 0o700 }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    throw remoteError('PR_SYNC_LOCKED', `Another publish or sync of this pull request holds ${path}.`, { uncertain: false, step: 'read' },
      'Wait for the other run to finish. Remove the lock directory only after confirming that no publish or sync is running.');
  }
  const owner = await lstat(path);
  return async () => {
    const current = await lstat(path).catch(() => null);
    if (current && current.isDirectory() && !current.isSymbolicLink() && current.dev === owner.dev && current.ino === owner.ino) await rmdir(path);
  };
}
/** Runs `action` while holding the lock of one pull request; the lock is released even when `action` throws. */
export async function withRemoteLock<T>(root: string, id: string, action: () => Promise<T>, directory?: string): Promise<T> {
  const release = await acquire(remoteLockPath(root, id, directory));
  try { return await action(); } finally { await release(); }
}
