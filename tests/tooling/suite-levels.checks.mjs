// Test-pyramid level resolution, e2e policy agreement, pyramid shape and level selection on in-memory manifests,
// plus the repository's own manifest. The CLI's fail-closed behavior is proven in suite-levels-cli.checks.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSuites } from '../../scripts/testing/suite-manifest.mjs';
import { declaredLevels, e2ePolicyFailures, pyramidReport, removedExampleFiles, resolveLevels, selectByLevel, suiteCommandText } from '../../scripts/testing/test-levels.mjs';
import { e2eKinds } from '../../scripts/quality/e2e-policy.mjs';

const testLevels = [{ name: 'unit', summary: 'u' }, { name: 'component', summary: 'c' }, { name: 'integration', summary: 'i' },
  { name: 'e2e', summary: 'e', paths: ['tests/e2e/**'] }, { name: 'acceptance', summary: 'a', paths: ['tests/acceptance/**'] }];
const suite = (name, files, extra = {}) => ({ name, purpose: name, level: 'unit', runner: { type: 'node-test' }, include: ['x'], verify: 'tooling', files, ...extra });
const tooling = suite('tooling', ['tests/tooling/a-pure.checks.mjs', 'tests/tooling/a-process.checks.mjs', 'tests/tooling/a-view.checks.mjs'],
  { levels: { integration: ['tests/tooling/a-process.checks.mjs'], component: ['tests/tooling/*-view.checks.mjs'] } });
const e2e = suite('e2e', ['tests/e2e/one.spec.ts'], { level: 'e2e', runner: { type: 'playwright' }, verify: 'opt-in', npmScript: 'test:e2e' });
const manifest = (suites, extra = {}) => ({ testLevels, suites, ...extra });
const codes = failures => failures.map(failure => failure.split(':')[0]);

test('each file takes its suite level unless exactly one override pattern of that suite claims it', () => {
  const resolved = resolveLevels(manifest([tooling, e2e]), [tooling, e2e]);
  assert.deepEqual(resolved.failures, []);
  assert.deepEqual(resolved.files.map(file => [file.path, file.level]), [['tests/tooling/a-pure.checks.mjs', 'unit'],
    ['tests/tooling/a-process.checks.mjs', 'integration'], ['tests/tooling/a-view.checks.mjs', 'component'], ['tests/e2e/one.spec.ts', 'e2e']]);
});

test('missing, unknown, ambiguous, unused and self-referencing levels are reported with the manifest to edit', () => {
  const cases = [
    [{ level: undefined }, 'SUITE_LEVEL_MISSING'],
    [{ level: 'smoke' }, 'SUITE_LEVEL_UNKNOWN'],
    [{ levels: { smoke: ['tests/tooling/a-pure.checks.mjs'] } }, 'SUITE_LEVEL_UNKNOWN'],
    [{ levels: { integration: ['tests/tooling/a-*.checks.mjs'], component: ['tests/tooling/*-pure.checks.mjs'] } }, 'AMBIGUOUS_TEST_LEVEL'],
    [{ levels: { integration: ['tests/tooling/a-p*.checks.mjs', 'tests/tooling/a-process.checks.mjs'] } }, 'AMBIGUOUS_TEST_LEVEL'],
    [{ levels: { integration: ['tests/tooling/gone.checks.mjs'] } }, 'UNUSED_LEVEL_PATTERN'],
    [{ levels: { unit: ['tests/tooling/a-pure.checks.mjs'] } }, 'SUITE_LEVEL_OVERRIDES_INVALID'],
    [{ levels: { integration: [] } }, 'SUITE_LEVEL_OVERRIDES_INVALID'],
    [{ levels: ['tests/tooling/a-pure.checks.mjs'] }, 'SUITE_LEVEL_OVERRIDES_INVALID'],
  ];
  for (const [extra, code] of cases) {
    const broken = { ...tooling, levels: undefined, ...extra };
    const { failures } = resolveLevels(manifest([broken]), [broken]);
    assert.ok(codes(failures).includes(code), `${JSON.stringify(extra)}: ${failures.join('\n')}`);
    assert.ok(failures.every(failure => /tests\/suites\.json|Known:|drop that entry/.test(failure)), failures.join('\n'));
  }
});

