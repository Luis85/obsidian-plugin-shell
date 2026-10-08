/** Temporary source-project repositories and real `node src/cli/app.ts source …` runs for the source command suites. */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, rmdir, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importAliases, parseSourceManifest, projectTsconfig, testsTsconfig } from '../../domain/source-projects.ts';
import { reconcileSolution } from '../../domain/source-projects-edit.ts';

export const repository = fileURLToPath(new URL('../../../../', import.meta.url));
const app = join(repository, 'src/cli/app.ts');
const json = value => JSON.stringify(value, null, 2) + '\n';
const transient = /UNKNOWN -4094|Resource temporarily unavailable|Could not determine Node\.js install directory|EAGAIN|paging file|1455/;

/** Runs a process once more when Windows reports a transient resource failure; never retries a real result. */
export function run(file, args, options = {}) {
  const once = () => new Promise(accept => execFile(file, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 300_000, windowsHide: true, ...options },
    (error, stdout, stderr) => accept({ status: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr })));
  return once().then(first => first.status !== 0 && !first.stdout && transient.test(first.stderr) ? once() : first);
}
/** `node src/cli/app.ts source <args> --root <root> --json`: exit status and the parsed result. */
export async function source(root, ...args) {
  const outcome = await run(process.execPath, [app, 'source', ...args, '--root', root, '--json']);
  let result;
  try { result = JSON.parse(outcome.stdout); } catch { assert.fail(`source ${args.join(' ')} printed no JSON (exit ${outcome.status}): ${outcome.stderr}${outcome.stdout}`); }
  return { status: outcome.status, result, codes: (result.diagnostics ?? []).map(item => item.code) };
}

export const projects = () => [
  { name: 'shared', kind: 'library', path: 'src/shared', references: [] },
  { name: 'tui', kind: 'library', path: 'src/tui', references: ['shared'] },
  { name: 'cli', kind: 'cli', path: 'src/cli', references: ['shared', 'tui'] },
  { name: 'plugin', kind: 'plugin', path: 'src/plugin', references: ['shared'] },
];
const code = {
  shared: "export const sharedName = (): string => 'shared';\n",
  tui: "import { sharedName } from '#shared/index.ts';\nexport const tuiName = (): string => `tui+${sharedName()}`;\n",
  cli: "import { sharedName } from '#shared/index.ts';\nimport { tuiName } from '#tui/index.ts';\nexport const cliName = (): string => `${sharedName()} ${tuiName()}`;\n",
  plugin: "import { sharedName } from '#shared/index.ts';\nexport const pluginName = (): string => `plugin+${sharedName()}`;\n",
};
const testCode = name => `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport * as project from '../index.ts';\n\ntest('${name} exports', () => {\n  assert.ok(Object.keys(project).length > 0);\n});\n`;
const suites = { schemaVersion: 1, roots: [{ path: 'src/*/tests' }], helperRoots: [], suites: [
  { name: 'unit', purpose: 'Unit tests of the fixture projects.', level: 'unit', runner: { type: 'node-test' }, include: ['src/shared/tests/*.test.ts'], verify: 'opt-in' },
] };

export async function write(root, path, text) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), text);
}
export const read = (root, path) => readFile(join(root, path), 'utf8');
export const readJson = async (root, path) => JSON.parse(await read(root, path));

/** A clean four-project repository whose derived files all match its manifest. */
export async function fixture(t, { manifest = { schemaVersion: 1, projects: projects() }, typecheck = false } = {}) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'source-command-')));
  t.after(async () => {
    // Detach the dependency junction first, so removing the fixture can never reach the repository's node_modules.
    await unlink(join(root, 'node_modules')).catch(() => rmdir(join(root, 'node_modules'))).catch(() => {});
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  });
  const parsed = parseSourceManifest(structuredClone(manifest));
  await write(root, 'workbench.sources.json', json(manifest));
  for (const project of parsed.projects) {
    await write(root, `${project.path}/index.ts`, code[project.name] ?? `export const ${project.name.replace(/-/g, '_')} = 1;\n`);
    await write(root, `${project.path}/tests/index.test.ts`, testCode(project.name));
    await write(root, `${project.path}/tsconfig.json`, json(projectTsconfig(project, parsed)));
    await write(root, `${project.path}/tests/tsconfig.json`, json(testsTsconfig(project, parsed)));
  }
  await write(root, 'tsconfig.json', json(reconcileSolution(null, [...parsed.projects.map(item => item.path), ...parsed.projects.map(item => `${item.path}/tests`)])));
  await write(root, 'package.json', json({ name: 'source-fixture', private: true, type: 'module', imports: importAliases(parsed) }));
  await write(root, 'tests/suites.json', json(suites));
  if (typecheck) {
    for (const base of ['tsconfig.node.json', 'tsconfig.browser.json']) await cp(join(repository, 'configs/types', base), join(root, 'configs/types', base));
    await symlink(resolve(repository, 'node_modules'), join(root, 'node_modules'), 'junction');
  }
  return root;
}
/** `vue-tsc -b` of the fixture solution with the repository's locked compiler. */
export const typecheck = root => run(process.execPath, [join(repository, 'node_modules/vue-tsc/bin/vue-tsc.js'), '-b'], { cwd: root });
