// Increment: [[docs/increments/publish-actions-token]]
// AC-1: Given an installation token (`GET /user` answers HTTP 403) and repository permissions with `push: false`, Publish executes and publishes instead of refusing with `PUSH_PERMISSION_REQUIRED`; given a user token with `push: false`, Publish still refuses with `PUSH_PERMISSION_REQUIRED` before any remote write, and a dry run still plans.
// Runs the real publish CLI against a fake GitHub remote (src/cli/tests/support/fake-gh.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { publishCli } from '../../../src/cli/tests/support/publish-cli-fixture.mjs';
import { head, version } from '../../../src/cli/tests/support/release-publish-fixture.mjs';

const noPush = token => state => { state.token = token; state.repo.permissions.push = false; };

test('[AC-1] the built-in Actions token publishes although the repository reports no push', async t => {
  const cli = await publishCli(t, noPush('integration'));
  const result = cli.run('--execute');
  assert.equal(result.status, 0, result.stderr); assert.equal(result.output.status, 'published');
  const remote = await cli.state();
  assert.ok(remote.calls.includes('GET /user'));
  assert.ok(remote.writes.includes('PUT /pulls/12/merge'));
  assert.equal(remote.refs[`tags/${version}`], head);
  assert.equal(remote.releases[0].draft, false);
});

test('[AC-1] a user token without push access is refused before any write, and its dry run still plans', async t => {
  const cli = await publishCli(t, noPush('user'));
  const refused = cli.run('--execute');
  assert.equal(refused.status, 1, refused.stderr); assert.match(refused.output.error, /^PUSH_PERMISSION_REQUIRED/);
  assert.deepEqual((await cli.state()).writes, []);
  const planned = cli.run();
  assert.equal(planned.status, 0, planned.stderr); assert.equal(planned.output.status, 'planned');
  assert.deepEqual((await cli.state()).writes, []);
});
