import test from 'node:test';
import assert from 'node:assert/strict';
import { lstat, mkdir, rm } from 'node:fs/promises';
import { publishRelease, parsePublishArguments, publishLockPath } from '../release/publish.mjs';
import { createGitHub } from '../release/publish-github.mjs';
import { publishFixture, repository, version, head, notes } from '../../src/cli/tests/release-publish-fixture.mjs';

const publish = (fixture, execute = false) => publishRelease({ repository, version, execute, run: fixture.run, lockDirectory: fixture.folder });
const fullWrites = ['pr ready', 'PUT /pulls/12/merge', 'POST /git/refs', 'POST /releases', 'POST upload', 'POST upload', 'POST upload', 'PATCH /releases/100', `DELETE /git/refs/heads/release/${version}`];
const statuses = result => result.steps.map(step => `${step.id}:${step.status}`);

test('the default publish is a read-only plan bound to the tested head, candidate and notes', async t => {
  const fixture = await publishFixture(t);
  const plan = await publish(fixture);
  assert.equal(plan.status, 'planned'); assert.equal(plan.mode, 'dry-run'); assert.equal(plan.sha, head);
  assert.deepEqual(statuses(plan), ['ready:pending', 'merge:pending', 'tag:pending', 'release:pending', 'delete-branch:pending']);
  assert.deepEqual(plan.releaseResult, { id: 5, conclusion: 'success' });
  assert.deepEqual(plan.candidate.assetHashes, fixture.files.assetHashes);
  assert.equal(plan.candidate.artifact, 'qualified-candidate'); assert.equal(plan.candidate.runId, 900);
  assert.deepEqual(fixture.state.writes, []);
});

test('execute merges, tags, publishes the candidate assets with changelog notes and deletes the branch, in that order', async t => {
  const fixture = await publishFixture(t);
  const result = await publish(fixture, true);
  assert.equal(result.status, 'published');
  assert.deepEqual(result.completed, ['ready', 'merge', 'tag', 'release', 'delete-branch']);
  assert.deepEqual(fixture.state.writes, fullWrites);
  const { state } = fixture;
  assert.equal(state.pulls[0].merged_at !== null, true); assert.ok(state.onMain.has(head));
  assert.equal(state.refs[`tags/${version}`], head); assert.equal(state.refs[`heads/release/${version}`], undefined);
  const [release] = state.releases;
  assert.deepEqual({ tag: release.tag, draft: release.draft, target: release.target, body: release.body }, { tag: version, draft: false, target: head, body: notes });
  assert.deepEqual(Object.fromEntries(release.assets.map(asset => [asset.name, asset.digest.slice(7)])), fixture.files.assetHashes);
  const merge = state.calls.indexOf('PUT /pulls/12/merge'), tag = state.calls.indexOf('POST /git/refs'), created = state.calls.indexOf('POST /releases');
  assert.ok(merge < tag && tag < created, 'merge before tag before release');
  state.writes.length = 0;
  const again = await publish(fixture, true);
  assert.equal(again.status, 'published'); assert.deepEqual(again.completed, []); assert.deepEqual(fixture.state.writes, []);
  assert.deepEqual(statuses(again), ['ready:done', 'merge:done', 'tag:done', 'release:done', 'delete-branch:done']);
});

test('a failed write at every step is uncertain (no retry) and the rerun resumes without repeating finished effects', async t => {
  const keys = ['pr ready', 'PUT /pulls/12/merge', 'POST /git/refs', 'POST /releases', 'POST upload', 'PATCH /releases/100', `DELETE /git/refs/heads/release/${version}`];
  for (const key of keys) {
    for (const effect of [false, true]) {
      const fixture = await publishFixture(t);
      fixture.state.fail[key] = { effect };
      const first = await publish(fixture, true);
      assert.equal(first.status, 'uncertain', `${key} effect=${effect}`);
      assert.match(first.recovery, /rerun the same publish command/);
      assert.equal(fixture.state.writes.at(-1), key, 'stops at the failed write without retrying');
      const second = await publish(fixture, true);
      assert.equal(second.status, 'published', `${key} effect=${effect}: ${second.error ?? ''}`);
      const counts = fixture.state.writes.reduce((map, item) => map.set(item, (map.get(item) ?? 0) + 1), new Map());
      for (const write of ['PUT /pulls/12/merge', 'POST /git/refs', 'POST /releases', `DELETE /git/refs/heads/release/${version}`])
        assert.equal(counts.get(write) - (write === key && !effect ? 1 : 0), 1, `${write} took effect once after ${key} effect=${effect}`);
      assert.equal(fixture.state.releases.length, 1); assert.equal(fixture.state.releases[0].assets.length, 3);
      assert.equal(fixture.state.refs[`tags/${version}`], head);
    }
  }
});

test('an already merged release pull request skips merging and finishes tag, release and branch deletion', async t => {
  const fixture = await publishFixture(t);
  Object.assign(fixture.state.pulls[0], { state: 'closed', draft: false, merged_at: '2026-10-02T09:00:00Z' }); fixture.state.onMain.add(head);
  const plan = await publish(fixture);
  assert.deepEqual(statuses(plan), ['ready:done', 'merge:done', 'tag:pending', 'release:pending', 'delete-branch:pending']);
  const result = await publish(fixture, true);
  assert.equal(result.status, 'published'); assert.deepEqual(result.completed, ['tag', 'release', 'delete-branch']);
  assert.ok(!fixture.state.writes.includes('PUT /pulls/12/merge') && !fixture.state.writes.includes('pr ready'));
});

