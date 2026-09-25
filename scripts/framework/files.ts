import { open, lstat, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createFilePlan } from '../shared/file-plan.mjs';
import { parseJsonData } from '../contracts/json-data.mjs';
import { configuration, configFile, type Configuration } from './configuration.ts';
import { requireThat, OperationError } from './contracts.ts';
export const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
export async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
/** Refuse links in every supplied ancestor, not only the opened final file. */
export async function readBounded(path: string, maxBytes = 1_048_576): Promise<Buffer> {
  path = resolve(path);
  for (let parent = path; ; parent = dirname(parent)) {
    const stat = await lstat(parent);
    requireThat(!stat.isSymbolicLink(), 'INPUT_LINK', 'Refusing a symlink in an input path.');
    if (parent === dirname(parent)) break;
  }
  const before = await lstat(path);
  requireThat(before.isFile() && before.size <= maxBytes, 'INPUT_LIMIT', 'Expected a bounded regular input file.');
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const stat = await handle.stat();
    requireThat(stat.isFile() && stat.dev === before.dev && stat.ino === before.ino, 'INPUT_CHANGED', 'Input changed while opening.');
    const buffer = Buffer.alloc(Math.min(maxBytes, stat.size) + 1); let size = 0;
    while (size < buffer.length) { const next = await handle.read(buffer, size, buffer.length - size, null); if (!next.bytesRead) break; size += next.bytesRead; }
    requireThat(size <= maxBytes, 'INPUT_LIMIT', 'Input exceeds its limit.');
    const after = await handle.stat();
    requireThat(size === stat.size && after.size === stat.size && after.mtimeMs === stat.mtimeMs, 'INPUT_CHANGED', 'Input changed while reading.');
    return buffer.subarray(0, size);
  } finally { await handle.close(); }
}
export async function readJson(path: string): Promise<unknown> {
  return parseJsonData(new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(path)));
}
export async function readConfiguration(root: string): Promise<Configuration | null> {
  if (!await exists(join(root, configFile))) return null;
  await createFilePlan(root, [{ path: configFile, content: null }]);
  return configuration(await readJson(join(root, configFile)));
}
export async function projectRoot(start: string, explicit = false): Promise<string> {
  let root = resolve(start);
  if (explicit) { root = await realpath(root); await createFilePlan(root, []); return root; }
  while (true) {
    if (await exists(join(root, configFile)) || await exists(join(root, 'shell.mjs'))) {
      root = await realpath(root); await createFilePlan(root, []); return root;
    }
    const parent = dirname(root);
    if (parent === root) throw new OperationError('PROJECT_NOT_FOUND', 'No shell project found.', 'Use --root to select an extracted kit or project folder.');
    root = parent;
  }
}
