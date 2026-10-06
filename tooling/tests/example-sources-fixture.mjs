import { readFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Framework-maintainer checks that pack or remove the reviewed showcase need its
 * original sources. After `examples:remove` every delete-only example file is
 * gone and no reviewed preimage remains to exercise. A partial or edited
 * showcase still counts as present so those checks fail rather than skip.
 */
export async function reviewedExamplesRemoved(root) {
  const ownership = JSON.parse(await readFile(join(root, 'scripts/examples/ownership.json'), 'utf8'));
  const deleted = ownership.files.filter(file => typeof file.sha256 === 'string' && !Object.hasOwn(file, 'template'));
  if (!deleted.length) return false;
  for (const file of deleted) {
    try { await lstat(join(root, file.path)); return false; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return true;
}
