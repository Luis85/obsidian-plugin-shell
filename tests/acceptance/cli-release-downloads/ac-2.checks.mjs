// Increment: [[docs/increments/cli-release-downloads]]
// AC-2: Publish refuses with exit 1 and a named code, before any remote write, when the distribution artifact is missing, its manifest names another version or source commit, it holds an unexpected or missing file, or a checksum does not match the bytes.
// Runs the real publish CLI against a fake GitHub remote (src/cli/tests/support/fake-gh-cli.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { publishCli } from '../../../src/cli/tests/support/publish-cli-fixture.mjs';
import { distributionFiles, head, other, version } from '../../../src/cli/tests/support/release-publish-fixture.mjs';

const manifest = state => JSON.parse(state.distributionFiles['workbench-distributions.json']);
const cases = [
  ['a missing artifact', state => { state.artifacts = state.artifacts.slice(0, 1); }, /^DISTRIBUTION_ARTIFACT_MISSING: /],
  ['an expired artifact', state => { state.artifacts[1].expired = true; }, /^DISTRIBUTION_ARTIFACT_MISSING: /],
  ['another version', state => { state.distributionFiles['workbench-distributions.json'] = JSON.stringify({ ...manifest(state), version: '0.4.0' }); }, /^DISTRIBUTION_INVALID: the manifest names version 0\.4\.0/],
  ['another source commit', state => { state.distributionFiles = { ...distributionFiles(other).bytes }; }, /^DISTRIBUTION_INVALID: the manifest names source c{40}/],
  ['an unexpected file', state => { state.distributionFiles['notes.txt'] = 'x'; }, /^DISTRIBUTION_INVALID: expected /],
  ['a missing file', state => { delete state.distributionFiles[`workbench-starters-${version}.zip`]; }, /^DISTRIBUTION_INVALID: expected /],
  ['a checksum that does not match', state => { state.distributionFiles['workbench-SHA256SUMS'] = state.distributionFiles['workbench-SHA256SUMS'].replace(/^./, '0'); }, /^DISTRIBUTION_INVALID: workbench-SHA256SUMS does not match/],
];

for (const [label, mutate, code] of cases) {
  test(`[AC-2] ${label} is refused with exit 1 and a named code, before any remote write`, async t => {
    const cli = await publishCli(t, mutate);
    for (const flags of [[], ['--execute']]) {
      const result = cli.run(...flags);
      assert.equal(result.status, 1, `${label} ${flags}`); assert.equal(result.output.status, 'failed'); assert.match(result.output.error, code);
    }
    const remote = await cli.state();
    assert.deepEqual(remote.writes, []); assert.deepEqual(remote.releases, []); assert.equal(remote.refs[`tags/${version}`], undefined);
    assert.equal(remote.refs[`heads/release/${version}`], head);
  });
}
