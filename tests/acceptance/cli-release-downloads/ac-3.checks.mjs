// Increment: [[docs/increments/cli-release-downloads]]
// AC-3: A resumed Publish on an existing draft release uploads only the missing distribution files and never replaces or deletes an asset already on the release.
// Runs the real publish CLI against a fake GitHub remote (src/cli/tests/support/fake-gh.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { publishCli } from '../../../src/cli/tests/support/publish-cli-fixture.mjs';
import { head, version } from '../../../src/cli/tests/support/release-publish-fixture.mjs';

test('[AC-3] after an uncertain upload the rerun uploads only the missing assets and leaves uploaded ones as they are', async t => {
  const cli = await publishCli(t, state => { state.fail['POST upload'] = { effect: true }; });
  const first = cli.run('--execute');
  assert.equal(first.status, 2, first.stderr); assert.equal(first.output.status, 'uncertain'); assert.equal(first.output.failedStep, 'release');
  const draft = (await cli.state()).releases[0];
  assert.equal(draft.draft, true); assert.deepEqual(draft.assets.map(asset => asset.name), ['main.js']);
  await cli.update(state => { state.writes = []; });
  const second = cli.run('--execute');
  assert.equal(second.status, 0, second.stderr); assert.equal(second.output.status, 'published');
  const remote = await cli.state(); const [release] = remote.releases;
  assert.equal(remote.releases.length, 1);
  assert.deepEqual(remote.writes, [...Array(6).fill('POST upload'), 'PATCH /releases/100', `DELETE /git/refs/heads/release/${version}`]);
  assert.deepEqual(release.assets[0], draft.assets[0], 'the asset uploaded first is untouched');
  assert.deepEqual(release.assets.map(asset => asset.name), ['main.js', 'manifest.json', 'styles.css', `workbench-shell-${version}.zip`, `workbench-shell-with-starters-${version}.zip`, 'workbench-distributions.json', 'workbench-SHA256SUMS']);
  assert.equal(release.assets.filter(asset => asset.name === 'main.js').length, 1);
});

test('[AC-3] a published release is never changed: a further run plans nothing and writes nothing', async t => {
  const cli = await publishCli(t);
  assert.equal(cli.run('--execute').output.status, 'published');
  await cli.update(state => { state.writes = []; });
  const again = cli.run('--execute');
  assert.equal(again.status, 0); assert.equal(again.output.status, 'published'); assert.deepEqual(again.output.completed, []);
  assert.deepEqual((await cli.state()).writes, []);
  assert.equal(head.length, 40);
});
