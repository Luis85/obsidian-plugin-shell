import { constants } from 'node:fs';
import { open, lstat, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { COMPANION_MAX_BYTES, companionRelativeFolder, parseCompanionDocument } from './project-contract.mjs';

async function checkDirectoryChain(root, path) {
  let current = root;
  for (const part of path === '.' ? [] : path.split('/')) {
    current = join(current, part);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('COMPANION_TARGET: Target contains a link or non-directory.');
    } catch (error) {
      if (error.code === 'ENOENT') return; // A future directory, never created in v1.
      throw error;
    }
  }
}
async function readBoundedJson(input) {
  const before = await lstat(input);
  if (!before.isFile() || before.isSymbolicLink()) throw new Error('COMPANION_INPUT: Expected a regular JSON file, not a link.');
  const file = await open(input, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.ino !== before.ino || stat.dev !== before.dev) throw new Error('COMPANION_INPUT: Input changed before reading.');
    if (stat.size > COMPANION_MAX_BYTES) throw new Error('COMPANION_INPUT: File exceeds 4 MB.');
    const buffer = Buffer.alloc(COMPANION_MAX_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > COMPANION_MAX_BYTES) throw new Error('COMPANION_INPUT: File exceeds 4 MB.');
    const content = buffer.subarray(0, length);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(content);
    const document = parseCompanionDocument(text);
    return { content, document };
  } finally { await file.close(); }
}

/** Read and return a project definition. This v1 seam never generates files. */
export async function readCompanionProject({ input, target, vault = process.cwd() }) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('COMPANION_INPUT: Supply --input <project.json>.');
  if (!companionRelativeFolder(target, true)) throw new Error('COMPANION_TARGET: Use a portable vault-relative --target path, or dot for the vault root.');
  const root = await realpath(resolve(vault));
  if (!(await lstat(root)).isDirectory()) throw new Error('COMPANION_TARGET: The vault root must be an existing directory.');
  await checkDirectoryChain(root, target);
  const result = await readBoundedJson(resolve(input));
  for (const folder of Object.values(result.document.settings)) {
    await checkDirectoryChain(root, target === '.' ? folder : target + '/' + folder);
  }
  return { ...result, vault: root, target: resolve(root, target) };
}
