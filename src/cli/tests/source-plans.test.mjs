import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, readdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { validateManifest } from '../tooling/testing/suite-manifest.mjs';
import { fixture, read, readJson, run, source, typecheck, write } from './support/source-fixture.mjs';

const present = (root, path) => access(join(root, path)).then(() => true, () => false);
const files = async (root, folder) => (await readdir(join(root, folder), { recursive: true, withFileTypes: true }).catch(() => []))
  .filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name).slice(join(root, folder).length + 1).replace(/\\/g, '/')).sort();

test('source add previews, refuses a stale hash with no writes, then scaffolds a library whose test passes and whose wiring checks clean', async t => {
  const root = await fixture(t);
  const suitesBefore = await read(root, 'tests/suites.json');
  const preview = await source(root, 'add', 'util', '--kind', 'library', '--references', 'shared');
  assert.equal(preview.result.status, 'planned', JSON.stringify(preview.result.diagnostics));
  assert.deepEqual(preview.result.data.changes.map(change => change.path).sort(), ['.workbench/sources/util.json', 'package.json', 'src/util/index.ts',
    'src/util/tests/index.test.ts', 'src/util/tests/tsconfig.json', 'src/util/tsconfig.json', 'tests/suites.json', 'tsconfig.json', 'workbench.sources.json']);
  assert.equal(await present(root, 'src/util'), false);
  const stale = await source(root, 'add', 'util', '--kind', 'library', '--references', 'shared', '--apply', 'f'.repeat(64));
  assert.equal(stale.status, 1);
  assert.equal(stale.result.diagnostics[0].code, 'PLAN_STALE');
  assert.equal(await present(root, 'src/util'), false);
  assert.equal(await read(root, 'tests/suites.json'), suitesBefore);
  const applied = await source(root, 'add', 'util', '--kind', 'library', '--references', 'shared', '--apply', preview.result.data.planHash);
  assert.equal(applied.result.status, 'applied', JSON.stringify(applied.result.diagnostics));
  assert.deepEqual(await files(root, 'src/util'), ['index.ts', 'tests/index.test.ts', 'tests/tsconfig.json', 'tsconfig.json']);
  assert.match(await read(root, 'src/util/index.ts'), /return 'util';/);
  assert.equal((await readJson(root, 'package.json')).imports['#util/*'], './src/util/*');
  assert.deepEqual((await readJson(root, 'workbench.sources.json')).projects.at(-1), { name: 'util', kind: 'library', path: 'src/util', references: ['shared'] });
  const references = (await readJson(root, 'tsconfig.json')).references.map(item => item.path);
  assert.ok(references.includes('./src/util') && references.includes('./src/util/tests'));
  const suites = validateManifest(await readJson(root, 'tests/suites.json'));
  assert.deepEqual(suites.suites.at(-1), { name: 'source:util', purpose: 'Tests of the util source project (src/util).', level: 'unit', runner: { type: 'node-test' }, include: ['src/util/tests/**/*.test.ts'], verify: 'opt-in' });
  assert.ok((await read(root, 'tests/suites.json')).startsWith(suitesBefore.slice(0, suitesBefore.lastIndexOf('}') - 10)), 'existing entries keep their text');
  assert.deepEqual(Object.keys((await readJson(root, '.workbench/sources/util.json')).files).sort(), ['src/util/index.ts', 'src/util/tests/index.test.ts', 'src/util/tests/tsconfig.json', 'src/util/tsconfig.json']);
  assert.equal((await source(root, 'check')).status, 0);
  const ran = await run(process.execPath, ['--test', 'src/util/tests/index.test.ts'], { cwd: root });
  assert.equal(ran.status, 0, ran.stdout + ran.stderr);
  const again = await source(root, 'add', 'util', '--kind', 'cli');
  assert.equal(again.result.diagnostics[0].code, 'SOURCE_EXISTS');
});

