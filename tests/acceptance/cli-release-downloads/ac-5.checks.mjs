// Increment: [[docs/increments/cli-release-downloads]]
// AC-5: The README and `docs/development/CUT-AND-PUBLISH-A-RELEASE.md` describe the seven release assets, checking the ZIPs with `workbench-SHA256SUMS` and the scaffold command, and `starter-distribution.yml` keeps the distribution artifact as long as the qualified candidate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const text = path => readFile(resolve(root, path), 'utf8');
const downloads = ['workbench-shell-X.Y.Z.zip', 'workbench-starters-X.Y.Z.zip', 'workbench-distributions.json', 'workbench-SHA256SUMS'];
const retention = (workflow, artifact) => {
  const at = workflow.indexOf(artifact); assert.ok(at >= 0, artifact);
  const days = /retention-days: (\d+)/.exec(workflow.slice(at)); assert.ok(days, artifact); return Number(days[1]);
};

test('[AC-5] the README tells a plugin author how to download, check and scaffold from a release', async () => {
  const readme = await text('README.md');
  const section = readme.slice(readme.indexOf('### From a release download'), readme.indexOf('### From this checkout'));
  for (const name of downloads) assert.ok(section.includes(name), name);
  assert.match(section, /sha256sum --check --ignore-missing workbench-SHA256SUMS/);
  assert.match(section, /node bin\/app new \.\.\/my-plugin --starter quick-capture --yes/);
  assert.match(section, /no clone, global install or `node_modules`/);
});

test('[AC-5] the publish guide lists all seven release assets and what Publish verifies', async () => {
  const guide = await text('docs/development/CUT-AND-PUBLISH-A-RELEASE.md');
  const publish = guide.slice(guide.indexOf('## 7. Publish'), guide.indexOf('## 8.'));
  for (const name of ['main.js', 'manifest.json', 'styles.css', ...downloads]) assert.ok(publish.includes(`\`${name}\``), name);
  assert.match(publish, /DISTRIBUTION_ARTIFACT_MISSING/); assert.match(publish, /DISTRIBUTION_INVALID/);
  const verify = guide.slice(guide.indexOf('## 9. Verify the release'));
  assert.match(verify, /exactly the seven assets/); assert.match(verify, /sha256sum --check/);
});

test('[AC-5] the downloads outlive the candidate, so Publish can always read both', async () => {
  const distributions = retention(await text('.github/workflows/starter-distribution.yml'), 'name: workbench-distributions-');
  const candidate = retention(await text('.github/workflows/candidate-qualification.yml'), 'name: qualified-candidate');
  assert.ok(distributions >= candidate, `downloads kept ${distributions} days, candidate ${candidate}`);
});
