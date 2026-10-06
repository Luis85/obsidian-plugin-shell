import { existsSync } from 'node:fs';
import { readdir, lstat } from 'node:fs/promises';
import { resolve, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNodeProcess } from '../../src/shared/platform/process.ts';

/** The reviewed rules of the repository that owns this script; a project runs its own copy, so both always match. */
const config = fileURLToPath(new URL('../../configs/lint/oxlintrc.json', import.meta.url));

/** Explicit file arguments prevent an ignored archive ancestor from hiding its src tree. `only` (repository-relative
 * paths) narrows the run to those owned inputs, as `check --fast` does for changed files; the default is every input. */
export async function lintOwnedSource(root = process.cwd(), tool = resolve(root, 'node_modules/oxlint/bin/oxlint'), only = null) {
  const files = [];
  async function visit(path) {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error('LINT_SOURCE_SYMLINK');
    if (stat.isDirectory()) {
      for (const entry of await readdir(path)) await visit(join(path, entry));
    } else if (stat.isFile() && /\.(?:[cm]?[jt]sx?|vue)$/.test(path)) files.push(relative(root, path));
  }
  await visit(resolve(root, 'src'));
  // CLI development lives under src/cli, already included above; build:cli verifies the generated bin inventory.
  if ((await readdir(root)).includes('src/cli/sdk')) await visit(resolve(root, 'src/cli/sdk'));
  // Companion runtime templates become generated plugin source; a generated project may not carry them.
  if (existsSync(resolve(root, 'templates/companion/runtime'))) await visit(resolve(root, 'templates/companion/runtime'));
  files.sort();
  if (!files.length) throw new Error('LINT_SOURCE_EMPTY');
  if (only) {
    const wanted = new Set(only), owned = files.filter(file => wanted.has(file.split(sep).join('/')));
    files.splice(0, files.length, ...owned);
    if (!files.length) return { status: 'passed', files: 0, scope: 'none of the requested files is an owned src/plugins/templates/companion/runtime input' };
  }
  if (!existsSync(config)) throw new Error('LINT_SOURCE_CONFIG_MISSING');
  for (let offset = 0; offset < files.length; offset += 100) {
    await runNodeProcess(tool, ['-c', config, ...files.slice(offset, offset + 100), '--no-ignore', '--deny-warnings'],
      { spawnOptions: { cwd: root, stdio: 'inherit' }, forwardParentSignals: true });
  }
  return { status: 'passed', files: files.length, scope: only ? 'the requested owned src/plugins/templates/companion/runtime inputs, explicit paths' : 'every owned src/plugins/templates/companion/runtime JS/TS/Vue input, explicit paths' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const only = process.argv.slice(2);
    if (only.some(file => file.startsWith('-'))) throw new Error('NO_OPTIONS_SUPPORTED');
    console.log(JSON.stringify(await lintOwnedSource(process.cwd(), undefined, only.length ? only : null)));
  }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
