// Increment: [[docs/increments/cli-release-downloads]]
// AC-1: Given a release run whose `workbench-distributions-<sha>` artifact matches the release version and head, the Publish plan lists `workbench-shell-X.Y.Z.zip`, `workbench-starters-X.Y.Z.zip`, `workbench-distributions.json` and `workbench-SHA256SUMS` after `main.js`, `manifest.json` and `styles.css`, and execution uploads all seven to the draft release before publishing it.
// Runs the real publish CLI against a fake GitHub remote (src/cli/tests/support/fake-gh.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { publishCli } from '../../../src/cli/tests/support/publish-cli-fixture.mjs';
import { head, version } from '../../../src/cli/tests/support/release-publish-fixture.mjs';

const assets = ['main.js', 'manifest.json', 'styles.css', `workbench-shell-${version}.zip`, `workbench-starters-${version}.zip`, 'workbench-distributions.json', 'workbench-SHA256SUMS'];

test('[AC-1] the publish plan names the seven release assets, the plugin first, and the distribution artifact of the run', async t => {
  const cli = await publishCli(t);
  const plan = cli.run();
  assert.equal(plan.status, 0, plan.stderr); assert.equal(plan.output.status, 'planned');
  assert.equal(plan.output.steps.find(step => step.id === 'release').detail, `Create release ${version} with ${assets.join(', ')}.`);
  assert.equal(plan.output.distributions.artifact, `workbench-distributions-${head}`);
  assert.deepEqual((await cli.state()).writes, [], 'the plan writes nothing');
});

test('[AC-1] execute uploads all seven assets with their tested bytes before publishing the release', async t => {
  const cli = await publishCli(t);
  const result = cli.run('--execute');
  assert.equal(result.status, 0, result.stderr); assert.equal(result.output.status, 'published');
  const remote = await cli.state(); const [release] = remote.releases;
  assert.equal(release.draft, false);
  assert.deepEqual(release.assets.map(asset => asset.name), assets);
  assert.deepEqual(Object.fromEntries(release.assets.map(asset => [asset.name, asset.digest.slice(7)])), cli.fixture.releaseHashes);
  const writes = remote.writes;
  assert.ok(writes.lastIndexOf('POST upload') < writes.indexOf('PATCH /releases/100'), 'every upload happens before the release is published');
});
