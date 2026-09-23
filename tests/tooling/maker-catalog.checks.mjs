import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makerFixture, makerSourceRoot, installMakerFoundation, copyMakerSuite } from './maker-fixture.mjs';
import { parseArguments } from '../../scripts/makers/arguments.mjs';
import { planMaker } from '../../scripts/makers/plan.mjs';
import { applyFilePlan } from '../../scripts/shared/file-plan.mjs';
import { loadCatalog } from '../../scripts/makers/load-catalog.mjs';
import { checkGenerated } from '../../scripts/quality/format-generated.mjs';
import { createMakerContext } from '../../scripts/makers/engine.mjs';

async function apply(root, args) {
  const planned = await planMaker(root, parseArguments(args));
  assert.deepEqual(await checkGenerated(planned.plan.changes.filter(change => change.status !== 'unchanged')), []);
  await applyFilePlan(planned.plan); return planned;
}
test('[MAKER-CATALOG] every integrated recipe generates executable source, real tests, and safe reruns', () => makerFixture(async root => {
  await installMakerFoundation(root); await copyMakerSuite(root);
  await mkdir(join(root, 'src/locales'), { recursive: true });
  await cp(join(makerSourceRoot, 'src/locales/en.json'), join(root, 'src/locales/en.json'));
  await cp(join(makerSourceRoot, 'tsconfig.json'), join(root, 'tsconfig.json'));
  await apply(root, ['feature', 'bookmarks', '--entity', 'bookmark']);
  const requests = [
    ['entity', 'reference', '--feature', 'bookmarks', '--preset', 'project'],
    ['entity', 'rating', '--feature', 'bookmarks', '--backend', 'plugin-data'],
    ['view', 'dashboard', '--feature', 'bookmarks'],
    ['component', 'summary', '--feature', 'bookmarks'],
    ['store', 'draft', '--feature', 'bookmarks'],
    ['usecase', 'normalize', '--feature', 'bookmarks'],
    ['command', 'help', '--feature', 'bookmarks'],
    ['modal', 'rename', '--feature', 'bookmarks'],
    ['setting', 'compact', '--feature', 'bookmarks'],
    ['setting', 'quiet', '--feature', 'bookmarks', '--preference', 'notifySuccess'],
    ['event', 'refreshed', '--feature', 'bookmarks'],
    ['listener', 'observe', '--feature', 'bookmarks', '--event', 'refreshed'],
    ['style', 'border', '--feature', 'bookmarks', '--view', 'dashboard'],
    ['maker', 'reminder'],
    ['reminder', 'review', '--feature', 'bookmarks'],
    ['locale', 'fr'],
  ];
  for (const args of requests) {
    await apply(root, args);
    const repeated = await planMaker(root, parseArguments(args));
    assert.ok(repeated.plan.changes.every(change => change.status === 'unchanged'), args.join(' '));
  }
  const check = (args, timeout = 120000) => {
    const run = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout, maxBuffer: 4 * 1024 * 1024 });
    assert.equal(run.error, undefined, run.error?.message); assert.equal(run.status, 0, run.stdout + run.stderr);
    return run;
  };
  check([join(makerSourceRoot, 'node_modules/vue-tsc/bin/vue-tsc.js'), '--noEmit']);
  const runtime = check([join(makerSourceRoot, 'node_modules/vitest/vitest.mjs'), 'run']);
  assert.match(runtime.stdout, /23 passed/);
  check(['--test', 'tests/tooling/custom-reminder.checks.mjs', 'tests/tooling/locale-fr.checks.mjs']);
  const catalog = await loadCatalog(root);
  assert.equal(catalog.entities.find(entry => entry.entity === 'reference').backend, 'domain');
  assert.equal(catalog.entities.find(entry => entry.entity === 'reference').fields.find(field => field.name === 'budget').default, 0);
  assert.equal(catalog.entities.find(entry => entry.entity === 'reference').fields.find(field => field.name === 'archived').default, false);
  assert.equal(catalog.entities.find(entry => entry.entity === 'rating').backend, 'plugin-data');
  assert.equal(catalog.entities.find(entry => entry.entity === 'bookmarks-compact-setting').backend, 'plugin-data');
}));

