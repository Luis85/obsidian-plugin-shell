import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyReleaseBranch, parseBranchArguments } from '../release/branch.mjs';
import { cutRelease } from '../release/cut.mjs';
import { gitFixture } from './release-git-fixture.mjs';

const byCode = result => Object.fromEntries(result.checks.map(item => [item.code, item.status]));
async function cut(t, options) {
  const fixture = await gitFixture(t, options);
  await cutRelease({ root: fixture.root, version: '0.4.0', date: '2026-10-01', execute: true, run: fixture.run, env: {} });
  return fixture;
}

test('a freshly cut release branch passes every release metadata check', async t => {
  const { root, run } = await cut(t);
  const result = await verifyReleaseBranch({ root, version: '0.4.0', run, env: {} });
  assert.equal(result.status, 'passed'); assert.equal(result.branch, 'release/0.4.0');
  assert.deepEqual(byCode(result), { RELEASE_BRANCH_NAME: 'passed', RELEASE_VERSIONS: 'passed', RELEASE_VERSIONS_JSON: 'passed', CHANGELOG_VALID: 'passed',
    RELEASE_NOTES: 'passed', RELEASE_TAG_ABSENT: 'passed', RELEASE_BASE_ANCESTRY: 'passed' });
  assert.match(result.checks.find(item => item.code === 'RELEASE_BASE_ANCESTRY').message, /1 release commit\(s\)/);
});

test('branch name comes from --branch, then GITHUB_HEAD_REF, then GITHUB_REF_NAME, then the checkout', async t => {
  const { root, run, git } = await cut(t);
  git('switch', '--quiet', '--detach');
  const name = async (branch, env) => (await verifyReleaseBranch({ root, version: '0.4.0', branch, run, env })).branch;
  assert.equal(await name(undefined, {}), 'HEAD');
  assert.equal(await name(undefined, { GITHUB_REF_NAME: 'release/0.4.0' }), 'release/0.4.0');
  assert.equal(await name(undefined, { GITHUB_HEAD_REF: 'feature/x', GITHUB_REF_NAME: 'release/0.4.0' }), 'feature/x');
  assert.equal(await name('release/0.4.0', { GITHUB_HEAD_REF: 'feature/x' }), 'release/0.4.0');
  const detached = await verifyReleaseBranch({ root, version: '0.4.0', run, env: {} });
  assert.equal(detached.status, 'failed'); assert.equal(byCode(detached).RELEASE_BRANCH_NAME_MISMATCH, 'failed');
});

test('version, versions.json, changelog, tag and unrelated-history problems each fail with a code', async t => {
  const { root, run, git } = await cut(t);
  const verify = () => verifyReleaseBranch({ root, version: '0.4.0', run, env: {} });
  const manifestPath = join(root, 'manifest.json'); const manifest = await readFile(manifestPath, 'utf8');
  await writeFile(manifestPath, manifest.replace('"version": "0.4.0"', '"version": "0.3.0"'));
  assert.equal(byCode(await verify()).RELEASE_VERSION_MISMATCH, 'failed');
  await writeFile(manifestPath, manifest);
  const versionsPath = join(root, 'versions.json'); const versions = await readFile(versionsPath, 'utf8');
  await writeFile(versionsPath, JSON.stringify({ '0.3.0': '1.13.7' }));
  assert.equal(byCode(await verify()).RELEASE_VERSIONS_JSON_MISMATCH, 'failed');
  await writeFile(versionsPath, versions);
  const changelogPath = join(root, 'CHANGELOG.md'); const changelog = await readFile(changelogPath, 'utf8');
  await writeFile(changelogPath, changelog.replace('### Added', '### Misc'));
  assert.equal(byCode(await verify()).CHANGELOG_INVALID, 'failed');
  // An empty 0.4.0 section: its entries move under an inserted older heading.
  await writeFile(changelogPath, changelog.replace('## [0.4.0] - 2026-10-01', '## [0.4.0] - 2026-10-01\n\n## [0.3.5] - 2026-09-15'));
  const empty = await verify();
  assert.equal(byCode(empty).RELEASE_NOTES_MISSING, 'failed'); assert.equal(byCode(empty).CHANGELOG_INVALID, 'failed');
  await writeFile(changelogPath, changelog);
  git('tag', '0.4.0');
  assert.equal(byCode(await verify()).RELEASE_TAG_EXISTS, 'failed');
  git('tag', '-d', '0.4.0');
  git('switch', '--quiet', '--orphan', 'release/unrelated'); git('commit', '--quiet', '--allow-empty', '-m', 'Unrelated root');
  assert.equal(byCode(await verifyReleaseBranch({ root, version: '0.4.0', branch: 'release/0.4.0', run, env: {} })).RELEASE_BASE_UNRELATED, 'failed');
});

test('ancestry is a warning when origin/main is not fetched and reports a base that advanced', async t => {
  const { root, run, git } = await cut(t);
  git('update-ref', '-d', 'refs/remotes/origin/main');
  const unfetched = await verifyReleaseBranch({ root, version: '0.4.0', run, env: {} });
  assert.equal(unfetched.status, 'passed'); assert.equal(byCode(unfetched).RELEASE_BASE_NOT_FETCHED, 'warning');
  git('switch', '--quiet', 'main'); git('commit', '--quiet', '--allow-empty', '-m', 'Later main work'); git('push', '--quiet', 'origin', 'main');
  git('fetch', '--quiet', 'origin'); git('switch', '--quiet', 'release/0.4.0');
  const advanced = await verifyReleaseBranch({ root, version: '0.4.0', run, env: {} });
  assert.equal(advanced.status, 'passed'); assert.equal(byCode(advanced).RELEASE_BASE_ADVANCED, 'warning');
});

test('branch CLI prints coded results, JSON and exits 1 on failure', async t => {
  const { root } = await cut(t);
  const script = fileURLToPath(new URL('../release/branch.mjs', import.meta.url));
  const env = { ...process.env, GITHUB_HEAD_REF: '', GITHUB_REF_NAME: '' };
  let result = spawnSync(process.execPath, [script, 'verify', '--version', '0.4.0'], { cwd: root, encoding: 'utf8', env, timeout: 30000 });
  assert.equal(result.status, 0); assert.match(result.stdout, /^PASSED {2}RELEASE_BRANCH_NAME: Branch release\/0\.4\.0\./m);
  result = spawnSync(process.execPath, [script, 'verify', '--version', '0.5.0', '--json'], { cwd: root, encoding: 'utf8', env, timeout: 30000 });
  assert.equal(result.status, 1); assert.equal(JSON.parse(result.stdout).status, 'failed');
  assert.deepEqual(parseBranchArguments([]), { help: true });
  assert.throws(() => parseBranchArguments(['check', '--version', '0.4.0']), /UNKNOWN_COMMAND/);
  assert.throws(() => parseBranchArguments(['verify']), /INVALID_STABLE_VERSION/);
  assert.throws(() => parseBranchArguments(['verify', '--version', '0.4.0', '--json', '--json']), /DUPLICATE_ARGUMENT/);
  assert.throws(() => parseBranchArguments(['verify', '--version']), /MISSING_ARGUMENT_VALUE/);
  assert.throws(() => parseBranchArguments(['verify', '--version', '0.4.0', '--tag']), /UNKNOWN_ARGUMENT/);
});
