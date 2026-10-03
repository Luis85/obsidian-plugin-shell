import { existsSync } from 'node:fs';
import { readdir, lstat } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNodeScript as runNode } from '../shared/process.ts';

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
  if ((await readdir(root)).includes('bin')) await visit(resolve(root, 'bin'));
  if ((await readdir(root)).includes('plugins')) await visit(resolve(root, 'plugins'));
  // Companion runtime templates become generated plugin source; a generated project may not carry them.
  if (existsSync(resolve(root, 'templates/companion/runtime'))) await visit(resolve(root, 'templates/companion/runtime'));
  files.sort();
  if (!files.length) throw new Error('LINT_SOURCE_EMPTY');
  // The project's own rules win; a bare source tree (archive probe) uses this framework's reviewed rules.
  const config = [join(root, 'configs/lint/oxlintrc.json'), fileURLToPath(new URL('../../configs/lint/oxlintrc.json', import.meta.url))].find(path => existsSync(path));
  if (!config) throw new Error('LINT_SOURCE_CONFIG_MISSING');
  for (let offset = 0; offset < files.length; offset += 100) {
    await runNode(tool, ['-c', config, ...files.slice(offset, offset + 100), '--no-ignore', '--deny-warnings'], { cwd: root });
  }
  return { status: 'passed', files: files.length, scope: 'every owned src/bin/plugins/templates/companion/runtime JS/TS/Vue input, explicit paths' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { if (process.argv.length !== 2) throw new Error('NO_ARGUMENTS_SUPPORTED'); console.log(JSON.stringify(await lintOwnedSource())); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
