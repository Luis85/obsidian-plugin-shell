import { copyFile, mkdir, mkdtemp, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { mapBounded } from '../../scripts/shared/bounded-map.ts';

/**
 * Copies a fixture tree of plain folders and files into `target` (merged over what is there), with bounded
 * parallelism: generated packages hold thousands of files. Links and other entries are refused, never followed.
 */
export async function copyTree(source, target) {
  const entries = await readdir(source, { recursive: true, withFileTypes: true }), files = [];
  await mkdir(target, { recursive: true });
  for (const entry of entries) {
    const path = relative(source, join(entry.parentPath, entry.name));
    if (entry.isDirectory()) await mkdir(join(target, path), { recursive: true });
    else if (entry.isFile()) files.push(path);
    else throw new Error('Fixture trees hold only folders and files: ' + path);
  }
  await mapBounded(files, 16, path => copyFile(join(source, path), join(target, path)));
}

/**
 * Expensive fixture trees built at most once per test file and copied into each test's own scratch root.
 * The pristine tree is never handed to a test, so no test observes another test's writes. `after` is the
 * runner's file-level hook (node:test `after`, Vitest `afterAll`); it removes every pristine tree.
 */
export function pristineFixtures(after, prefix = 'pristine-fixture-') {
  const built = new Map(), roots = [];
  after(() => Promise.all(roots.map(root => rm(root, { recursive: true, force: true }))));
  /** Builds `key` once with `build(root)`, then copies the finished tree into `target`. A failed build is retried. */
  return async function copyFixture(key, build, target) {
    if (!built.has(key)) {
      built.set(key, (async () => {
        const root = await mkdtemp(join(await realpath(tmpdir()), prefix));
        roots.push(root);
        await build(root);
        return root;
      })().catch(error => { built.delete(key); throw error; }));
    }
    await copyTree(await built.get(key), target);
  };
}
