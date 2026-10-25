// Increment: [[docs/increments/publish-actions-token]]
// AC-2: The token probe issues only `GET /user`, reports `user` on success and `integration` on HTTP 403, and any other failure fails closed with a coded error that carries no raw gh output; Publish calls it only when the repository reports `push: false`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGitHub } from '../../../tooling/release/publish-github.mjs';
import { publishCli } from '../../../src/cli/tests/support/publish-cli-fixture.mjs';
import { repository } from '../../../src/cli/tests/support/release-publish-fixture.mjs';

test('[AC-2] the probe maps success, 403 and other failures without echoing gh output', () => {
  const targets = [];
  const probe = result => createGitHub({ repository, run: (command, args) => { targets.push(`${args[2]} ${args.at(-1)}`); return result; } }).tokenKind();
  assert.equal(probe({ status: 0, stdout: '{"login":"octo"}', stderr: '' }), 'user');
  assert.equal(probe({ status: 1, stdout: '', stderr: 'gh: Resource not accessible by integration (HTTP 403)\n' }), 'integration');
  assert.throws(() => probe({ status: 1, stdout: '', stderr: 'gh: secret-ghs_0123456789 (HTTP 500)\n' }), error => error.message === 'GITHUB_API_FAILED_HTTP_500' && !error.message.includes('ghs_'));
  assert.deepEqual(new Set(targets), new Set(['GET user']));
});

test('[AC-2] Publish probes the token only when the repository reports no push', async t => {
  const granted = await publishCli(t);
  assert.equal(granted.run('--execute').status, 0);
  assert.ok(!(await granted.state()).calls.includes('GET /user'));
  const unknown = await publishCli(t, state => { delete state.repo.permissions; });
  assert.equal(unknown.run('--execute').status, 0);
  assert.ok(!(await unknown.state()).calls.includes('GET /user'));
});
