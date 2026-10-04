import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateChangelog, extractNotes, mergeNotes, promoteUnreleased, repositoryUrl, parseChangelogArguments } from '../../scripts/release/changelog.mjs';

const base = 'https://github.com/Example/plugin';
const valid = `# Changelog

Intro text.

## [Unreleased]

### Added

- Pending entry.

## [1.1.0] - 2026-09-02

### Fixed

- Repair.

\`\`\`md
## Not a heading inside a fence
\`\`\`

## [1.0.0] - 2026-09-01

First release prose.

[Unreleased]: ${base}/compare/1.1.0...HEAD
[1.1.0]: ${base}/compare/1.0.0...1.1.0
[1.0.0]: ${base}/releases/tag/1.0.0
`;
const codes = text => validateChangelog(text).diagnostics.map(item => item.code);
const script = fileURLToPath(new URL('../../scripts/release/changelog.mjs', import.meta.url));

test('the repository changelog and a complete fixture satisfy Keep a Changelog 1.1.0', async () => {
  const repository = await readFile(fileURLToPath(new URL('../../CHANGELOG.md', import.meta.url)), 'utf8');
  assert.deepEqual(validateChangelog(repository).diagnostics, []);
  assert.deepEqual(validateChangelog(valid).diagnostics, []);
  assert.deepEqual(validateChangelog(valid).versions.map(section => section.version), ['1.1.0', '1.0.0']);
  assert.equal(extractNotes(valid, '1.1.0'), '### Fixed\n\n- Repair.\n\n```md\n## Not a heading inside a fence\n```');
  assert.equal(extractNotes(valid, '1.0.0'), 'First release prose.');
  assert.throws(() => extractNotes(valid, '0.9.0'), /CHANGELOG_VERSION_MISSING/);
});

test('malformed changelogs fail with a specific diagnostic code each', () => {
  const cases = [
    [valid.replace('# Changelog', '# Release history'), 'CHANGELOG_TITLE_REQUIRED'],
    [valid.replace('Intro text.', 'Intro text.\n\n# Second title'), 'CHANGELOG_TITLE_DUPLICATE'],
    [valid.replace('Intro text.', 'Intro text.\n\n### Added'), 'CHANGELOG_CATEGORY_OUTSIDE_SECTION'],
    [valid.replace('## [Unreleased]\n\n### Added\n\n- Pending entry.\n\n', ''), 'CHANGELOG_UNRELEASED_REQUIRED'],
    [valid.replace('First release prose.', 'First release prose.\n\n## [Unreleased]'), 'CHANGELOG_UNRELEASED_NOT_FIRST'],
    [valid.replace('## [1.0.0] - 2026-09-01', '## 1.0.0'), 'CHANGELOG_VERSION_HEADER_INVALID'],
    [valid.replace('## [1.0.0] - 2026-09-01', '## [1.0.0-beta.1] - 2026-09-01'), 'CHANGELOG_VERSION_HEADER_INVALID'],
    [valid.replace('## [1.0.0] - 2026-09-01', '## [1.0.0]'), 'CHANGELOG_VERSION_HEADER_INVALID'],
    [valid.replace('2026-09-01', '2026-02-30'), 'CHANGELOG_DATE_INVALID'],
    [valid.replace('2026-09-01', '2026-09-03'), 'CHANGELOG_DATE_ORDER'],
    [valid.replace('## [1.0.0]', '## [1.2.0]'), 'CHANGELOG_VERSION_ORDER'],
    [valid.replace('## [1.0.0] - 2026-09-01', '## [1.1.0] - 2026-09-01'), 'CHANGELOG_VERSION_DUPLICATE'],
    [valid.replace('First release prose.\n', ''), 'CHANGELOG_VERSION_EMPTY'],
    [valid.replace('### Fixed', '### Improvements'), 'CHANGELOG_CATEGORY_INVALID'],
    [valid.replace('- Repair.', '- Repair.\n\n### Fixed\n\n- Again.'), 'CHANGELOG_CATEGORY_DUPLICATE'],
    [valid.replace(`[1.0.0]: ${base}/releases/tag/1.0.0\n`, ''), 'CHANGELOG_LINK_MISSING'],
    [valid.replace(`[Unreleased]: ${base}/compare/1.1.0...HEAD\n`, ''), 'CHANGELOG_LINK_MISSING'],
    [valid.replace('compare/1.1.0...HEAD', 'compare/1.0.0...HEAD'), 'CHANGELOG_LINK_INCONSISTENT'],
    [valid.replace(`${base}/compare/1.0.0...1.1.0`, 'https://example.com/1.1.0'), 'CHANGELOG_LINK_INCONSISTENT'],
    [valid.replace(`[1.0.0]: ${base}/releases/tag/1.0.0`, `[1.0.0]: https://github.com/Other/plugin/releases/tag/1.0.0`), 'CHANGELOG_LINK_INCONSISTENT'],
    [`${valid}[1.0.0]: ${base}/releases/tag/1.0.0\n`, 'CHANGELOG_LINK_DUPLICATE'],
    [`${valid}[0.9.0]: ${base}/releases/tag/0.9.0\n`, 'CHANGELOG_LINK_UNKNOWN'],
    [valid.replace('First release prose.', 'First release prose.\n\n```js\nunclosed'), 'CHANGELOG_UNCLOSED_FENCE'],
  ];
  for (const [text, code] of cases) {
    const found = codes(text);
    assert.ok(found.includes(code), `${code} expected, got ${found.join(', ') || 'none'}`);
    assert.throws(() => extractNotes(text, '1.1.0'), /CHANGELOG_INVALID/);
  }
  const legacy = '# Changelog\n\n## 0.4.0\n\nProse.\n';
  assert.deepEqual(codes(legacy), ['CHANGELOG_UNRELEASED_REQUIRED', 'CHANGELOG_VERSION_HEADER_INVALID', 'CHANGELOG_LINK_MISSING']);
  assert.equal(validateChangelog(legacy).ok, false);
  const first = '# Changelog\n\n## [Unreleased]\n\n### Added\n\n- New.\n\n[Unreleased]: https://github.com/Example/plugin/commits/HEAD\n';
  assert.deepEqual(codes(first), []);
  assert.deepEqual(codes(first.replace('commits/HEAD', 'compare/1.0.0...HEAD')), ['CHANGELOG_LINK_INCONSISTENT']);
  assert.deepEqual(validateChangelog(first.replace(/\n\[Unreleased\].*\n$/, '\n'), { requireLinks: false }).diagnostics, []);
  assert.deepEqual(codes(first.replace(/\n\[Unreleased\].*\n$/, '\n')), ['CHANGELOG_LINK_MISSING']);
});

