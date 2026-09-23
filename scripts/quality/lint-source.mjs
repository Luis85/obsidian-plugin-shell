import { readdir, lstat } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNode } from '../shared/process.mjs';

/** Explicit file arguments prevent an ignored archive ancestor from hiding its src tree. */
export async function lintOwnedSource(root = process.cwd(), tool = resolve(root, 'node_modules/oxlint/bin/oxlint')) {
  const files = [];
  async function visit(path) {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error('LINT_SOURCE_SYMLINK');
    if (stat.isDirectory()) {
      for (const entry of await readdir(path)) await visit(join(path, entry));
    } else if (stat.isFile() && /\.(?:[cm]?[jt]sx?|vue)$/.test(path)) files.push(relative(root, path));
  }
  await visit(resolve(root, 'src'));
  files.sort();
  if (!files.length) throw new Error('LINT_SOURCE_EMPTY');
  for (let offset = 0; offset < files.length; offset += 100) {
    await runNode(tool, [...files.slice(offset, offset + 100), '--no-ignore', '--deny-warnings'], { cwd: root });
  }
  return { status: 'passed', files: files.length, scope: 'every owned src JS/TS/Vue input, explicit paths' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { if (process.argv.length !== 2) throw new Error('NO_ARGUMENTS_SUPPORTED'); console.log(JSON.stringify(await lintOwnedSource())); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