test('every kind template scaffolds; an existing folder and an unknown kind are refused', async t => {
  const root = await fixture(t);
  for (const [name, kind, entry] of [['app', 'cli', 'app.ts'], ['mobile', 'plugin', 'index.ts'], ['studio', 'companion', 'index.ts'], ['web', 'library', 'index.ts']]) {
    const added = await source(root, 'add', name, '--kind', kind, ...(name === 'web' ? ['--platform', 'browser'] : []), '--yes');
    assert.equal(added.result.status, 'applied', `${kind}: ${JSON.stringify(added.result.diagnostics)}`);
    assert.ok(await present(root, `src/${name}/${entry}`), kind);
  }
  assert.equal((await readJson(root, 'src/web/tsconfig.json')).extends, '../../configs/types/tsconfig.browser.json');
  assert.equal((await source(root, 'check')).status, 0);
  await write(root, 'src/taken/notes.md', '# mine\n');
  assert.equal((await source(root, 'add', 'taken', '--kind', 'library')).result.diagnostics[0].code, 'SOURCE_PATH_EXISTS');
  assert.equal((await source(root, 'add', 'x', '--kind', 'service')).result.diagnostics[0].code, 'SOURCE_KIND');
});

test('link refuses a cycle; link and unlink update the manifest and both tsconfigs; unlink refuses while imports remain', async t => {
  const root = await fixture(t);
  const manifest = await read(root, 'workbench.sources.json');
  const cycle = await source(root, 'link', 'shared', 'cli', '--yes');
  assert.equal(cycle.status, 1);
  assert.equal(cycle.result.diagnostics[0].code, 'SOURCE_CYCLE');
  assert.equal(await read(root, 'workbench.sources.json'), manifest);
  const linked = await source(root, 'link', 'plugin', 'tui', '--yes');
  assert.equal(linked.result.status, 'applied', JSON.stringify(linked.result.diagnostics));
  assert.deepEqual((await readJson(root, 'src/plugin/tsconfig.json')).references, [{ path: '../shared' }, { path: '../tui' }]);
  assert.deepEqual((await readJson(root, 'src/plugin/tests/tsconfig.json')).references, [{ path: '..' }, { path: '../../shared' }, { path: '../../tui' }]);
  assert.equal((await source(root, 'check')).status, 0);
  const blocked = await source(root, 'unlink', 'cli', 'tui', '--yes');
  assert.equal(blocked.status, 1);
  assert.equal(blocked.result.diagnostics[0].code, 'SOURCE_IMPORTS_REMAIN');
  assert.match(blocked.result.diagnostics[0].message, /src\/cli\/index\.ts:2 \(#tui\/index\.ts\)/);
  assert.deepEqual((await readJson(root, 'workbench.sources.json')).projects.find(item => item.name === 'cli').references, ['shared', 'tui']);
  const unlinked = await source(root, 'unlink', 'plugin', 'tui', '--yes');
  assert.equal(unlinked.result.status, 'applied');
  assert.deepEqual((await readJson(root, 'src/plugin/tsconfig.json')).references, [{ path: '../shared' }]);
  assert.equal((await source(root, 'check')).status, 0);
});

test('remove refuses a referenced project; otherwise it deletes scaffold files, keeps an edited one and unwires the project', async t => {
  const root = await fixture(t);
  const referenced = await source(root, 'remove', 'shared', '--yes');
  assert.equal(referenced.result.diagnostics[0].code, 'SOURCE_REFERENCED');
  assert.ok(await present(root, 'src/shared/index.ts'));
  assert.equal((await source(root, 'add', 'util', '--kind', 'library', '--yes')).result.status, 'applied');
  assert.equal((await source(root, 'link', 'plugin', 'util', '--yes')).result.status, 'applied');
  assert.equal((await source(root, 'remove', 'util')).result.diagnostics[0].code, 'SOURCE_REFERENCED');
  assert.equal((await source(root, 'unlink', 'plugin', 'util', '--yes')).result.status, 'applied');
  await write(root, 'src/util/index.ts', (await read(root, 'src/util/index.ts')) + 'export const mine = 1;\n');
  const removed = await source(root, 'remove', 'util', '--yes');
  assert.equal(removed.result.status, 'applied', JSON.stringify(removed.result.diagnostics));
  assert.deepEqual(removed.result.data.summary.retained, ['src/util/index.ts']);
  assert.deepEqual(removed.result.data.summary.removed.sort(), ['src/util/tests/index.test.ts', 'src/util/tests/tsconfig.json', 'src/util/tsconfig.json']);
  assert.deepEqual(await files(root, 'src/util'), ['index.ts']);
  assert.equal(await present(root, '.workbench/sources/util.json'), false);
  assert.ok(!(await readJson(root, 'tests/suites.json')).suites.some(item => item.name === 'source:util'));
  assert.equal((await readJson(root, 'package.json')).imports['#util/*'], undefined);
  assert.ok(!(await readJson(root, 'workbench.sources.json')).projects.some(item => item.name === 'util'));
  assert.ok(!(await readJson(root, 'tsconfig.json')).references.some(item => item.path.startsWith('./src/util')));
});

test('rename moves the project, rewrites aliases, references and imports everywhere, and the result type-checks with vue-tsc -b', async t => {
  const root = await fixture(t, { typecheck: true });
  assert.equal((await source(root, 'add', 'util', '--kind', 'library', '--references', 'shared', '--yes')).result.status, 'applied');
  assert.equal((await source(root, 'link', 'cli', 'util', '--yes')).result.status, 'applied');
  await write(root, 'src/cli/uses.ts', "import { projectName } from '#util/index.ts';\nimport type { sharedName } from '../shared/index.ts';\nexport const label = (): string => projectName();\nexport type Shared = typeof sharedName;\n");
  await write(root, 'src/util/more.ts', "import { sharedName } from '#shared/index.ts';\nimport { projectName } from './index.ts';\nexport const more = (): string => projectName() + sharedName();\n");
  await write(root, 'tooling/report.mjs', "import { projectName } from '../src/util/index.ts';\nexport const name = projectName();\n");
  const before = await typecheck(root);
  assert.equal(before.status, 0, before.stdout + before.stderr);
  const preview = await source(root, 'rename', 'util', 'helpers');
  assert.equal(preview.result.status, 'planned', JSON.stringify(preview.result.diagnostics));
  assert.ok(await present(root, 'src/util/index.ts'));
  const renamed = await source(root, 'rename', 'util', 'helpers', '--apply', preview.result.data.planHash);
  assert.equal(renamed.result.status, 'applied', JSON.stringify(renamed.result.diagnostics));
  assert.deepEqual(await files(root, 'src/util'), []);
  assert.deepEqual(await files(root, 'src/helpers'), ['index.ts', 'more.ts', 'tests/index.test.ts', 'tests/tsconfig.json', 'tsconfig.json']);
  assert.match(await read(root, 'src/cli/uses.ts'), /from '#helpers\/index\.ts'/);
  assert.match(await read(root, 'tooling/report.mjs'), /from '\.\.\/src\/helpers\/index\.ts'/);
  assert.match(await read(root, 'src/helpers/more.ts'), /from '\.\/index\.ts'/);
  assert.deepEqual((await readJson(root, 'package.json')).imports, { '#shared/*': './src/shared/*', '#tui/*': './src/tui/*', '#helpers/*': './src/helpers/*' });
  assert.deepEqual((await readJson(root, 'workbench.sources.json')).projects.find(item => item.name === 'cli').references, ['shared', 'tui', 'helpers']);
  assert.deepEqual((await readJson(root, 'src/cli/tsconfig.json')).references, [{ path: '../shared' }, { path: '../tui' }, { path: '../helpers' }]);
  assert.equal((await readJson(root, 'src/helpers/tsconfig.json')).compilerOptions.declarationDir, '../../.cache/tsbuild/helpers');
  assert.ok(await present(root, '.workbench/sources/helpers.json'));
  assert.equal((await readJson(root, 'src/helpers/tests/tsconfig.json')).compilerOptions.tsBuildInfoFile, '../../../.cache/tsbuild/helpers-tests.tsbuildinfo');
  const suites = (await readJson(root, 'tests/suites.json')).suites;
  assert.ok(!suites.some(item => item.name === 'source:util'));
  assert.deepEqual(suites.find(item => item.name === 'source:helpers').include, ['src/helpers/tests/**/*.test.ts']);
  const ran = await run(process.execPath, ['--test', 'src/helpers/tests/index.test.ts'], { cwd: root });
  assert.equal(ran.status, 0, ran.stdout + ran.stderr);
  const checked = await source(root, 'check');
  assert.equal(checked.status, 0, JSON.stringify(checked.result.diagnostics));
  const after = await typecheck(root);
  assert.equal(after.status, 0, after.stdout + after.stderr);
});


test('rename and remove preserve edited scaffold tests and their customized suite', async t => {
  const root = await fixture(t);
  assert.equal((await source(root, 'add', 'util', '--kind', 'library', '--yes')).status, 0);
  await write(root, 'src/util/tests/index.test.ts', (await read(root, 'src/util/tests/index.test.ts')) + '// Keep my custom test notes.\n');
  const suites = await readJson(root, 'tests/suites.json');
  suites.suites.at(-1).purpose = 'Custom verification';
  await write(root, 'tests/suites.json', JSON.stringify(suites));
  assert.equal((await source(root, 'rename', 'util', 'helpers', '--yes')).status, 0);
  const removed = await source(root, 'remove', 'helpers', '--yes');
  assert.equal(removed.status, 0, JSON.stringify(removed.result.diagnostics));
  assert.deepEqual(removed.result.data.summary.retained, ['src/helpers/tests/index.test.ts']);
  assert.equal((await readJson(root, 'tests/suites.json')).suites.at(-1).purpose, 'Custom verification');
  assert.ok(removed.result.data.summary.manual.some(item => item.includes('retained tests')));
});

test('an unchanged renamed scaffold is fully removable with its suite', async t => {
  const root = await fixture(t);
  assert.equal((await source(root, 'add', 'util', '--kind', 'library', '--yes')).status, 0);
  assert.equal((await source(root, 'rename', 'util', 'helpers', '--yes')).status, 0);
  const removed = await source(root, 'remove', 'helpers', '--yes');
  assert.equal(removed.status, 0, JSON.stringify(removed.result.diagnostics));
  assert.deepEqual(removed.result.data.summary.retained, []);
  assert.deepEqual(await files(root, 'src/helpers'), []);
  assert.ok(!(await readJson(root, 'tests/suites.json')).suites.some(item => item.name === 'source:helpers'));
});


test('rename rewrites escaped module literals without truncating or corrupting their contents', async t => {
  const root = await fixture(t);
  assert.equal((await source(root, 'add', 'util', '--kind', 'library', '--yes')).status, 0);
  await write(root, 'tooling/escaped.mjs', [
    "import { projectName } from '#util/\\u0069ndex.ts';",
    'export { projectName } from "#util/\\u0069ndex.ts";',
    'export const load = () => import(`#util/\\u0069ndex.ts`);',
  ].join('\n'));
  const renamed = await source(root, 'rename', 'util', 'helpers', '--yes');
  assert.equal(renamed.status, 0, JSON.stringify(renamed.result.diagnostics));
  assert.deepEqual(renamed.result.data.summary.unrewritable, []);
  const text = await read(root, 'tooling/escaped.mjs');
  assert.equal((text.match(/#helpers\/index\.ts/g) ?? []).length, 3);
  const ran = await run(process.execPath, ['tooling/escaped.mjs'], { cwd: root });
  assert.equal(ran.status, 0, ran.stdout + ran.stderr);
});

test('rename refuses an occupied destination and linked output ancestors without changing the manifest', async t => {
  const root = await fixture(t), outside = await fixture(t);
  const manifest = await read(root, 'workbench.sources.json');
  await write(root, 'src/taken/mine.txt', 'Keep this file.');
  assert.equal((await source(root, 'rename', 'tui', 'taken', '--yes')).result.diagnostics[0].code, 'SOURCE_PATH_EXISTS');
  assert.equal(await read(root, 'src/taken/mine.txt'), 'Keep this file.');
  await mkdir(join(outside, 'empty'));
  await symlink(join(outside, 'empty'), join(root, 'src/linked'), 'junction');
  const rejected = await source(root, 'rename', 'tui', 'linked', '--yes');
  assert.equal(rejected.status, 1);
  assert.equal(await read(root, 'workbench.sources.json'), manifest);
  assert.ok(await present(root, 'src/tui/index.ts'));
});