test('notes merge appends prose and items under matching categories without inventing structure', () => {
  assert.equal(mergeNotes('', 'Only notes.'), 'Only notes.');
  assert.equal(mergeNotes('### Added\n\n- A.', ''), '### Added\n\n- A.');
  assert.equal(mergeNotes('### Added\n\n- A.\n\n### Fixed\n\n- F.', 'Context prose.\n\n### Added\n\n- B.\n\n### Security\n\n- S.'),
    'Context prose.\n\n### Added\n\n- A.\n- B.\n\n### Fixed\n\n- F.\n\n### Security\n\n- S.');
  assert.equal(mergeNotes('### Added\n\n```md\n### Not a category\n```', '- loose'), '- loose\n\n### Added\n\n```md\n### Not a category\n```');
});

test('promotion moves Unreleased into a dated version, empties Unreleased and rewrites link references', () => {
  const result = promoteUnreleased(valid, { version: '1.2.0', date: '2026-09-04' });
  assert.equal(result.section, '### Added\n\n- Pending entry.');
  assert.equal(result.linkReferences, 'updated');
  assert.ok(result.text.startsWith('# Changelog\n\nIntro text.\n\n## [Unreleased]\n\n## [1.2.0] - 2026-09-04\n\n### Added\n\n- Pending entry.\n\n## [1.1.0] - 2026-09-02\n'));
  assert.ok(result.text.endsWith(`[Unreleased]: ${base}/compare/1.2.0...HEAD\n[1.2.0]: ${base}/releases/tag/1.2.0\n[1.1.0]: ${base}/compare/1.0.0...1.1.0\n[1.0.0]: ${base}/releases/tag/1.0.0\n`));
  assert.deepEqual(validateChangelog(result.text).diagnostics, []);
  assert.equal(extractNotes(result.text, '1.2.0'), '### Added\n\n- Pending entry.');
  assert.throws(() => promoteUnreleased(result.text, { version: '1.3.0', date: '2026-09-05' }), /RELEASE_NOTES_EMPTY/);
  assert.throws(() => promoteUnreleased(valid, { version: '1.1.0', date: '2026-09-04' }), /CHANGELOG_VERSION_EXISTS/);
  assert.throws(() => promoteUnreleased(valid, { version: '1.0.5', date: '2026-09-04' }), /VERSION_NOT_NEW/);
  assert.throws(() => promoteUnreleased(valid, { version: 'v1.2.0', date: '2026-09-04' }), /INVALID_STABLE_VERSION/);
  assert.throws(() => promoteUnreleased(valid, { version: '1.2.0', date: '04.09.2026' }), /RELEASE_DATE_INVALID/);
  assert.throws(() => promoteUnreleased(valid.replace('### Fixed', '### Misc'), { version: '1.2.0', date: '2026-09-04' }), /CHANGELOG_INVALID: CHANGELOG_CATEGORY_INVALID/);
  assert.throws(() => promoteUnreleased(valid, { version: '1.2.0', date: '2026-09-04', notes: '### Misc\n\n- x' }), /CHANGELOG_INVALID: CHANGELOG_CATEGORY_INVALID/);
  const fresh = promoteUnreleased(null, { version: '0.1.0', date: '2026-09-04', notes: 'Initial.', repository: base });
  assert.deepEqual(validateChangelog(fresh.text).diagnostics, []);
  assert.match(fresh.text, /\[Unreleased\]: https:\/\/github\.com\/Example\/plugin\/compare\/0\.1\.0\.\.\.HEAD\n\[0\.1\.0\]: https:\/\/github\.com\/Example\/plugin\/releases\/tag\/0\.1\.0\n$/);
});

