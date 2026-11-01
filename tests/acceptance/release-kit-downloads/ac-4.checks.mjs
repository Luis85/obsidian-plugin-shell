// Increment: [[docs/increments/release-kit-downloads]]
// AC-4: The Release tier packs `workbench-shell-X.Y.Z.zip` and `workbench-shell-with-starters-X.Y.Z.zip` with a schema 2 manifest and checksums and validates them with Publish's check; Publish refuses a schema 1 manifest or a retired `workbench-starters-X.Y.Z.zip` with `DISTRIBUTION_INVALID` before any remote write.
// The workflow is read as text; Publish runs for real against the fake GitHub remote (src/cli/tests/support/fake-gh.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { publishCli } from '../../../src/cli/tests/support/publish-cli-fixture.mjs';
import { head, version } from '../../../src/cli/tests/support/release-publish-fixture.mjs';

const root = resolve(import.meta.dirname, '../../..');
const sha256 = value => createHash('sha256').update(value).digest('hex');

test('[AC-4] the Release tier packs both kits, writes a schema 2 manifest and validates it as Publish does', async () => {
  const workflow = await readFile(resolve(root, '.github/workflows/starter-distribution.yml'), 'utf8');
  const build = workflow.slice(workflow.indexOf('- name: Build separate release assets'), workflow.indexOf('- name: Retain separate assets and their manifest'));
  assert.match(build, /framework pack --out "reports\/workbench-distributions\/workbench-shell-\$RELEASE_VERSION\.zip" --yes/);
  assert.match(build, /framework pack --with-starters --out "reports\/workbench-distributions\/workbench-shell-with-starters-\$RELEASE_VERSION\.zip" --yes/);
  assert.match(build, /for \(const kind of \['shell', 'shell-with-starters'\]\)/);
  assert.match(build, /schemaVersion: 2/);
  assert.doesNotMatch(build, /starters pack|workbench-starters-/);
  // The validation step runs after the build and before the artifact is retained, with the same identity inputs.
  assert.match(build, /- name: Verify the assets exactly as Publish will[\s\S]*validateDistributions\('reports\/workbench-distributions', process\.env\.SOURCE_COMMIT, process\.env\.RELEASE_VERSION\)/);
});

/** A schema 1 artifact as releases up to 0.5.0 carried it: the CLI plus a separate data-only starters ZIP. */
function retiredArtifact(state) {
  const zips = { [`workbench-shell-${version}.zip`]: 'PK shell', [`workbench-starters-${version}.zip`]: 'PK starters' };
  const assets = Object.entries(zips).map(([name, value], index) => ({ kind: index ? 'starters' : 'shell', name, bytes: Buffer.byteLength(value), sha256: sha256(value) }));
  state.distributionFiles = { ...zips,
    'workbench-distributions.json': JSON.stringify({ schemaVersion: 1, version, sourceCommit: head, starterSchemaVersion: 1, assets, publication: 'separate-explicit-approval' }),
    'workbench-SHA256SUMS': assets.map(asset => `${asset.sha256}  ${asset.name}\n`).join('') };
}
const cases = [
  ['a schema 1 manifest', state => {
    const manifest = JSON.parse(state.distributionFiles['workbench-distributions.json']);
    state.distributionFiles['workbench-distributions.json'] = JSON.stringify({ ...manifest, schemaVersion: 1 });
  }, /^DISTRIBUTION_INVALID: the manifest has schema 1, not 2/],
  ['the retired starters ZIP', retiredArtifact, new RegExp(`^DISTRIBUTION_INVALID: expected workbench-shell-${version.replaceAll('.', '\\.')}\\.zip, workbench-shell-with-starters-`)],
];
for (const [label, mutate, code] of cases) {
  test(`[AC-4] Publish refuses ${label} with DISTRIBUTION_INVALID before any remote write`, async t => {
    const cli = await publishCli(t, mutate);
    for (const flags of [[], ['--execute']]) {
      const result = cli.run(...flags);
      assert.equal(result.status, 1, `${label} ${flags}`); assert.match(result.output.error, code);
    }
    const remote = await cli.state();
    assert.deepEqual(remote.writes, []); assert.deepEqual(remote.releases, []); assert.equal(remote.refs[`tags/${version}`], undefined);
  });
}