test('an override naming a removed example file may match nothing; any other unmatched override still fails', () => {
  const stale = { ...tooling, levels: { integration: ['tests/tooling/removed-example.checks.mjs', 'tests/tooling/gone.checks.mjs'] } };
  const { failures } = resolveLevels(manifest([stale]), [stale], { removed: new Set(['tests/tooling/removed-example.checks.mjs']) });
  assert.deepEqual(codes(failures), ['UNUSED_LEVEL_PATTERN']);
  assert.match(failures[0], /gone\.checks\.mjs/);
  assert.deepEqual(codes(resolveLevels(manifest([stale]), [stale]).failures), ['UNUSED_LEVEL_PATTERN', 'UNUSED_LEVEL_PATTERN'], 'without the removal record both fail');
});

test('level declarations must exist, be unique, named, summarized and carry valid paths', () => {
  assert.deepEqual(codes(declaredLevels({}).failures), ['TEST_LEVELS_UNDECLARED']);
  for (const levels of [[{ name: 'Unit', summary: 'u' }], [{ name: 'unit', summary: 'u' }, { name: 'unit', summary: 'v' }], [{ name: 'unit' }], [{ name: 'unit', summary: 'u', paths: [] }]])
    assert.deepEqual(codes(declaredLevels({ testLevels: levels }).failures), ['TEST_LEVELS_INVALID'], JSON.stringify(levels));
  assert.deepEqual(resolveLevels({ suites: [tooling] }, [tooling]).files, [], 'nothing resolves without declared levels');
});

test('a level with paths owns them both ways; e2e is a whole-suite level without overrides', () => {
  const stray = suite('stray', ['tests/e2e/two.spec.ts']);
  assert.deepEqual(codes(resolveLevels(manifest([stray]), [stray]).failures), ['TEST_LEVEL_PATH_MISMATCH']);
  const misplaced = suite('misplaced', ['tests/tooling/b.checks.mjs'], { level: 'acceptance' });
  assert.match(resolveLevels(manifest([misplaced]), [misplaced]).failures[0], /resolves to acceptance, which is reserved for tests\/acceptance\/\*\*/);
  const mixed = { ...tooling, levels: { e2e: ['tests/tooling/a-view.checks.mjs'] } };
  assert.ok(codes(resolveLevels(manifest([mixed]), [mixed]).failures).includes('E2E_LEVEL_OVERRIDE'));
  const lowered = { ...e2e, files: ['tests/e2e/one.spec.ts', 'tests/e2e/two.spec.ts'], levels: { unit: ['tests/e2e/two.spec.ts'] } };
  assert.ok(codes(resolveLevels(manifest([lowered]), [lowered]).failures).includes('E2E_LEVEL_OVERRIDE'));
});

test('e2e suites must be opt-in and recognized by the e2e opt-in policy; policy-e2e commands must be e2e suites', () => {
  assert.equal(suiteCommandText(e2e), 'npm run test:e2e\nx');
  const browser = suite('browser', [], { level: 'e2e', verify: 'opt-in', runner: { type: 'command', commands: [['{node}', 'tests/concepts/a.browser.mjs'], { each: 'docs/*.js', argv: ['{node}', '--check', '{file}'] }] } });
  const host = suite('host', [], { level: 'e2e', verify: 'opt-in', runner: { type: 'npm-script', script: 'test:obsidian' } });
  assert.deepEqual(e2ePolicyFailures(manifest([e2e, browser, host]), e2eKinds), []);
  const unlisted = suite('unlisted', [], { level: 'e2e', verify: 'opt-in', runner: { type: 'command', commands: [['{node}', 'scripts/new-browser-check.mjs']] } });
  const always = { ...e2e, name: 'always', verify: 'own-step' };
  const disguised = suite('disguised', [], { level: 'integration', verify: 'opt-in', runner: { type: 'command', commands: [['{node}', 'scripts/testing/check-browser-specimen.mjs']] } });
  assert.deepEqual(codes(e2ePolicyFailures(manifest([unlisted, always, disguised]), e2eKinds)), ['E2E_SUITE_NOT_IN_POLICY', 'E2E_SUITE_NOT_OPT_IN', 'E2E_POLICY_LEVEL_MISMATCH']);
  assert.deepEqual(codes(e2ePolicyFailures(manifest([unlisted, always]), null)), ['E2E_SUITE_NOT_OPT_IN'], 'without the policy module only the verify mode is checked');
});

