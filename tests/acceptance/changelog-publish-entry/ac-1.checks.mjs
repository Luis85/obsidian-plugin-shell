// Increment: [[docs/increments/changelog-publish-entry]]
// AC-1: `CHANGELOG.md` contains the "Publish no longer refuses the built-in `GITHUB_TOKEN`" entry exactly once, under `## [Unreleased]` › `### Fixed`, and the `## [0.5.0]` section no longer contains it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const entry = '- Publish no longer refuses the built-in `GITHUB_TOKEN`';
/** The text of one `## [name]` section, up to the next version heading. */
function section(changelog, name) {
  const start = changelog.indexOf(`## [${name}]`); assert.ok(start >= 0, name);
  const end = changelog.indexOf('\n## [', start + 1);
  return changelog.slice(start, end < 0 ? undefined : end);
}

/** The section holding `entry` among those newer than 0.5.0: `Unreleased` until a release cut promotes it into the next version. */
function pendingSection(changelog) {
  const newer = changelog.slice(changelog.indexOf('## [Unreleased]'), changelog.indexOf('\n## [0.5.0]'));
  const at = newer.indexOf(entry); assert.ok(at >= 0, 'the entry is in Unreleased or a version after 0.5.0');
  const start = newer.lastIndexOf('## [', at);
  const end = newer.indexOf('\n## [', at);
  return newer.slice(start, end < 0 ? undefined : end);
}

test('[AC-1] the Publish token fix is listed once, under Unreleased › Fixed, and not under 0.5.0', async () => {
  const changelog = await readFile(resolve(root, 'CHANGELOG.md'), 'utf8');
  assert.equal(changelog.split(entry).length - 1, 1);
  const pending = pendingSection(changelog);
  assert.ok(pending.indexOf('### Fixed') >= 0 && pending.indexOf('### Fixed') < pending.indexOf(entry));
  assert.ok(!section(changelog, '0.5.0').includes(entry));
});
