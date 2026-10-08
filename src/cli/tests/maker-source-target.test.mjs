const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { cp, mkdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makerFixture, installMakerFoundation, makerSourceRoot } from './support/maker-fixture.mjs';
import { parseArguments } from '../adapters/makers/arguments.ts';
import { planMakerBatch } from '../adapters/makers/batch.ts';
import { planMaker } from '../adapters/makers/plan.ts';
import { loadCatalog } from '../adapters/makers/load-catalog.ts';
import { applyFilePlan } from '#shared/platform/file-plan.ts';

async function splitFixture(root, names) {
  await rename(join(root, 'src'), join(root, 'runtime'));
  await mkdir(join(root, 'src'));
  for (const name of names) {
    const source = join(root, 'src', name);
    await cp(join(root, 'runtime'), source, { recursive: true });
    await mkdir(join(source, 'tests'), { recursive: true });
    await cp(join(root, 'tests/runtime'), join(source, 'tests/unit'), { recursive: true });
    for (const name of ['entity-fixture.ts', 'memory-storage.ts', 'authoring-fixture.ts']) {
      const path = join(source, 'tests/unit', name);
      await writeFile(path, (await readFile(path, 'utf8')).replaceAll("from '../../src/", "from '../../"));
    }
  }
  await writeFile(join(root, 'workbench.sources.json'), JSON.stringify({ schemaVersion: 1,
    projects: names.map(name => ({ name, kind: 'plugin', path: `src/${name}`, references: [] })) }));
}
const request = (...args) => parseArguments(['feature', 'records', '--entity', 'record', ...args]);
async function generateAndCheck(root, source, args = []) {
  const planned = await planMaker(root, request(...args));
  await applyFilePlan(planned.plan);
  assert.ok(planned.plan.changes.some(change => change.path === `${source}/features/records/record.definition.ts`));
  const tests = source === 'src' ? 'tests/runtime' : `${source}/tests/unit`;
  const generated = await readFile(join(root, tests, 'generated/records-record.test.ts'), 'utf8');
  assert.ok(generated.includes(source === 'src' ? '../../../src/features/' : '../../../features/'));
  assert.equal((await loadCatalog(root, args[1])).entities.some(entity => entity.entity === 'record'), true);
  await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
    target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true,
    noUncheckedIndexedAccess: true, skipLibCheck: true, noEmit: true, types: ['node'], esModuleInterop: true,
  }, include: [`${source}/**/*.ts`, `${source}/**/*.vue`, `${tests}/**/*.ts`] }));
  const checked = spawnSync(process.execPath, [join(makerSourceRoot, 'node_modules/vue-tsc/bin/vue-tsc.js'), '--noEmit'], {
    cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 2 * 1024 * 1024,
  });
  assert.equal(checked.error, undefined, checked.error?.message);
  assert.equal(checked.status, 0, checked.stdout + checked.stderr);
  await writeFile(join(root, 'configs/testing/vitest.config.mjs'),
    `import vue from '@vitejs/plugin-vue';\nexport default { plugins: [vue()], test: { include: ['${tests}/generated/**/*.test.ts'], environment: 'node', fileParallelism: false } };\n`);
  const run = spawnSync(process.execPath, [join(makerSourceRoot, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'configs/testing/vitest.config.mjs'], {
    cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 2 * 1024 * 1024,
  });
  assert.equal(run.error, undefined, run.error?.message);
  assert.equal(run.status, 0, run.stdout + run.stderr);
}
test('legacy flat sources retain working feature imports, TypeScript and generated tests', () => makerFixture(async root => {
  await installMakerFoundation(root);
  await generateAndCheck(root, 'src');
}));
test('manifest makers generate and type-check within the only plugin project', () => makerFixture(async root => {
  await installMakerFoundation(root);
  await splitFixture(root, ['plugin']);
  await generateAndCheck(root, 'src/plugin');
}));
test('multiple plugins require a named source and mutate only that project', () => makerFixture(async root => {
  await installMakerFoundation(root);
  await splitFixture(root, ['first', 'second']);
  await assert.rejects(planMaker(root, request()), /first, second/);
  await assert.rejects(planMaker(root, request('--source', 'absent')), /No plugin project named "absent"/);
  const planned = await planMaker(root, request('--source', 'second'));
  assert.ok(planned.plan.changes.every(change => !change.path.startsWith('src/first/')));
  await generateAndCheck(root, 'src/second', ['--source', 'second']);
}));
test('malformed manifest is rejected without silently targeting legacy src', () => makerFixture(async root => {
  await writeFile(join(root, 'workbench.sources.json'), '{');
  await assert.rejects(planMaker(root, request()), SyntaxError);
  await writeFile(join(root, 'workbench.sources.json'), JSON.stringify({ schemaVersion: 1, projects: [], unknown: true }));
  await assert.rejects(planMaker(root, request()), /known fields/);
  await writeFile(join(root, 'workbench.sources.json'), JSON.stringify({ schemaVersion: 1, projects: [{ name: 'plugin', kind: 'plugin', path: 'src/plugin', references: ['missing'] }] }));
  await assert.rejects(planMaker(root, request()), /SOURCE_UNKNOWN_REFERENCE/);
  await writeFile(join(root, 'workbench.sources.json'), JSON.stringify({ schemaVersion: 1, projects: [{ name: 'plugin', kind: 'plugin', path: 'src/plugin', references: ['plugin'] }] }));
  await assert.rejects(planMaker(root, request()), /cycle/);
}));

