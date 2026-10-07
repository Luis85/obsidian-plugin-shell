import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadThresholds, thresholdFloors, thresholdsPath, validateThresholds } from '../quality/thresholds.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const current = () => structuredClone(loadThresholds(root));

test('the framework thresholds file equals the reviewed framework floors', async () => {
  const file = JSON.parse(await readFile(join(root, thresholdsPath), 'utf8'));
  assert.deepEqual(file, { schemaVersion: 1, ...structuredClone(thresholdFloors) });
});

test('every gate reads its values from the thresholds file', async () => {
  const t = current();
  const configs = await Promise.all(['configs/testing/vitest.config.mjs', 'configs/testing/vitest.production.config.mjs', 'configs/testing/vitest.maker.config.mjs']
    .map(async name => (await import(new URL(`../../${name}`, import.meta.url).href)).default.test.coverage.thresholds));
  assert.deepEqual(configs, [t.coverage.selectedCore, t.coverage.production, t.coverage.maker]);
  const { lineLimit } = await import('../testing/source-inputs.mjs');
  assert.deepEqual([lineLimit('src/plugin/main.ts'), lineLimit('tests/a.test.mjs'), lineLimit('src/a.ts')], [t.codeLines.mainTs, t.codeLines.tests, t.codeLines.source]);
  const { duplicateArguments } = await import('../quality/maintainability-corpus.mjs');
  const flag = name => duplicateArguments[duplicateArguments.indexOf(name) + 1];
  assert.deepEqual([flag('--min-tokens'), flag('--min-lines'), flag('--threshold')].map(Number),
    [t.maintainability.duplicationMinTokens, t.maintainability.duplicationMinLines, t.maintainability.duplicationPercent]);
  const { compilerCoverageArguments } = await import('../compiler/coverage.mjs');
  assert.ok(compilerCoverageArguments().includes(`--test-coverage-lines=${t.coverage.compiler.lines}`));
  const { performanceProtocol } = await import('../testing/performance-report.mjs');
  assert.deepEqual(performanceProtocol.budgets, { 'warm-initialization': t.performance.warmInitializationMs, 'items-readiness': t.performance.itemsReadinessMs });
});

test('a project may tighten any threshold', () => {
  const t = current();
  t.coverage.production.lines = 97; t.coverage.compiler.branches = 100;
  t.codeLines.source = 300; t.maintainability.cyclomatic = 8; t.maintainability.duplicationPercent = 1.5; t.performance.mainJsBytes = 500000;
  const tightened = validateThresholds(t);
  assert.equal(tightened.coverage.production.lines, 97); assert.equal(tightened.maintainability.duplicationPercent, 1.5);
});

test('loosening any group below the framework floor fails with the offending path', () => {
  const cases = [[t => { t.coverage.productionCore.branches = 89; }, 'coverage.productionCore.branches'],
    [t => { t.codeLines.tests = 451; }, 'codeLines.tests'], [t => { t.maintainability.cognitive = 16; }, 'maintainability.cognitive'],
    [t => { t.maintainability.duplicationMinTokens = 51; }, 'maintainability.duplicationMinTokens'], [t => { t.performance.itemsReadinessMs = 501; }, 'performance.itemsReadinessMs']];
  for (const [loosen, path] of cases) {
    const t = current(); loosen(t);
    assert.throws(() => validateThresholds(t), new RegExp(`THRESHOLD_LOOSENED: ${path.replaceAll('.', '\\.')} `), path);
  }
});

test('malformed thresholds fail closed instead of falling back to defaults', () => {
  const mutations = [[t => { delete t.codeLines.mainTs; }, /THRESHOLDS_KEYS: codeLines/], [t => { t.coverage.extra = t.coverage.maker; }, /THRESHOLDS_KEYS: coverage/],
    [t => { t.performance.mainJsBytes = '1048576'; }, /THRESHOLDS_INVALID: performance\.mainJsBytes/], [t => { t.coverage.maker.lines = 101; }, /THRESHOLDS_INVALID/],
    [t => { t.codeLines.source = 399.5; }, /THRESHOLDS_INVALID: codeLines\.source/], [t => { t.schemaVersion = 2; }, /THRESHOLDS_VERSION/]];
  for (const [mutate, error] of mutations) { const t = current(); mutate(t); assert.throws(() => validateThresholds(t), error); }
});

test('gates in a copied project read that project file and reject a loosened or missing one', async t => {
  const project = await mkdtemp(join(tmpdir(), 'thresholds-project-'));
  t.after(() => rm(project, { recursive: true, force: true }));
  await mkdir(join(project, 'scripts/quality'), { recursive: true });
  await copyFile(join(root, 'tooling/quality/thresholds.mjs'), join(project, 'scripts/quality/thresholds.mjs'));
  const load = () => spawnSync(process.execPath, ['--input-type=module', '-e',
    `const m = await import(${JSON.stringify(new URL('scripts/quality/thresholds.mjs', `file://${project}/`).href)}); console.log(m.loadThresholds().codeLines.source);`], { encoding: 'utf8' });
  assert.match(load().stderr, /THRESHOLDS_MISSING/);
  const loosened = current(); loosened.codeLines.source = 800;
  await mkdir(join(project, 'configs/quality'), { recursive: true });
  await writeFile(join(project, thresholdsPath), JSON.stringify(loosened));
  const rejected = load(); assert.notEqual(rejected.status, 0); assert.match(rejected.stderr, /THRESHOLD_LOOSENED: codeLines\.source 800/);
  const tightened = current(); tightened.codeLines.source = 350;
  await writeFile(join(project, thresholdsPath), JSON.stringify(tightened));
  const accepted = load(); assert.equal(accepted.status, 0, accepted.stderr); assert.equal(accepted.stdout.trim(), '350');
});
