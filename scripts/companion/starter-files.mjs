/** Exact local catalog loading for tooling. Never fetch URLs or execute starter code. */
import { readFile, lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateStarterCatalog } from './starter-contract.mjs';
export async function loadStarterCatalog(root) {
  const folder = join(root, 'docs/concepts/companion/starters');
  const manifest = JSON.parse(await readFile(join(folder, 'catalog.json'), 'utf8'));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.starters) || manifest.starters.length > 24) throw Error('STARTER_INVALID: Unsupported catalog.');
  const expected = new Set(['catalog.json']);
  for (const entry of manifest.starters) {
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(entry.id) || entry.file !== entry.id + '.companion.json' || expected.has(entry.file)) throw Error('STARTER_INVALID: Unsafe or duplicate source.');
    expected.add(entry.file);
    const file = join(folder, entry.file), stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1_000_000) throw Error('STARTER_INVALID: Nonregular or oversized source.');
    const raw = await readFile(file);
    if (createHash('sha256').update(raw).digest('hex') !== entry.sha256) throw Error('STARTER_INVALID: Source integrity mismatch.');
    entry.document = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(raw));
  }
  const actual = await readdir(folder);
  if (actual.length !== expected.size || actual.some(name => !expected.has(name))) throw Error('STARTER_INVALID: Source inventory differs.');
  return validateStarterCatalog(manifest);
}
