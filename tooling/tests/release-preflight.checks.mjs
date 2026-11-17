import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { changelogBoundTests, parsePreflightArguments, preflightRelease } from '../release/preflight.mjs';
import { gitFixture } from './release-git-fixture.mjs';

const entry = '- Pending capability.';
// The 0.6.1 mistake: a test that only accepts the entry under Unreleased, which the cut promotes into X.Y.Z.
const pinnedToUnreleased = `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFileSync } from 'node:fs';\n` +
  `test('[AC-1] entry under Unreleased', () => {\n  const text = readFileSync('CHANGELOG.md', 'utf8');\n` +
  `  const unreleased = text.slice(text.indexOf('## [Unreleased]'), text.indexOf('\\n## [', text.indexOf('## [Unreleased]') + 1));\n` +
  `  assert.ok(unreleased.includes(${JSON.stringify(entry)}));\n});\n`;
// The fixed form: Unreleased or any version newer than the last release.
const promotionSafe = pinnedToUnreleased.replace("text.indexOf('\\n## [', text.indexOf('## [Unreleased]') + 1)", "text.indexOf('\\n## [0.3.0]')");
const securityPassed = () => ({ id: 'security', status: 'passed', detail: 'passed' });

async function withAcceptanceTest(fixture, body) {
  await mkdir(join(fixture.root, 'tests/acceptance/sample'), { recursive: true });
  await writeFile(join(fixture.root, 'tests/acceptance/sample/ac-1.checks.mjs'), body);
  await writeFile(join(fixture.root, 'tests/acceptance/sample/ac-2.checks.mjs'), "import test from 'node:test';\ntest('unrelated', () => {});\n");
  fixture.git('add', '.'); fixture.git('commit', '--quiet', '-m', 'Acceptance tests'); fixture.git('push', '--quiet', 'origin', 'main'); fixture.git('fetch', '--quiet', 'origin');
}
const options = fixture => ({ root: fixture.root, version: '0.4.0', date: '2026-10-01', run: fixture.run, security: securityPassed });
const statuses = result => Object.fromEntries(result.checks.map(check => [check.id, check.status]));

test('a releasable main is ready, and the preflight writes nothing in the checkout', async t => {
  const fixture = await gitFixture(t); await withAcceptanceTest(fixture, promotionSafe);
  const before = await readFile(join(fixture.root, 'CHANGELOG.md'), 'utf8');
  const result = await preflightRelease(options(fixture));
  assert.equal(result.status, 'ready', JSON.stringify(result.checks));
  assert.deepEqual(statuses(result), { 'cut-plan': 'passed', 'changelog-tests': 'passed', security: 'passed' });
  assert.match(result.checks[1].detail, /^1 test file\(s\) pass against the promoted changelog/);
  assert.equal(await readFile(join(fixture.root, 'CHANGELOG.md'), 'utf8'), before);
  assert.equal(fixture.git('status', '--porcelain'), ''); assert.equal(fixture.git('worktree', 'list').split('\n').length, 1, 'the throwaway worktree is removed');
  assert.equal(fixture.git('branch', '--list', 'release/*'), ''); assert.deepEqual(fixture.gh.calls, []);
});

test('negative: a test pinned to Unreleased blocks the release before the cut', async t => {
  const fixture = await gitFixture(t); await withAcceptanceTest(fixture, pinnedToUnreleased);
  const result = await preflightRelease(options(fixture));
  assert.equal(result.status, 'blocked'); assert.equal(statuses(result)['changelog-tests'], 'failed');
  assert.match(result.checks[1].detail, /tests\/acceptance\/sample\/ac-1\.checks\.mjs[\s\S]*\[AC-1\] entry under Unreleased/);
  assert.equal(fixture.git('worktree', 'list').split('\n').length, 1, 'the worktree is removed after a failure too');
});

test('negative: a security finding or a cut blocker blocks; --skip-security and no changelog test are reported, not hidden', async t => {
  const fixture = await gitFixture(t);
  const finding = () => ({ id: 'security', status: 'failed', detail: 'vulnerabilities; uncovered: @nuxt/schema' });
  const insecure = await preflightRelease({ ...options(fixture), security: finding });
  assert.equal(insecure.status, 'blocked'); assert.equal(insecure.checks[2].detail, 'vulnerabilities; uncovered: @nuxt/schema');
  assert.equal(statuses(insecure)['changelog-tests'], 'skipped', 'no acceptance test reads the changelog');
  const unchecked = await preflightRelease({ ...options(fixture), skipSecurity: true, security: () => { throw new Error('not called'); } });
  assert.equal(unchecked.status, 'ready'); assert.deepEqual(statuses(unchecked), { 'cut-plan': 'passed', 'changelog-tests': 'skipped', security: 'skipped' });
  await writeFile(join(fixture.root, 'stray.txt'), 'x');
  const dirty = await preflightRelease(options(fixture));
  assert.equal(dirty.status, 'blocked'); assert.match(dirty.checks[0].detail, /CUT_TREE_NOT_CLEAN/);
});

test('changelog-bound tests are found by content; arguments are strict', async t => {
  const fixture = await gitFixture(t); await withAcceptanceTest(fixture, promotionSafe);
  assert.deepEqual(await changelogBoundTests(fixture.root), ['tests/acceptance/sample/ac-1.checks.mjs']);
  assert.deepEqual(parsePreflightArguments(['--version', '1.2.3', '--skip-security', '--json']), { version: '1.2.3', skipSecurity: true, json: true });
  assert.deepEqual(parsePreflightArguments([]), { help: true });
  for (const args of [['--version'], ['--version', '1.2'], ['--version', '1.2.3', '--bogus'], ['--version', '1.2.3', '--version', '1.2.4'], ['--version', '1.2.3', '--date', '2026-13-40']])
    assert.throws(() => parsePreflightArguments(args), Error, args.join(' '));
});
