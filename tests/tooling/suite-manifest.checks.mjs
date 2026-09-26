import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { globToRegExp, toolingGroups, validateManifest } from '../../scripts/testing/suite-manifest.mjs';
import { suiteInventory } from '../../scripts/testing/evidence-identity.mjs';

const cli = resolve('scripts/testing/suites.mjs');
function run(cwd, args, env = {}) {
  const environment = { ...process.env, ...env };
  delete environment.NODE_TEST_CONTEXT;
  delete environment.npm_execpath;
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', timeout: 60000, env: environment });
  assert.ifError(result.error);
  return result;
}
const suite = (name, include, extra = {}) => ({ name, purpose: `${name} purpose`, runner: { type: 'node-test' }, include, verify: 'tooling', ...extra });
function manifest(overrides = {}) {
  return {
    schemaVersion: 1,
    roots: [{ path: 'tests/tooling' }, { path: 'tests/concepts', optional: true }],
    helperRoots: ['tests/support'],
    prerequisites: { secret: { env: 'SUITE_FIXTURE_UNSET_VARIABLE', hint: 'Set the fixture variable.' } },
    suites: [suite('alpha', ['tests/tooling/alpha-*.checks.mjs'], { npmScript: 'test:alpha' }), suite('beta', ['tests/tooling/beta-*.checks.mjs'])],
    helpers: [{ purpose: 'fixtures', include: ['tests/tooling/*-fixture.mjs'] }],
    ...overrides,
  };
}
const passing = 'import { test } from "node:test"; test("passes", () => {});\n';
async function fixture(t, files, data = manifest()) {
  const root = await mkdtemp(join(tmpdir(), 'suite-manifest-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const all = { 'package.json': JSON.stringify({ type: 'module', scripts: { 'test:alpha': 'node scripts/testing/suites.mjs alpha' } }),
    'tests/suites.json': JSON.stringify(data), 'tests/tooling/alpha-one.checks.mjs': passing, 'tests/tooling/beta-one.checks.mjs': passing,
    'tests/tooling/shared-fixture.mjs': 'export const value = 1;\n', 'tests/support/helper.ts': 'export {};\n', ...files };
  for (const [path, content] of Object.entries(all)) {
    if (content === null) continue;
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}

test('glob patterns match repository-relative paths without crossing directories', () => {
  assert.ok(globToRegExp('tests/tooling/framework-*.checks.mjs').test('tests/tooling/framework-core.checks.mjs'));
  assert.ok(!globToRegExp('tests/tooling/framework-*.checks.mjs').test('tests/tooling/framework-journey.mjs'));
  assert.ok(!globToRegExp('tests/tooling/*.checks.mjs').test('tests/tooling/nested/a.checks.mjs'));
  assert.ok(globToRegExp('tests/runtime/**/*.test.ts').test('tests/runtime/a.test.ts'));
  assert.ok(globToRegExp('tests/runtime/**/*.test.ts').test('tests/runtime/deep/er/a.test.ts'));
  assert.ok(globToRegExp('tests/project/**/*.test.{ts,mjs}').test('tests/project/http.test.mjs'));
  assert.ok(!globToRegExp('tests/a?.mjs').test('tests/a/.mjs'));
  assert.throws(() => globToRegExp('tests/{a,b.mjs'), /SUITE_PATTERN_INVALID/);
});

test('manifest validation rejects unknown runners, duplicate names, bad verify modes and unknown prerequisites', () => {
  assert.throws(() => validateManifest(manifest({ schemaVersion: 2 })), /schemaVersion/);
  assert.throws(() => validateManifest(manifest({ suites: [suite('alpha', []), suite('alpha', [])] })), /duplicate suite alpha/);
  assert.throws(() => validateManifest(manifest({ suites: [suite('alpha', [], { runner: { type: 'jest' }, verify: 'opt-in' })] })), /runner.type/);
  assert.throws(() => validateManifest(manifest({ suites: [suite('alpha', [], { verify: 'sometimes' })] })), /verify must be/);
  assert.throws(() => validateManifest(manifest({ suites: [suite('alpha', [], { runner: { type: 'vitest', config: 'x' } })] })), /requires the node-test runner/);
  assert.throws(() => validateManifest(manifest({ suites: [suite('alpha', [], { prerequisites: ['nothing'] })] })), /unknown prerequisite nothing/);
  assert.throws(() => validateManifest(manifest({ suites: [suite('Alpha Suite', [])] })), /suite name/);
  assert.throws(() => validateManifest(manifest({ aliases: { alpha: 'x' } })), /shadows a suite/);
});

test('the repository manifest classifies every test file and matches the evidence tooling inventory', () => {
  const result = run(process.cwd(), ['--check', '--json']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.status, 'passed');
  assert.ok(summary.testFiles > 150 && summary.helpers > 10, result.stdout);
});

test('--list --json reports each suite with its runner, verify mode, prerequisites and classified files', async t => {
  const root = await fixture(t, {});
  const result = run(root, ['--list', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const listing = JSON.parse(result.stdout);
  assert.equal(listing.schemaVersion, 1);
  assert.deepEqual(listing.helpers, ['tests/tooling/shared-fixture.mjs']);
  assert.deepEqual(listing.suites.map(item => Object.keys(item).sort()), Array(2).fill(['fileCount', 'files', 'name', 'npmScript', 'optional', 'prerequisites', 'purpose', 'runner', 'verify', 'workflows']));
  assert.deepEqual(listing.suites[0], { name: 'alpha', purpose: 'alpha purpose', runner: 'node-test', verify: 'tooling', prerequisites: [], npmScript: 'test:alpha',
    workflows: [], optional: false, fileCount: 1, files: ['tests/tooling/alpha-one.checks.mjs'] });
  const table = run(root, ['--list']);
  assert.equal(table.status, 0, table.stderr);
  assert.match(table.stdout, /^suite\s+files\s+runner\s+verify\s+prerequisites\s+command$/m);
  assert.match(table.stdout, /^alpha\s+1\s+node-test\s+tooling\s+-\s+npm run test:alpha$/m);
});

test('an unclassified test file fails closed and names the manifest to edit', async t => {
  const root = await fixture(t, { 'tests/tooling/gamma.checks.mjs': passing });
  for (const args of [['--check'], ['--list'], ['alpha', '--dry-run']]) {
    const result = run(root, args);
    assert.equal(result.status, 1, args.join(' '));
    assert.match(result.stderr, /UNCLASSIFIED_TEST_FILE: tests\/tooling\/gamma\.checks\.mjs belongs to no suite\. Edit tests\/suites\.json/);
  }
});

test('a file claimed twice, an undeclared directory or a stray top-level file fails closed', async t => {
  const twice = manifest({ suites: [suite('alpha', ['tests/tooling/alpha-*.checks.mjs', 'tests/tooling/beta-*.checks.mjs']), suite('beta', ['tests/tooling/beta-*.checks.mjs'])] });
  const ambiguous = run(await fixture(t, {}, twice), ['--check']);
  assert.equal(ambiguous.status, 1);
  assert.match(ambiguous.stderr, /AMBIGUOUS_TEST_FILE: tests\/tooling\/beta-one\.checks\.mjs is claimed by suite "alpha" and suite "beta"/);
  const helperTwice = manifest({ helpers: [{ purpose: 'fixtures', include: ['tests/tooling/*.mjs'] }] });
  const shadowed = run(await fixture(t, {}, helperTwice), ['--check']);
  assert.match(shadowed.stderr, /AMBIGUOUS_TEST_FILE: tests\/tooling\/alpha-one\.checks\.mjs is claimed by suite "alpha" and helper "fixtures"/);
  const directory = run(await fixture(t, { 'tests/newcomer/a.test.ts': passing }), ['--check']);
  assert.equal(directory.status, 1);
  assert.match(directory.stderr, /UNDECLARED_TEST_DIRECTORY: tests\/newcomer/);
  const stray = run(await fixture(t, { 'tests/loose.checks.mjs': passing }), ['--check']);
  assert.match(stray.stderr, /UNDECLARED_TEST_FILE: tests\/loose\.checks\.mjs/);
});

test('empty suites, missing required roots and tooling outside verify fail; optional roots may be absent', async t => {
  const empty = manifest({ suites: [...manifest().suites, suite('gamma', ['tests/tooling/gamma-*.checks.mjs'])] });
  assert.match(run(await fixture(t, {}, empty), ['--check']).stderr, /EMPTY_SUITE: suite "gamma" matches no files/);
  const optional = manifest({ suites: [...manifest().suites, suite('gamma', ['tests/concepts/*.py'], { optional: true, verify: 'opt-in' })] });
  assert.equal(run(await fixture(t, {}, optional), ['--check']).status, 0);
  const missing = manifest({ roots: [{ path: 'tests/tooling' }, { path: 'tests/concepts' }] });
  assert.match(run(await fixture(t, {}, missing), ['--check']).stderr, /TEST_ROOT_MISSING: tests\/concepts/);
  const hidden = manifest({ suites: [manifest().suites[0], suite('beta', ['tests/tooling/beta-*.checks.mjs'], { verify: 'opt-in' })] });
  const result = run(await fixture(t, {}, hidden), ['--check']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /TOOLING_NOT_IN_VERIFY: tests\/tooling\/beta-one\.checks\.mjs runs in evidence tooling/);
});

test('npm scripts must exist and run the suite they are declared for', async t => {
  const wrong = JSON.stringify({ type: 'module', scripts: { 'test:alpha': 'node scripts/testing/suites.mjs beta' } });
  assert.match(run(await fixture(t, { 'package.json': wrong }), ['--check']).stderr, /SUITE_SCRIPT_MISMATCH: package.json "test:alpha" does not run suite "alpha"/);
  const absent = JSON.stringify({ type: 'module', scripts: {} });
  assert.match(run(await fixture(t, { 'package.json': absent }), ['--check']).stderr, /SUITE_SCRIPT_MISSING: package.json has no "test:alpha" script/);
});

test('runner-declared inventories must equal the suite files in both directions', async t => {
  const browser = { name: 'browser', purpose: 'browser', runner: { type: 'command', commands: [['{python}', 'runner.py']] }, include: ['tests/concepts/*.browser.py'],
    inventory: { source: 'runner.py', pattern: "\\('([a-z-]+)', '[a-z-]+/[a-z-]+\\.json'\\)", file: 'tests/concepts/companion-$1.browser.py' }, verify: 'opt-in', optional: true };
  const data = manifest({ suites: [...manifest().suites, browser] });
  const root = await fixture(t, { 'runner.py': "SUITES = [('declared', 'declared/checks.json')]\n", 'tests/concepts/companion-extra.browser.py': '' }, data);
  const result = run(root, ['--check']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SUITE_INVENTORY_MISMATCH: runner\.py runs tests\/concepts\/companion-declared\.browser\.py, which is not a file of suite browser/);
  assert.match(result.stderr, /SUITE_INVENTORY_MISMATCH: suite browser claims tests\/concepts\/companion-extra\.browser\.py, but runner\.py never runs it/);
  await rm(join(root, 'runner.py'));
  assert.match(run(root, ['--check']).stderr, /SUITE_INVENTORY_SOURCE: suite browser cannot read runner\.py/);
  await rm(join(root, 'tests/concepts/companion-extra.browser.py'));
  assert.equal(run(root, ['--check']).status, 0, 'a distributed kit may omit both the runner and its tests');
});

test('dry runs print exact serialized commands; aliases expand once in manifest order', async t => {
  const root = await fixture(t, {});
  const result = run(root, ['tooling', 'alpha', '--dry-run', '--json', '--', '--test-name-pattern=passes']);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.outcomes.map(item => [item.name, item.status]), [['alpha', 'planned'], ['beta', 'planned']]);
  assert.deepEqual(report.outcomes[0].commands, [[process.execPath, '--test', '--test-concurrency=1', '--test-name-pattern=passes', 'tests/tooling/alpha-one.checks.mjs']]);
  assert.match(result.stderr, /▶ suite: alpha \(1 file, node-test\)/);
  const unknown = run(root, ['delta']);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /UNKNOWN_SUITE: delta\. Known: alpha, beta, tooling$/m);
  assert.equal(run(root, []).status, 2);
  assert.match(run(root, ['--list', 'alpha']).stderr, /CONFLICTING_OPTIONS/);
});

test('suites really execute: failures propagate and missing prerequisites or manual runners never pass', async t => {
  const failing = 'import { test } from "node:test"; import assert from "node:assert"; test("fails", () => assert.equal(1, 2));\n';
  const extra = [suite('gated', ['tests/tooling/gated-*.checks.mjs'], { verify: 'opt-in', prerequisites: ['secret'] }),
    { name: 'manual', purpose: 'manual', runner: { type: 'manual', instructions: 'README.md' }, include: ['tests/tooling/manual-*.checks.mjs'], verify: 'opt-in' }];
  const data = manifest({ suites: [...manifest().suites.map(item => ({ ...item, verify: 'opt-in' })), ...extra] });
  const root = await fixture(t, { 'tests/tooling/beta-one.checks.mjs': failing, 'tests/tooling/gated-one.checks.mjs': passing, 'tests/tooling/manual-one.checks.mjs': passing }, data);
  const pass = run(root, ['alpha', '--json']);
  assert.equal(pass.status, 0, pass.stderr);
  const passed = JSON.parse(pass.stdout).outcomes[0];
  assert.equal(passed.status, 'passed'); assert.ok(Number.isInteger(passed.durationMs));
  assert.match(pass.stderr, /(?:#|ℹ) pass 1/);
  const fail = run(root, ['alpha', 'beta', '--json']);
  assert.equal(fail.status, 1);
  assert.deepEqual(JSON.parse(fail.stdout).outcomes.map(item => item.status), ['passed', 'failed']);
  const planned = JSON.parse(run(root, ['gated', '--dry-run', '--json']).stdout).outcomes[0];
  assert.deepEqual([planned.status, planned.missingPrerequisites], ['planned', ['secret']]);
  const gated = run(root, ['gated']);
  assert.equal(gated.status, 1);
  assert.match(gated.stderr, /missing prerequisite "secret"\. Set the fixture variable\./);
  assert.doesNotMatch(gated.stdout + gated.stderr, /(?:#|ℹ) tests/);
  assert.equal(run(root, ['gated'], { SUITE_FIXTURE_UNSET_VARIABLE: '1' }).status, 0);
  const manual = run(root, ['manual']);
  assert.equal(manual.status, 1);
  assert.match(manual.stderr, /manual suite without an automated runner; follow README\.md/);
});

test('verify tooling groups cover exactly the evidence tooling inventory, each file once', async () => {
  const groups = await toolingGroups(process.cwd());
  const files = groups.flatMap(group => group.files);
  assert.equal(new Set(files).size, files.length);
  assert.deepEqual([...files].sort(), await suiteInventory(process.cwd(), 'tooling'));
  assert.ok(groups.every(group => group.files.length > 0 && /^[a-z-]+$/.test(group.name)), JSON.stringify(groups.map(group => group.name)));
});
