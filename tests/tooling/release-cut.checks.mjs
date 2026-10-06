import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cutRelease, parseCutArguments, releaseBody } from '../../scripts/release/cut.mjs';
import { gitFixture, changelogText } from './release-git-fixture.mjs';

const options = fixture => ({ root: fixture.root, version: '0.4.0', date: '2026-10-01', run: fixture.run, env: {} });
const ok = stdout => ({ status: 0, stdout, stderr: '' });
const ids = calls => calls.map(args => args.slice(0, 2).join(' '));

test('the default cut is a plan: no branch, file change or GitHub call', async t => {
  const fixture = await gitFixture(t);
  const before = await readFile(join(fixture.root, 'CHANGELOG.md'), 'utf8');
  const plan = await cutRelease({ ...options(fixture), remote: true });
  assert.equal(plan.status, 'planned'); assert.equal(plan.mode, 'dry-run'); assert.equal(plan.branch, 'release/0.4.0');
  assert.deepEqual(plan.steps.map(step => [step.id, step.status]), [['create-branch', 'planned'], ['prepare', 'planned'], ['commit', 'planned'],
    ['push', 'planned'], ['pull-request', 'planned'], ['dispatch-release', 'planned']]);
  assert.equal(plan.changelog, '### Added\n\n- Pending capability.');
  assert.equal(await readFile(join(fixture.root, 'CHANGELOG.md'), 'utf8'), before);
  assert.equal(fixture.git('branch', '--list', 'release/*'), ''); assert.deepEqual(fixture.gh.calls, []);
});

test('execute creates release/X.Y.Z with one prepared commit and never touches the remote without --remote', async t => {
  const fixture = await gitFixture(t);
  const result = await cutRelease({ ...options(fixture), execute: true });
  assert.equal(result.status, 'committed');
  assert.equal(fixture.git('rev-parse', '--abbrev-ref', 'HEAD'), 'release/0.4.0');
  assert.equal(fixture.git('log', '-1', '--format=%s'), 'release: 0.4.0');
  assert.equal(result.baseSha, fixture.git('rev-parse', 'main')); assert.equal(result.head, fixture.git('rev-parse', 'HEAD'));
  assert.deepEqual(fixture.git('diff', '--name-only', 'main', 'HEAD').split('\n').sort(), ['CHANGELOG.md', 'manifest.json', 'package-lock.json', 'package.json', 'versions.json']);
  assert.equal(fixture.git('status', '--porcelain'), '');
  assert.equal(JSON.parse(await readFile(join(fixture.root, 'manifest.json'))).version, '0.4.0');
  assert.ok((await readFile(join(fixture.root, 'CHANGELOG.md'), 'utf8')).includes('## [Unreleased]\n\n## [0.4.0] - 2026-10-01\n\n### Added\n\n- Pending capability.\n'));
  assert.equal(fixture.git('ls-remote', '--heads', 'origin', 'release/0.4.0'), ''); assert.deepEqual(fixture.gh.calls, []);
});

test('remote cut pushes, opens a filled draft pull request and dispatches Release once; a rerun skips every done step', async t => {
  const fixture = await gitFixture(t);
  let body = null;
  fixture.gh.responses = { 'pr list': ok('[]'), 'run list': ok('[]'), 'pr create': args => { body = args; return ok('https://github.com/Example/different-plugin/pull/9\n'); } };
  const result = await cutRelease({ ...options(fixture), execute: true, remote: true, repository: 'Example/different-plugin' });
  assert.equal(result.status, 'pushed');
  assert.deepEqual(result.steps.map(step => [step.id, step.status]), [['fetch-base', 'done'], ['create-branch', 'done'], ['prepare', 'done'], ['commit', 'done'],
    ['push', 'done'], ['pull-request', 'done'], ['dispatch-release', 'done']]);
  assert.equal(fixture.git('ls-remote', '--heads', 'origin', 'release/0.4.0').split('\t')[0], result.head);
  assert.deepEqual(ids(fixture.gh.calls), ['pr list', 'pr create', 'run list', 'workflow run']);
  assert.deepEqual(body.slice(0, 9), ['pr', 'create', '--draft', '--base', 'main', '--head', 'release/0.4.0', '--title', 'Release 0.4.0']);
  assert.deepEqual(body.slice(-2), ['--repo', 'Example/different-plugin']);
  assert.deepEqual(fixture.gh.calls.at(-1), ['workflow', 'run', 'release.yml', '--ref', 'release/0.4.0', '--repo', 'Example/different-plugin']);
  fixture.gh.calls.length = 0;
  fixture.gh.responses = { 'pr list': ok('[{"number":9,"url":"https://github.com/Example/different-plugin/pull/9","isDraft":true}]'),
    'run list': ok(JSON.stringify([{ databaseId: 77, headSha: result.head, status: 'in_progress' }])) };
  const again = await cutRelease({ ...options(fixture), execute: true, remote: true });
  assert.equal(again.status, 'pushed');
  assert.deepEqual(again.steps.map(step => step.status), ['skipped', 'skipped', 'skipped', 'skipped', 'skipped', 'skipped']);
  assert.deepEqual(ids(fixture.gh.calls), ['pr list', 'run list']);
});

