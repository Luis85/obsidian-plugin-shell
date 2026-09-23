import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, cp, rm, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { parseArguments } from '../../scripts/makers/arguments.mjs';
import { planMaker } from '../../scripts/makers/plan.mjs';
import { applyFilePlan } from '../../scripts/shared/file-plan.mjs';
import { loadCatalog } from '../../scripts/makers/load-catalog.mjs';

const sourceRoot = process.cwd();
async function fixture(work) {
  const root = await mkdtemp(join(tmpdir(), 'template-maker-'));
  try {
    await mkdir(join(root, 'src/bootstrap'), { recursive: true });
    await writeFile(join(root, 'src/bootstrap/features.ts'), await readFile(resolve('src/bootstrap/features.ts'), 'utf8'));
    await work(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
const feature = () => parseArguments(['feature', 'bookmarks', '--entity', 'bookmark']);
test('[MAKE-03-01] deterministic dry-run performs no writes and prints an exact source plan', () => fixture(async root => {
  const before = await readFile(join(root, 'src/bootstrap/features.ts'), 'utf8');
  const a = await planMaker(root, feature()); const b = await planMaker(root, feature());
  assert.deepEqual(a, b); assert.equal(a.plan.changes.length, 5);
  assert.deepEqual(await readdir(join(root, 'src')), ['bootstrap']);
  assert.equal(await readFile(join(root, 'src/bootstrap/features.ts'), 'utf8'), before);
  const run = spawnSync(process.execPath, [resolve('scripts/makers/cli.mjs'), 'feature', 'bookmarks', '--entity', 'bookmark', '--dry-run', '--json'], { cwd: root, encoding: 'utf8', timeout: 20000 });
  assert.equal(run.status, 0, run.stderr); const report = JSON.parse(run.stdout);
  assert.equal(report.status, 'planned'); assert.ok(report.plan.changes.every(change => !Object.hasOwn(change, 'content')));
  assert.deepEqual(await readdir(root), ['src']);
}));
test('[MAKE-03-02] applied registration occurs once; identical repeats no-op and edited source conflicts', () => fixture(async root => {
  const planned = await planMaker(root, feature()); await applyFilePlan(planned.plan);
  const repeated = await planMaker(root, feature()); assert.ok(repeated.plan.changes.every(change => change.status === 'unchanged'));
  assert.deepEqual((await applyFilePlan(repeated.plan)).written, []);
  const registry = await readFile(join(root, 'src/bootstrap/features.ts'), 'utf8');
  assert.equal(registry.match(/bookmark: register\(bookmarkFeature\)/g)?.length, 1);
  assert.equal(registry.match(/import \{ bookmarkFeature \}/g)?.length, 1);
  const path = join(root, 'src/features/bookmarks/bookmark.entity.ts'); await writeFile(path, '// User-owned edited definition\n');
  await assert.rejects(planMaker(root, feature()), /MAKER_CONFLICT/);
  assert.equal(await readFile(path, 'utf8'), '// User-owned edited definition\n');
}));
test('[MAKE-03-03] entity prerequisite, unsupported recipes, unsafe names and registry conflicts fail closed', () => fixture(async root => {
  for (const args of [['feature', '../outside', '--entity', 'item'], ['feature', 'CON', '--entity', 'item'], ['feature', 'bookmarks', '--entity', 'constructor'], ['view', 'sample'], ['feature', 'bookmarks', '--entity', 'item', '--folder', '../Notes'], ['feature', 'bookmarks', '--entity', 'item', '--preset', 'unknown'], ['entity', 'item', '--feature', 'bookmarks'], ['entity', 'item', '--feature', 'bookmarks', '--document']]) await assert.rejects(planMaker(root, parseArguments(args)));
  assert.throws(() => parseArguments(['feature', 'bookmarks', '--force']));
  assert.throws(() => parseArguments(['feature', 'bookmarks', '--entity']));
  assert.throws(() => parseArguments(['feature', 'bookmarks', '--yes', '--yes']));
  await assert.rejects(planMaker(root, parseArguments(['feature', 'bookmarks', '--entity', 'item', '--feature', 'other'])), /--feature belongs/);
  await assert.rejects(planMaker(root, parseArguments(['entity', 'item', '--feature', 'bookmarks', '--document', '--entity', 'other'])), /--entity belongs/);
  const path = join(root, 'src/bootstrap/features.ts'); const original = await readFile(path, 'utf8');
  await writeFile(path, original.replace('project: register(projectFeature)', 'bookmark: register(projectFeature)'));
  await assert.rejects(planMaker(root, feature()), /REGISTRY_CONFLICT/);
  await writeFile(path, original.replace('project: register(projectFeature)', '...otherRegistrations'));
  await assert.rejects(planMaker(root, feature()), /REGISTRY_UNSUPPORTED_ENTRY/);
  assert.deepEqual(await readdir(root), ['src']);
}));
test('[MAKE-03-04] a registry change after review aborts without creating generated files', () => fixture(async root => {
  const planned = await planMaker(root, feature()); const path = join(root, 'src/bootstrap/features.ts');
  const edited = (await readFile(path, 'utf8')) + '\n// Concurrent author edit\n'; await writeFile(path, edited);
  await assert.rejects(applyFilePlan(planned.plan), /PLAN_STALE/);
  assert.equal(await readFile(path, 'utf8'), edited); assert.deepEqual(await readdir(join(root, 'src')), ['bootstrap']);
}));
test('[MAKE-03-06] AST registration handles missing trailing comma and preserves inline comments', () => fixture(async root => {
  const path = join(root, 'src/bootstrap/features.ts'); const original = await readFile(path, 'utf8');
  await writeFile(path, original.replace('project: register(projectFeature),', 'project: register(projectFeature) // author comment'));
  const planned = await planMaker(root, feature());
  const source = planned.plan.changes.find(change => change.path === 'src/bootstrap/features.ts').content;
  assert.match(source, /project: register\(projectFeature\), \/\/ author comment/);
  await writeFile(path, original.replace('project: register(projectFeature),', 'task: register(projectFeature),'));
  await assert.rejects(planMaker(root, feature()), /REGISTRY_DUPLICATE_KEY/);
}));
test('[MAKE-03-07] edits during planning cannot be adopted as a new overwrite precondition', () => fixture(async root => {
  const registryPath = join(root, 'src/bootstrap/features.ts'); const original = await readFile(registryPath, 'utf8');
  await assert.rejects(planMaker(root, feature(), { async beforeFinalize() { await writeFile(registryPath, original + '\n// Concurrent registry work\n'); } }), /MAKER_STALE_INPUT/);
  assert.equal(await readFile(registryPath, 'utf8'), original + '\n// Concurrent registry work\n');
  const generated = join(root, 'src/features/bookmarks/bookmark.entity.ts');
  await assert.rejects(planMaker(root, feature(), { async beforeFinalize() { await mkdir(join(root, 'src/features/bookmarks'), { recursive: true }); await writeFile(generated, '// New user-owned definition\n'); } }), /MAKER_STALE_INPUT/);
  assert.equal(await readFile(generated, 'utf8'), '// New user-owned definition\n');
}));
test('[MAKE-03-05] generated independent feature and second entity execute their real CRUD tests and catalog', () => fixture(async root => {
  await cp(resolve('src'), join(root, 'src'), { recursive: true });
  await mkdir(join(root, 'tests/runtime'), { recursive: true });
  await cp(resolve('tests/runtime/entity-fixture.ts'), join(root, 'tests/runtime/entity-fixture.ts'));
  await cp(resolve('tests/runtime/memory-storage.ts'), join(root, 'tests/runtime/memory-storage.ts'));
  await writeFile(join(root, 'package.json'), '{"name":"independent-author-fixture","type":"module"}');
  await symlink(resolve('node_modules'), join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  await writeFile(join(root, 'vitest.config.mjs'), "export default { test: { include: ['tests/runtime/generated/**/*.test.ts'], environment: 'node', fileParallelism: false } };\n");
  const first = await planMaker(root, feature()); await applyFilePlan(first.plan);
  const second = await planMaker(root, parseArguments(['entity', 'appointment', '--feature', 'bookmarks', '--document', '--preset', 'task'])); await applyFilePlan(second.plan);
  const third = await planMaker(root, parseArguments(['entity', 'budget', '--feature', 'bookmarks', '--document', '--preset', 'project'])); await applyFilePlan(third.plan);
  // Remove the original schemas and registry entries: generated tests/catalog
  // must use the reusable foundation, not reach through the worked examples.
  await rm(join(root, 'src/features/tasks'), { recursive: true });
  await rm(join(root, 'src/features/projects'), { recursive: true });
  const registryPath = join(root, 'src/bootstrap/features.ts');
  const registry = (await readFile(registryPath, 'utf8')).split('\n').filter(line => !line.includes("../features/tasks/definition") && !line.includes("../features/projects/definition") && !/^\s*(task|project):/.test(line)).join('\n');
  await writeFile(registryPath, registry);
  const run = spawnSync(process.execPath, [join(sourceRoot, 'node_modules/vitest/vitest.mjs'), 'run'], { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 2 * 1024 * 1024 });
  assert.equal(run.error, undefined, run.error?.message); assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /3 passed/);
  const report = await loadCatalog(root);
  assert.deepEqual(report.entities.map(entity => entity.entity), ['bookmark', 'appointment', 'budget']);
  assert.equal(report.entities.find(entity => entity.entity === 'budget').fields.find(field => field.name === 'budget').default, 0);
  assert.ok(report.entities.every(entity => entity.mappings.length));
}));