test('the pyramid counts files per level, attributes measured time to single-level suites and warns on inversion', () => {
  const heavy = suite('heavy', ['tests/tooling/h1.checks.mjs', 'tests/tooling/h2.checks.mjs'], { level: 'integration' });
  const data = manifest([tooling, heavy, e2e]);
  const report = pyramidReport(data, resolveLevels(data, [tooling, heavy, e2e]), { heavy: 30, tooling: 9 });
  assert.deepEqual(report.levels.map(row => [row.level, row.files, row.measuredSeconds]), [['unit', 1, 0], ['component', 1, 0], ['integration', 3, 30], ['e2e', 1, 0], ['acceptance', 0, 0]]);
  assert.deepEqual(report.mixedSuites, [{ suite: 'tooling', levels: ['unit', 'component', 'integration'], measuredSeconds: 9 }]);
  assert.equal(report.total, 6);
  assert.deepEqual(report.warnings, ['PYRAMID_INVERTED: integration has 3 test files, more than 1 × the 1 unit files below it.']);
  const tolerant = { ...data, pyramid: { warnWhen: [{ upper: 'integration', lower: 'unit', maxRatio: 3 }] } };
  assert.deepEqual(pyramidReport(tolerant, resolveLevels(tolerant, [tooling, heavy, e2e])).warnings, []);
  for (const warnWhen of [[{ upper: 'smoke', lower: 'unit', maxRatio: 1 }], [{ upper: 'e2e', lower: 'unit', maxRatio: 0 }], 'all'])
    assert.throws(() => pyramidReport({ ...data, pyramid: { warnWhen } }, resolveLevels(data, [tooling])), /PYRAMID_CONFIG_INVALID/);
});

test('level selection narrows node --test and Vitest suites to matching files and skips mixed whole-suite runners', () => {
  const vitest = suite('runtime', ['tests/runtime/a.test.ts', 'tests/runtime/b-components.test.ts'], { runner: { type: 'vitest', config: 'c' }, levels: { component: ['tests/runtime/*-components.test.ts'] } });
  const command = suite('baseline', ['tests/verification/a.test.mjs', 'tests/verification/b.test.mjs'], { runner: { type: 'command', commands: [['x']] }, levels: { integration: ['tests/verification/b.test.mjs'] } });
  const all = [tooling, vitest, command, e2e], resolved = resolveLevels(manifest(all), all);
  const unit = selectByLevel(all, resolved, ['unit']);
  assert.deepEqual(unit.selected.map(item => [item.suite.name, item.files, item.narrowed]), [['tooling', ['tests/tooling/a-pure.checks.mjs'], true], ['runtime', ['tests/runtime/a.test.ts'], true]]);
  assert.deepEqual(unit.skipped, [{ name: 'baseline', reason: 'mixes unit+integration files and its command runner cannot select files; run it by name' }]);
  const both = selectByLevel(all, resolved, ['unit', 'integration']);
  assert.deepEqual(both.selected.map(item => [item.suite.name, item.narrowed]), [['tooling', true], ['runtime', true], ['baseline', false]]);
  assert.deepEqual(selectByLevel(all, resolved, ['e2e']).selected.map(item => item.suite.name), ['e2e']);
});

test('the repository labels every test file once, keeps e2e under the opt-in policy and has a usable pyramid', async () => {
  const result = await checkSuites(process.cwd());
  assert.deepEqual(result.failures, []);
  const resolved = resolveLevels(result.manifest, result.suites, { removed: removedExampleFiles(process.cwd()) });
  assert.deepEqual(resolved.failures, []);
  assert.equal(resolved.files.length, result.suites.reduce((sum, item) => sum + item.files.length, 0));
  assert.deepEqual(resolved.levels.map(level => level.name), ['unit', 'component', 'integration', 'e2e', 'acceptance']);
  assert.deepEqual(e2ePolicyFailures(result.manifest, e2eKinds), []);
  for (const item of result.manifest.suites.filter(entry => entry.level === 'e2e')) assert.equal(item.verify, 'opt-in', item.name);
  const report = pyramidReport(result.manifest, resolved);
  for (const level of ['unit', 'component', 'integration', 'e2e']) assert.ok(report.levels.find(row => row.level === level).files > 0, level);
});
