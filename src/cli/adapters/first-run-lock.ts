import { mkdir, rmdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { createFilePlan } from '#shared/platform/file-plan.ts';
import { requireSketch } from '#shared/contracts/sketch-errors.ts';
const firstRunLock = '.shell-first-run.lock';
async function absent(root: string, name: string): Promise<boolean> {
  try { await lstat(join(root, name)); return false; }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return true; throw error; }
}
export async function assertNoFirstRun(root: string): Promise<void> {
  requireSketch(await absent(root, firstRunLock), 'FIRST_RUN_BUSY', 'A first run or unresolved interruption owns .shell-first-run.lock. Stop that run before editing; never delete a live lock.');
}
export async function claimFirstRun(root: string): Promise<() => Promise<void>> {
  await createFilePlan(root, []);
  await assertNoFirstRun(root);
  await mkdir(join(root, firstRunLock));
  const owner = await lstat(join(root, firstRunLock));
  async function release() {
    const current = await lstat(join(root, firstRunLock));
    requireSketch(!current.isSymbolicLink() && current.dev === owner.dev && current.ino === owner.ino, 'FIRST_RUN_LOCK_CHANGED', 'Execution lock changed; inspect recovery manually.');
    await rmdir(join(root, firstRunLock));
  }
  if (!await absent(root, '.codex-authoring.lock')) {
    await release(); requireSketch(false, 'FIRST_RUN_BUSY', 'A file writer or unresolved recovery is active. No project process was started.');
  }
  return release;
}
