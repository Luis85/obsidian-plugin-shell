import type { Stats } from 'node:fs';
import { lstat } from 'node:fs/promises';

function errorCode(error: unknown): string | undefined {
  return error !== null && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

/** Preserve lstat semantics: a symlink (including a broken link) is present. */
export async function statIfPresent(path: string): Promise<Stats | null> {
  try { return await lstat(path); }
  catch (error) { if (errorCode(error) === 'ENOENT') return null; throw error; }
}

export async function exists(path: string): Promise<boolean> {
  return (await statIfPresent(path)) !== null;
}