test('an existing draft release with some assets is completed, a published identical release is left alone', async t => {
  const fixture = await publishFixture(t);
  fixture.state.fail['POST upload'] = { effect: true };
  assert.equal((await publish(fixture, true)).status, 'uncertain');
  assert.equal(fixture.state.releases[0].draft, true); assert.equal(fixture.state.releases[0].assets.length, 1);
  fixture.state.writes.length = 0;
  const plan = await publish(fixture);
  assert.match(plan.steps.find(step => step.id === 'release').detail, /^Complete draft release 100: upload manifest\.json, styles\.css, then publish\.$/);
  assert.equal((await publish(fixture, true)).status, 'published');
  assert.deepEqual(fixture.state.writes, ['POST upload', 'POST upload', 'PATCH /releases/100', `DELETE /git/refs/heads/release/${version}`]);
});

test('a held lock refuses a concurrent execution and is not removed by the refused run', async t => {
  const fixture = await publishFixture(t);
  const path = publishLockPath(repository, version, fixture.folder);
  await mkdir(path); t.after(() => rm(path, { recursive: true, force: true }));
  await assert.rejects(publish(fixture, true), error => error.code === 'PUBLISH_LOCKED' && error.lockPath === path);
  assert.ok((await lstat(path)).isDirectory(), 'the refused run leaves the other holder\'s lock');
  assert.deepEqual(fixture.state.calls, []);
});

test('the gh adapter maps missing CLI, missing authentication and HTTP failures to codes without echoing output', async () => {
  const gh = result => createGitHub({ repository, run: () => result });
  assert.throws(() => gh({ status: null, stdout: '', stderr: '', error: 'ENOENT' }).api('GET', ''), /GH_CLI_REQUIRED: install the GitHub CLI/);
  const unauthenticated = { status: 4, stdout: '', stderr: 'To get started with GitHub CLI, please run:  gh auth login\nAlternatively, populate the GH_TOKEN environment variable with a GitHub API authentication token.\n' };
  assert.throws(() => gh(unauthenticated).api('GET', ''), /GITHUB_AUTH_REQUIRED/);
  await assert.rejects(publishRelease({ repository, version, run: () => unauthenticated }), /GITHUB_AUTH_REQUIRED/);
  assert.throws(() => gh({ status: 1, stdout: '', stderr: 'gh: Bad credentials (HTTP 401)\n' }).api('GET', ''), /GITHUB_AUTH_REQUIRED/);
  const secret = { status: 1, stdout: '', stderr: 'gh: token ghp_abcdefghijk leaked (HTTP 500)\n' };
  assert.throws(() => gh(secret).api('GET', ''), error => error.message === 'GITHUB_API_FAILED_HTTP_500' && error.status === 500);
  assert.equal(await gh({ status: 1, stdout: '', stderr: 'gh: Not Found (HTTP 404)\n' }).optional('/git/ref/tags/1.0.0'), null);
  assert.throws(() => gh({ status: 0, stdout: 'not json' }).api('GET', ''), /GITHUB_API_RESPONSE_INVALID/);
  for (const path of ['/../other/repo', '/pulls?x=<script>', 'https://evil.example/repos/Example/plugin']) assert.throws(() => gh({ status: 0, stdout: '{}' }).api('GET', path), /UNSAFE_GITHUB_API_REQUEST/);
  assert.throws(() => gh({ status: 0, stdout: '{}' }).api('OPTIONS', ''), /UNSAFE_GITHUB_API_REQUEST/);
  assert.throws(() => createGitHub({ repository: 'not a repo', run: () => ({}) }), /INVALID_REPOSITORY/);
  assert.throws(() => gh({ status: 1, stdout: '', stderr: 'gh: Pull request is in clean status (HTTP 422)\n' }).prReady(12), error => error.code === 'PR_READY_FAILED' && error.status === 422);
});

test('publish arguments require a stable version and an owner/repo repository', () => {
  assert.deepEqual(parsePublishArguments([]), { help: true });
  assert.deepEqual(parsePublishArguments(['--version', '1.0.0', '--repository', 'Owner/repo', '--execute', '--json']), { version: '1.0.0', repository: 'Owner/repo', execute: true, json: true });
  assert.throws(() => parsePublishArguments(['--version', '1.0.0']), /REPOSITORY_REQUIRED/);
  assert.throws(() => parsePublishArguments(['--repository', 'Owner/repo']), /INVALID_STABLE_VERSION/);
  assert.throws(() => parsePublishArguments(['--version', 'v1.0.0', '--repository', 'Owner/repo']), /INVALID_STABLE_VERSION/);
  assert.throws(() => parsePublishArguments(['--version', '1.0.0', '--repository']), /MISSING_ARGUMENT_VALUE/);
  assert.throws(() => parsePublishArguments(['--version', '1.0.0', '--repository', 'Owner/repo', '--execute', '--execute']), /DUPLICATE_ARGUMENT/);
  assert.throws(() => parsePublishArguments(['--version', '1.0.0', '--repository', 'Owner/repo', '--force']), /UNKNOWN_ARGUMENT/);
});