test('[MAKER-CONFLICTS] owner/event/style prerequisites, stale reads and edited files preserve source', () => makerFixture(async root => {
  await installMakerFoundation(root); await copyMakerSuite(root);
  await apply(root, ['feature', 'bookmarks', '--entity', 'bookmark']);
  for (const args of [
    ['view', 'missing', '--feature', 'absent'],
    ['listener', 'refresh', '--feature', 'bookmarks', '--event', 'missing'],
    ['style', 'card', '--feature', 'bookmarks', '--view', 'missing'],
    ['setting', 'bad', '--feature', 'bookmarks', '--preference', 'unknown'],
    ['entity', 'rating', '--feature', 'bookmarks', '--backend', 'plugin-data', '--document'],
  ]) await assert.rejects(planMaker(root, parseArguments(args)));
  await apply(root, ['command', 'refresh', '--feature', 'bookmarks']);
  const path = join(root, 'src/features/bookmarks/refresh.command.ts');
  const edited = (await readFile(path, 'utf8')) + '// retained author edit\n'; await writeFile(path, edited);
  await assert.rejects(planMaker(root, parseArguments(['command', 'refresh', '--feature', 'bookmarks'])), /MAKER_CONFLICT/);
  assert.equal(await readFile(path, 'utf8'), edited);
  const messages = join(root, 'src/bootstrap/authoring-locales.ts');
  await assert.rejects(planMaker(root, parseArguments(['command', 'later', '--feature', 'bookmarks']), {
    async beforeFinalize() { await writeFile(messages, (await readFile(messages, 'utf8')) + '// concurrent\n'); },
  }), /MAKER_STALE_INPUT/);
  const registry = join(root, 'src/bootstrap/authoring.ts');
  const original = await readFile(registry, 'utf8');
  const editedRegistry = original.replace('repository: services.repositories.bookmark', 'repository: services.repositories.task');
  await writeFile(registry, editedRegistry);
  await assert.rejects(planMaker(root, parseArguments(['feature', 'bookmarks', '--entity', 'bookmark'])), /REGISTRY_CONFLICT/);
  assert.equal(await readFile(registry, 'utf8'), editedRegistry);
  const changedLabel = original.replace('authoring.bookmarksWorkspacePanel.title', 'authoring.bookmarksWorkspacePanel. title');
  await writeFile(registry, changedLabel);
  await assert.rejects(planMaker(root, parseArguments(['feature', 'bookmarks', '--entity', 'bookmark'])), /REGISTRY_CONFLICT/);
  assert.equal(await readFile(registry, 'utf8'), changedLabel);
}));

test('[MAKER-READ-SNAPSHOT] repeated reads cannot adopt concurrent prerequisite changes', () => makerFixture(async root => {
  const context = createMakerContext(root); const path = 'src/bootstrap/authoring.ts';
  const original = await context.read(path); await context.add('derived.txt', original);
  await writeFile(join(root, path), original + '// Concurrent edit\n');
  assert.equal(await context.read(path), original);
  await assert.rejects(context.finish(), /MAKER_STALE_INPUT/);
}));

test('[MAKER-REGISTRY-MODIFIERS] edited async and optional chains never equal reviewed synchronous factories', () => makerFixture(async root => {
  const path = 'src/bootstrap/authoring.ts'; const expected = "services => recipe(services.repositories['entry'])";
  for (const expression of [
    "async services => recipe(services.repositories['entry'])",
    "services => recipe?.(services.repositories['entry'])",
    "services => recipe(services?.repositories['entry'])",
    "services => recipe(services.repositories?.['entry'])",
  ]) {
    const source = `import { recipe } from '../features/sample/recipe';\nconst authoringFactories = [${expression}];\n`;
    await writeFile(join(root, path), source);
    const context = createMakerContext(root);
    await assert.rejects(context.editArray(path, 'authoringFactories', expected), /REGISTRY_UNSUPPORTED_EXPRESSION/);
    assert.equal(await readFile(join(root, path), 'utf8'), source);
  }
}));
