// Increment: [[docs/increments/changelog-dev-dependency-updates]]
// AC-1: `CHANGELOG.md` contains the "Updated development dependencies" entry exactly once, under `## [Unreleased]` › `### Changed`, and the `## [0.6.0]` section does not contain it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const entry = '- Updated development dependencies (';

/** The text of one `## [name]` section, up to the next version heading. */
function section(changelog, name) {
  const start = changelog.indexOf(`## [${name}]`); assert.ok(start >= 0, name);
  const end = changelog.indexOf('\n## [', start + 1);
  return changelog.slice(start, end < 0 ? undefined : end);
}

test('[AC-1] the development dependency update is listed once, under Unreleased › Changed, and not under 0.6.0', async () => {
  const changelog = await readFile(resolve(root, 'CHANGELOG.md'), 'utf8');
  assert.equal(changelog.split(entry).length - 1, 1);
  const unreleased = section(changelog, 'Unreleased');
  assert.ok(unreleased.includes('### Changed'));
  assert.ok(unreleased.indexOf('### Changed') < unreleased.indexOf(entry));
  assert.ok(!section(changelog, '0.6.0').includes(entry));
});
