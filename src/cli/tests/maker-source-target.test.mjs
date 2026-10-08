import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makerFixture, installMakerFoundation, makerSourceRoot } from './support/maker-fixture.mjs';
import { parseArguments } from '../adapters/makers/arguments.ts';
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
}));
