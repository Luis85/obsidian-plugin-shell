// Increment: [[docs/increments/publish-actions-token]]
// AC-2: The token probe issues only `GET /user`, reports `user` on success and `integration` on HTTP 403, and any other failure fails closed with a coded error that carries no raw gh output; Publish calls it only when the repository reports `push: false`.
// Runs the real publish CLI against a fake GitHub remote (src/cli/tests/support/fake-gh.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { publishCli } from '../../../src/cli/tests/support/publish-cli-fixture.mjs';

const noPush = (token, extra = () => {}) => state => { state.token = token; state.repo.permissions.push = false; extra(state); };
const probes = calls => calls.filter(call => call === 'GET /user').length;

test('[AC-2] a user token answers the probe and is refused; an installation token gets 403 and proceeds', async t => {
  const user = await publishCli(t, noPush('user'));
  assert.equal(user.run('--execute').status, 1);
  assert.equal(probes((await user.state()).calls), 1);
  const integration = await publishCli(t, noPush('integration'));
  assert.equal(integration.run('--execute').status, 0);
  assert.equal(probes((await integration.state()).calls), 1);
});

test('[AC-2] any other probe failure fails closed with a code and no gh output, before any write', async t => {
  const cli = await publishCli(t, noPush('user', state => { state.fail['GET /user'] = { stderr: 'gh: secret-ghs_0123456789 (HTTP 500)\n' }; }));
  const result = cli.run('--execute');
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.output.error, 'GITHUB_API_FAILED_HTTP_500');
  assert.ok(!`${result.stdout}${result.stderr}`.includes('ghs_'));
  assert.deepEqual((await cli.state()).writes, []);
});

test('[AC-2] Publish probes the token only when the repository reports no push', async t => {
  const granted = await publishCli(t);
  assert.equal(granted.run('--execute').status, 0);
  assert.equal(probes((await granted.state()).calls), 0);
  const unknown = await publishCli(t, state => { delete state.repo.permissions; });
  assert.equal(unknown.run('--execute').status, 0);
  assert.equal(probes((await unknown.state()).calls), 0);
});