test('the pull request body fills the release template, with a fallback when it is absent', async t => {
  assert.equal(releaseBody('{{version}} {{ base }} {{base_sha}} {{release_branch}} {{date}} {{unknown}}\n{{changelog}}', { version: '1.0.0', base: 'main', base_sha: 'abc', release_branch: 'release/1.0.0', date: '2026-10-01', changelog: '- x' }),
    '1.0.0 main abc release/1.0.0 2026-10-01 {{unknown}}\n- x');
  for (const withTemplate of [false, true]) {
    const fixture = await gitFixture(t, { withTemplate });
    const bodies = [];
    // The body file is temporary: read it while gh "runs".
    fixture.gh.responses = { 'pr list': ok('[]'), 'run list': ok('[]'), 'pr create': args => { bodies.push(readFileSync(args[args.indexOf('--body-file') + 1], 'utf8')); return ok('url'); } };
    const result = await cutRelease({ ...options(fixture), execute: true, remote: true });
    assert.equal(bodies.length, 1);
    assert.equal(bodies[0], withTemplate
      ? `## Release 0.4.0\n\nBranch \`release/0.4.0\` from \`main\` at ${result.baseSha} (2026-10-01).\n\n### Added\n\n- Pending capability.\n\n- [ ] Release result is green\n`
      : `## Release 0.4.0\n\nRelease branch \`release/0.4.0\` cut from \`main\` at ${result.baseSha} on 2026-10-01.\n\n### Changelog\n\n### Added\n\n- Pending capability.\n`);
  }
});

test('cut refuses a dirty tree, another branch, a stale base, existing branch or tag and empty notes', async t => {
  const fixture = await gitFixture(t);
  const attempt = extra => cutRelease({ ...options(fixture), execute: true, ...extra });
  await writeFile(join(fixture.root, 'scratch.txt'), 'local');
  await assert.rejects(attempt(), /CUT_TREE_NOT_CLEAN/);
  fixture.git('switch', '--quiet', '-c', 'elsewhere'); fixture.git('tag', '0.4.0');
  const blocked = await cutRelease({ ...options(fixture), remote: true });
  assert.equal(blocked.status, 'blocked');
  assert.deepEqual(blocked.blockers.map(item => item.split(':')[0]), ['CUT_TREE_NOT_CLEAN', 'CUT_NOT_ON_BASE', 'CUT_TAG_EXISTS']);
  assert.deepEqual(blocked.steps.map(step => step.status), ['planned', 'planned', 'planned', 'planned', 'planned', 'planned']);
  fixture.git('switch', '--quiet', 'main'); fixture.git('tag', '-d', '0.4.0'); fixture.git('branch', '-D', 'elsewhere');
  fixture.git('add', 'scratch.txt'); fixture.git('commit', '--quiet', '-m', 'Local only');
  await assert.rejects(attempt(), /CUT_BASE_NOT_CURRENT/);
  fixture.git('reset', '--quiet', '--hard', 'origin/main');
  fixture.git('switch', '--quiet', '-c', 'feature');
  await assert.rejects(attempt(), /CUT_NOT_ON_BASE/);
  fixture.git('switch', '--quiet', 'main'); fixture.git('branch', 'release/0.4.0');
  await assert.rejects(attempt(), /CUT_BRANCH_EXISTS/);
  fixture.git('branch', '-D', 'release/0.4.0'); fixture.git('tag', '0.4.0');
  await assert.rejects(attempt(), /CUT_TAG_EXISTS/);
  fixture.git('tag', '-d', '0.4.0'); fixture.git('push', '--quiet', 'origin', 'HEAD:refs/tags/0.4.0');
  await assert.rejects(attempt({ remote: true }), /CUT_TAG_EXISTS: origin has tag/);
  fixture.git('push', '--quiet', 'origin', ':refs/tags/0.4.0'); fixture.git('push', '--quiet', 'origin', 'HEAD:refs/heads/release/0.4.0');
  await assert.rejects(attempt({ remote: true }), /CUT_BRANCH_EXISTS: origin has release\/0\.4\.0/);
  fixture.git('push', '--quiet', 'origin', ':refs/heads/release/0.4.0');
  await writeFile(join(fixture.root, 'CHANGELOG.md'), changelogText('')); fixture.git('commit', '--quiet', '-am', 'Empty Unreleased'); fixture.git('push', '--quiet', 'origin', 'main'); fixture.git('fetch', '--quiet', 'origin');
  await assert.rejects(attempt(), /RELEASE_NOTES_EMPTY/);
  const empty = await cutRelease(options(fixture));
  assert.equal(empty.status, 'blocked'); assert.match(empty.blockers[0], /^RELEASE_NOTES_EMPTY/); assert.deepEqual(empty.steps, []);
  assert.equal(fixture.git('rev-parse', '--abbrev-ref', 'HEAD'), 'main'); assert.equal(fixture.git('branch', '--list', 'release/*'), '');
});