test('repository URL forms resolve only to GitHub bases', () => {
  for (const value of ['Example/plugin', 'github:Example/plugin', 'https://github.com/Example/plugin.git', { url: 'git+https://github.com/Example/plugin.git' }, 'git@github.com:Example/plugin.git'])
    assert.equal(repositoryUrl({ repository: value }), base, JSON.stringify(value));
  for (const value of [undefined, 'https://gitlab.com/Example/plugin', { url: 42 }, 'Example']) assert.equal(repositoryUrl({ repository: value }), null);
});

test('changelog CLI reports coded diagnostics, prints notes and never overwrites --out', async t => {
  const root = await mkdtemp(join(tmpdir(), 'release-changelog-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  await writeFile(join(root, 'CHANGELOG.md'), valid);
  let result = run('check');
  assert.equal(result.status, 0); assert.match(result.stdout, /Changelog check passed: CHANGELOG\.md \(2 versions/);
  result = run('notes', '--version', '1.0.0');
  assert.equal(result.status, 0); assert.equal(result.stdout, 'First release prose.\n');
  result = run('notes', '--version', '1.0.0', '--out', 'notes.md');
  assert.equal(result.status, 0); assert.equal(await readFile(join(root, 'notes.md'), 'utf8'), 'First release prose.\n');
  result = run('notes', '--version', '1.1.0', '--out', 'notes.md');
  assert.equal(result.status, 1); assert.match(result.stderr, /OUTPUT_EXISTS/);
  assert.equal(await readFile(join(root, 'notes.md'), 'utf8'), 'First release prose.\n');
  await writeFile(join(root, 'bad.md'), valid.replace('### Fixed', '### Misc'));
  result = run('check', '--file', 'bad.md', '--json');
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout).diagnostics.map(item => [item.code, item.line]), [['CHANGELOG_CATEGORY_INVALID', 13]]);
  result = run('check', '--file', 'bad.md');
  assert.equal(result.status, 1); assert.match(result.stderr, /^bad\.md:13: CHANGELOG_CATEGORY_INVALID: /);
  result = run('notes', '--version', '1.0.0', '--file', 'bad.md');
  assert.equal(result.status, 1); assert.match(result.stderr, /CHANGELOG_INVALID: CHANGELOG_CATEGORY_INVALID\n {2}line 13: /);
});

test('changelog CLI arguments reject unknown commands, flags and missing values', () => {
  assert.deepEqual(parseChangelogArguments([]), { help: true });
  assert.deepEqual(parseChangelogArguments(['check']), { command: 'check', file: 'CHANGELOG.md' });
  assert.throws(() => parseChangelogArguments(['publish']), /UNKNOWN_COMMAND/);
  assert.throws(() => parseChangelogArguments(['notes']), /VERSION_REQUIRED/);
  assert.throws(() => parseChangelogArguments(['notes', '--version']), /MISSING_ARGUMENT_VALUE/);
  assert.throws(() => parseChangelogArguments(['check', '--json', '--json']), /DUPLICATE_ARGUMENT/);
  assert.throws(() => parseChangelogArguments(['check', '--version', '1.0.0']), /UNKNOWN_ARGUMENT/);
  assert.throws(() => parseChangelogArguments(['check', '--force']), /UNKNOWN_ARGUMENT/);
});
