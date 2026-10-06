// The suites CLI fails closed on unlabeled, mislabeled or e2e-policy-inconsistent test levels, reports the pyramid
// and runs suites by level, all in throwaway repositories through the real scripts/testing/suites.mjs process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const cli = resolve('scripts/testing/suites.mjs');
const passing = 'import { test } from "node:test"; test("passes", () => {});\n';
const levels = [{ name: 'unit', summary: 'u' }, { name: 'integration', summary: 'i' }, { name: 'e2e', summary: 'e', paths: ['tests/e2e/**'] },
  { name: 'acceptance', summary: 'a', paths: ['tests/acceptance/**'] }];
const alpha = { name: 'alpha', purpose: 'alpha', level: 'unit', levels: { integration: ['tests/tooling/alpha-process.checks.mjs'] },
  runner: { type: 'node-test' }, include: ['tests/tooling/alpha-*.checks.mjs'], verify: 'tooling' };
const e2e = { name: 'e2e', purpose: 'browser', level: 'e2e', runner: { type: 'playwright' }, include: ['tests/e2e/*.spec.ts'], verify: 'opt-in', npmScript: 'test:e2e' };
const manifest = (overrides = {}) => ({ schemaVersion: 1, testLevels: levels, roots: [{ path: 'tests/tooling' }, { path: 'tests/e2e' }, { path: 'tests/acceptance', optional: true }],
  suites: [alpha, e2e], ...overrides });

async function fixture(t, data = manifest(), files = {}) {
  const root = await mkdtemp(join(tmpdir(), 'suite-levels-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const all = { 'package.json': JSON.stringify({ type: 'module', scripts: { 'test:e2e': 'playwright test' } }), 'tests/suites.json': JSON.stringify(data),
    'tests/tooling/alpha-pure.checks.mjs': passing, 'tests/tooling/alpha-process.checks.mjs': passing, 'tests/e2e/one.spec.ts': 'export {};\n', ...files };
  for (const [path, content] of Object.entries(all)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}
function run(cwd, args) {
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', timeout: 60000, env: environment });
  assert.ifError(result.error);
  return result;
}
const withSuite = (name, change) => manifest({ suites: manifest().suites.map(item => item.name === name ? { ...item, ...change } : item) });

test('--check passes a labeled manifest and fails closed, naming the manifest, for every level defect', async t => {
  const ok = run(await fixture(t), ['--check']);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /2 suites, 0 helpers; every test file has one of 4 test levels/);
  const cases = [
    [withSuite('alpha', { level: undefined }), /SUITE_LEVEL_MISSING: suite "alpha" has no "level"\. Edit tests\/suites\.json/],
    [withSuite('alpha', { level: 'smoke' }), /SUITE_LEVEL_UNKNOWN: suite "alpha" has level "smoke"/],
    [withSuite('alpha', { levels: { integration: ['tests/tooling/alpha-p*.checks.mjs', 'tests/tooling/*-process.checks.mjs'] } }), /AMBIGUOUS_TEST_LEVEL: tests\/tooling\/alpha-process\.checks\.mjs matches/],
    [withSuite('alpha', { levels: { integration: ['tests/tooling/alpha-gone.checks.mjs'] } }), /UNUSED_LEVEL_PATTERN: suite "alpha" pattern "tests\/tooling\/alpha-gone\.checks\.mjs"/],
    [manifest({ testLevels: undefined }), /TEST_LEVELS_UNDECLARED/],
    [withSuite('alpha', { level: 'acceptance', levels: undefined }), /TEST_LEVEL_PATH_MISMATCH: tests\/tooling\/alpha-pure\.checks\.mjs resolves to acceptance/],
    [withSuite('alpha', { levels: { e2e: ['tests/tooling/alpha-process.checks.mjs'] } }), /E2E_LEVEL_OVERRIDE: suite "alpha" mixes e2e/],
    [withSuite('e2e', { verify: 'own-step' }), /E2E_SUITE_NOT_OPT_IN: suite "e2e"/],
    [withSuite('e2e', { npmScript: undefined }), /E2E_SUITE_NOT_IN_POLICY: suite "e2e"/],
    [withSuite('e2e', { level: 'integration' }), /E2E_POLICY_LEVEL_MISMATCH: suite "e2e" runs commands the e2e opt-in policy classifies as served UI in Chromium/],
  ];
  for (const [data, expected] of cases) {
    const result = run(await fixture(t, data), ['--check']);
    assert.equal(result.status, 1, `${expected}\n${result.stdout}${result.stderr}`);
    assert.match(result.stderr, expected);
  }
  const json = run(await fixture(t, withSuite('alpha', { level: undefined })), ['--check', '--json']);
  assert.deepEqual(JSON.parse(json.stdout).failures.map(failure => failure.split(':')[0]), ['SUITE_LEVEL_MISSING']);
});

test('a file under a reserved level path in another suite fails the pyramid; running suites by name still works without levels', async t => {
  const data = manifest({ suites: [{ ...alpha, include: ['tests/tooling/alpha-*.checks.mjs', 'tests/acceptance/*.checks.mjs'] }, e2e] });
  const root = await fixture(t, data, { 'tests/acceptance/story.checks.mjs': passing });
  const result = run(root, ['--pyramid']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /TEST_LEVEL_PATH_MISMATCH: tests\/acceptance\/story\.checks\.mjs sits under the acceptance paths \(tests\/acceptance\/\*\*\) but resolves to unit/);
  const legacy = await fixture(t, manifest({ testLevels: undefined }));
  assert.equal(run(legacy, ['alpha', '--dry-run']).status, 0, 'a manifest from before levels still runs named suites');
  assert.equal(run(legacy, ['--pyramid']).status, 1, 'the pyramid needs declared levels');
});

test('--pyramid reports files per level, warns on an inverted shape without failing and honors the configured ratio', async t => {
  const root = await fixture(t);
  const json = run(root, ['--pyramid', '--json']);
  assert.equal(json.status, 0, json.stderr);
  const report = JSON.parse(json.stdout);
  assert.deepEqual(report.levels.map(row => [row.level, row.files]), [['unit', 1], ['integration', 1], ['e2e', 1], ['acceptance', 0]]);
  assert.deepEqual(report.mixedSuites.map(item => [item.suite, item.levels]), [['alpha', ['unit', 'integration']]]);
  assert.deepEqual(report.warnings, [], 'equal counts are not inverted');
  const inverted = await fixture(t, manifest(), { 'tests/e2e/two.spec.ts': 'export {};\n' });
  const text = run(inverted, ['--pyramid']);
  assert.equal(text.status, 0, 'an inverted pyramid warns, never fails');
  assert.match(text.stdout, /^ {2}e2e\s+2 /m);
  assert.match(text.stderr, /warning: PYRAMID_INVERTED: e2e has 2 test files, more than 1 × the 1 integration files below it\./);
  const tolerant = await fixture(t, manifest({ pyramid: { warnWhen: [{ upper: 'e2e', lower: 'integration', maxRatio: 2 }] } }), { 'tests/e2e/two.spec.ts': 'export {};\n' });
  assert.doesNotMatch(run(tolerant, ['--pyramid']).stderr, /PYRAMID_INVERTED/);
  const invalid = run(await fixture(t, manifest({ pyramid: { warnWhen: [{ upper: 'e2e', lower: 'smoke', maxRatio: 1 }] } })), ['--pyramid']);
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /PYRAMID_CONFIG_INVALID/);
});