test('batches share planned outputs within each selected source and keep same-named owners independent', () => makerFixture(async root => {
  await installMakerFoundation(root);
  await splitFixture(root, ['first', 'second']);
  const batch = { schemaVersion: 1, steps: [
    { recipe: 'feature', name: 'records', bare: true },
    { recipe: 'command', name: 'open', feature: 'records' },
    { recipe: 'feature', name: 'records', bare: true, source: 'second' },
    { recipe: 'command', name: 'open', feature: 'records', source: 'second' },
  ] };
  await assert.rejects(planMakerBatch(root, batch), /first, second/);
  const planned = await planMakerBatch(root, batch, 'first');
  for (const name of ['first', 'second']) {
    assert.ok(planned.plan.changes.some(change => change.path === `src/${name}/features/records/open.command.ts`));
    assert.ok(planned.checks.some(check => check.id === 'events-check' && check.args.includes(name)));
  }
  await applyFilePlan(planned.plan);
  for (const name of ['first', 'second']) assert.match(await readFile(join(root, `src/${name}/features/records/open.command.ts`), 'utf8'), /defineCommand/);
}));


test('batch check paths are relocated once even when a source name matches a legacy source folder', () => makerFixture(async root => {
  await installMakerFoundation(root);
  await splitFixture(root, ['domain']);
  const planned = await planMakerBatch(root, { schemaVersion: 1, steps: [
    { recipe: 'feature', name: 'records', entity: 'record', backend: 'domain' },
  ] }, 'domain');
  const checkedTests = planned.checks.filter(check => check.id === 'generated-tests').flatMap(check => check.args.filter(arg => arg.endsWith('.test.ts')));
  assert.ok(checkedTests.length > 0);
  for (const path of checkedTests) {
    assert.ok(path.startsWith('src/domain/tests/unit/'), path);
    assert.ok(planned.plan.changes.some(change => change.path === path), `post-apply check targets an actual planned test: ${path}`);
  }
}));


test('native checks use configured repository paths without relocating an already named source', () => makerFixture(async root => {
  await installMakerFoundation(root);
  await splitFixture(root, ['domain']);
  await mkdir(join(root, 'design'), { recursive: true });
  await mkdir(join(root, 'src/domain/generated/bootstrap'), { recursive: true });
  await writeFile(join(root, 'design/project.json'), JSON.stringify({ settings: { codebaseFolder: 'src/domain' } }));
  await writeFile(join(root, 'src/domain/generated/bootstrap/native-integrations.ts'),
    "import { board } from './board.ts';\nexport const projectFileTypes = [board];\nexport const projectContextMenus = [];\n");
  await writeFile(join(root, 'src/domain/generated/bootstrap/board.ts'),
    "export const board = { id: 'generated-board', extension: 'board', format: 'json' };\n");
  await assert.rejects(planMaker(root, parseArguments(['file-extension', 'board', '--feature', 'tasks', '--extension', 'board', '--source', 'domain'])), /NATIVE_EXTENSION_CONFLICT/);
}));


test('a declared source directory link is rejected before a maker writes through it', () => makerFixture(async root => {
  await installMakerFoundation(root);
  await splitFixture(root, ['domain']);
  await rm(join(root, 'src/domain'), { recursive: true });
  await symlink(join(root, 'runtime'), join(root, 'src/domain'), 'junction');
  await assert.rejects(planMaker(root, request('--source', 'domain')), /PLAN_SYMLINK/);
  await assert.rejects(readFile(join(root, 'runtime/features/records/record.definition.ts')), { code: 'ENOENT' });
}));
