import { lstat } from 'node:fs/promises';

/** Preserve lstat semantics: a symlink (including a broken link) is present. */
export async function statIfPresent(path) {
  try { return await lstat(path); }
  catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
}
export async function exists(path) { return (await statIfPresent(path)) !== null; }