test('--level runs only the files of the selected levels and refuses unknown levels or mixed modes', async t => {
  const root = await fixture(t);
  const unit = run(root, ['--level', 'unit', '--json']);
  assert.equal(unit.status, 0, unit.stderr);
  assert.deepEqual(JSON.parse(unit.stdout).outcomes.map(({ name, status }) => [name, status]), [['alpha', 'passed']]);
  assert.match(unit.stderr, /(?:#|ℹ) pass 1/, 'only the unit file ran');
  const planned = JSON.parse(run(root, ['--level', 'unit,integration', '--dry-run', '--json']).stdout).outcomes;
  assert.deepEqual(planned.map(outcome => [outcome.name, outcome.files]), [['alpha', ['tests/tooling/alpha-process.checks.mjs', 'tests/tooling/alpha-pure.checks.mjs']]]);
  const e2eOnly = JSON.parse(run(root, ['--level', 'e2e', '--dry-run', '--json']).stdout).outcomes;
  assert.deepEqual(e2eOnly.map(outcome => outcome.name), ['e2e']);
  for (const [args, code] of [[['--level', 'smoke'], /UNKNOWN_LEVEL: smoke/], [['--level'], /LEVEL_REQUIRED/], [['--level', 'unit', 'alpha'], /CONFLICTING_OPTIONS/],
    [['--level', 'unit', '--check'], /CONFLICTING_OPTIONS/], [['--pyramid', '--list'], /CONFLICTING_OPTIONS/], [['--level', 'acceptance'], /NO_SUITE_SELECTED/]]) {
    const result = run(root, args);
    assert.equal(result.status, 2, args.join(' '));
    assert.match(result.stderr, code);
  }
});