test('a diverged remote branch is never force-pushed; a failed GitHub write is uncertain and the rerun resumes', async t => {
  const fixture = await gitFixture(t);
  await cutRelease({ ...options(fixture), execute: true });
  fixture.git('push', '--quiet', 'origin', 'main:refs/heads/release/0.4.0');
  await assert.rejects(cutRelease({ ...options(fixture), execute: true, remote: true }), /CUT_REMOTE_BRANCH_DIVERGED/);
  fixture.git('push', '--quiet', 'origin', ':refs/heads/release/0.4.0');
  fixture.gh.responses = { 'pr list': ok('[]'), 'run list': ok('[]'), 'pr create': { status: 1, stdout: '', stderr: 'HTTP 502 for https://user:ghp_secret12345678@github.com\n' } };
  const uncertain = await cutRelease({ ...options(fixture), execute: true, remote: true });
  assert.equal(uncertain.status, 'uncertain'); assert.match(uncertain.error, /^PR_CREATE_FAILED: HTTP 502/);
  assert.doesNotMatch(uncertain.error, /ghp_secret|user:/); assert.match(uncertain.recovery, /rerun/);
  fixture.gh.responses['pr create'] = ok('url');
  const resumed = await cutRelease({ ...options(fixture), execute: true, remote: true });
  assert.equal(resumed.status, 'pushed');
  assert.deepEqual(resumed.steps.map(step => [step.id, step.status]).slice(3), [['push', 'skipped'], ['pull-request', 'done'], ['dispatch-release', 'done']]);
});

test('with GH_TOKEN the push uses the gh credential helper for that command only', async t => {
  const fixture = await gitFixture(t);
  const pushes = [];
  const run = (command, args, opts) => { if (command === 'git' && args.includes('push')) pushes.push(args); return fixture.run(command, args, opts); };
  fixture.gh.responses = { 'pr list': ok('[]'), 'run list': ok('[]') };
  await cutRelease({ ...options(fixture), run, env: { GH_TOKEN: 'not-a-real-token' }, execute: true, remote: true });
  assert.deepEqual(pushes, [['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', 'push', 'origin', 'HEAD:refs/heads/release/0.4.0']]);
});

test('cut arguments require a stable version and reject unsafe values', () => {
  assert.deepEqual(parseCutArguments([]), { help: true });
  assert.deepEqual(parseCutArguments(['--version', '1.0.0', '--execute', '--remote', '--base', 'main', '--date', '2026-10-01', '--repository', 'Owner/repo']),
    { version: '1.0.0', execute: true, remote: true, base: 'main', date: '2026-10-01', repository: 'Owner/repo' });
  assert.throws(() => parseCutArguments(['--execute']), /INVALID_STABLE_VERSION/);
  assert.throws(() => parseCutArguments(['--version', 'v1.0.0']), /INVALID_STABLE_VERSION/);
  assert.throws(() => parseCutArguments(['--version', '1.0.0', '--date', '2026-02-30']), /RELEASE_DATE_INVALID/);
  assert.throws(() => parseCutArguments(['--version', '1.0.0', '--base', '-main']), /INVALID_BASE_BRANCH/);
  assert.throws(() => parseCutArguments(['--version', '1.0.0', '--base']), /MISSING_ARGUMENT_VALUE/);
  assert.throws(() => parseCutArguments(['--version', '1.0.0', '--base', 'a b']), /INVALID_BASE_BRANCH/);
  assert.throws(() => parseCutArguments(['--version', '1.0.0', '--repository', 'not a repo']), /INVALID_REPOSITORY/);
  assert.throws(() => parseCutArguments(['--version', '1.0.0', '--execute', '--execute']), /DUPLICATE_ARGUMENT/);
  assert.throws(() => parseCutArguments(['--version', '1.0.0', '--force']), /UNKNOWN_ARGUMENT/);
});
