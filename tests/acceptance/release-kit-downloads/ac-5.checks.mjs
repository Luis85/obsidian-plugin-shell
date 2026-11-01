// Increment: [[docs/increments/release-kit-downloads]]
// AC-5: The README, `docs/development/CUT-AND-PUBLISH-A-RELEASE.md`, `docs/development/FRAMEWORK-CLI.md` and `CHANGELOG.md` describe the two downloads, and no live doc tells users to extract `workbench-starters-X.Y.Z.zip`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const text = path => readFile(resolve(root, path), 'utf8');
const downloads = ['workbench-shell-X.Y.Z.zip', 'workbench-shell-with-starters-X.Y.Z.zip'];

test('[AC-5] the README, publish guide, CLI reference and changelog name the two downloads', async () => {
  const readme = await text('README.md');
  const section = readme.slice(readme.indexOf('### From a release download'), readme.indexOf('### From this checkout'));
  for (const name of downloads) assert.ok(section.includes(name), `README: ${name}`);
  assert.match(section, /unzip \.\.\/workbench-shell-with-starters-X\.Y\.Z\.zip\n/);
  assert.ok(section.includes('src/cli/KIT-README.md'), 'the README points to the kit guide and its prompts');
  const guide = await text('docs/development/CUT-AND-PUBLISH-A-RELEASE.md');
  for (const name of downloads) assert.ok(guide.includes(`\`${name}\``), `publish guide: ${name}`);
  const reference = await text('docs/development/FRAMEWORK-CLI.md');
  assert.match(reference, /framework pack --with-starters/);
  for (const name of downloads) assert.ok(reference.includes(name), `CLI reference: ${name}`);
  const changelog = await text('CHANGELOG.md');
  // Everything newer than 0.5.0: `## [Unreleased]` until the release cut promotes it, then the new version's section.
  const pending = changelog.slice(changelog.indexOf('## [Unreleased]'), changelog.indexOf('\n## [0.5.0]'));
  for (const name of [...downloads, 'workbench-starters-X.Y.Z.zip']) assert.ok(pending.includes(name), `changelog: ${name}`);
});

test('[AC-5] no live how-to still extracts the retired starters ZIP', async () => {
  for (const path of ['README.md', 'docs/development/CUT-AND-PUBLISH-A-RELEASE.md', 'docs/development/ADOPT-EXISTING-PROJECT.md', 'docs/development/JSON-STARTERS.md', 'src/cli/PROJECT-STARTERS.md', 'src/cli/KIT-README.md'])
    assert.doesNotMatch(await text(path), /unzip[^\n]*workbench-starters-|Extract[^\n]*workbench-starters-/, path);
  assert.doesNotMatch(await readFile(resolve(root, 'src/cli/domain/adoption/plan-phases.ts'), 'utf8'), /workbench-starters-|workbench-cli-<version>/);
});
